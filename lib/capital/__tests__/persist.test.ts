import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  ingestCapitalComponents,
  ingestRwaBreakdown,
  recomputeCapitalSnapshot,
} from "../persist";

describe("capital persist", { timeout: 30_000 }, () => {
  let userId: string;

  beforeEach(async () => {
    await prisma.capitalSnapshot.deleteMany({});
    await prisma.rwaLine.deleteMany({});
    await prisma.capitalComponent.deleteMany({});
    await prisma.capitalPeriod.deleteMany({});
    const user = await prisma.user.create({
      data: {
        lyzrAccountId: `test-${Date.now()}-${Math.random()}`,
        email: `test-${Date.now()}-${Math.random()}@ex.com`,
        name: "T",
      },
    });
    userId = user.id;
  });

  it("ingests capital components and creates a snapshot", async () => {
    const headers = ["period", "component", "amount", "currency"];
    const rows = [
      ["2026-Q1", "cet1_capital", "10000", "USD"],
      ["2026-Q1", "additional_tier1", "1500", "USD"],
      ["2026-Q1", "tier2", "2500", "USD"],
      ["2026-Q1", "total_rwa", "100000", "USD"],
    ];

    const result = await ingestCapitalComponents(userId, "components.csv", headers, rows, "hash-a");
    expect(result.periodsTouched).toContain("2026-Q1");

    const snap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    expect(snap).not.toBeNull();
    expect(snap!.cet1Ratio).toBeCloseTo(0.1, 4);
    expect(snap!.tier1Ratio).toBeCloseTo(0.115, 4);
    expect(snap!.totalRatio).toBeCloseTo(0.14, 4);
  });

  it("recompute picks up newly-uploaded RWA lines without changing ratios", async () => {
    await ingestCapitalComponents(
      userId,
      "components.csv",
      ["period", "component", "amount", "currency"],
      [
        ["2026-Q1", "cet1_capital", "10000", "USD"],
        ["2026-Q1", "total_rwa", "100000", "USD"],
      ],
      "hash-c",
    );

    await ingestRwaBreakdown(
      userId,
      "rwa.csv",
      ["period", "risk_type", "exposure_class", "exposure_amount", "risk_weight", "rwa"],
      [
        ["2026-Q1", "credit", "corp", "100000", "1.0", "80000"],
        ["2026-Q1", "market", "tb", "10000", "0.5", "5000"],
        ["2026-Q1", "operational", "op", "0", "0", "15000"],
      ],
      "hash-r",
    );

    const snap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    // ratios are unchanged — capital_components drives the denominator.
    expect(snap!.totalRwa).toBe(100_000);

    const lines = await prisma.rwaLine.count({ where: { periodKey: "2026-Q1" } });
    expect(lines).toBe(3);
  });

  it("upserts CapitalPeriod rows for every touched period", async () => {
    await ingestCapitalComponents(
      userId,
      "m.csv",
      ["period", "component", "amount"],
      [
        ["2026-Q1", "cet1_capital", "100"],
        ["2026-Q1", "total_rwa", "1000"],
        ["2026-Q2", "cet1_capital", "200"],
        ["2026-Q2", "total_rwa", "2000"],
      ],
      "hash-multi",
    );
    const periods = await prisma.capitalPeriod.findMany({ where: { userId } });
    expect(periods.map((p) => p.periodKey).sort()).toEqual(["2026-Q1", "2026-Q2"]);
  });

  it("ignores DataSources not in status='ready' when recomputing", async () => {
    // Manually create a DataSource in status="processing" with components.
    // recomputeCapitalSnapshot should not pick them up because it filters
    // on status="ready".
    const ds = await prisma.dataSource.create({
      data: {
        userId,
        type: "capital_components",
        name: "processing.csv",
        status: "processing",
      },
    });
    await prisma.capitalComponent.createMany({
      data: [
        { dataSourceId: ds.id, periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
        { dataSourceId: ds.id, periodKey: "2026-Q1", component: "total_rwa", amount: 1000, currency: "USD" },
      ],
    });

    await recomputeCapitalSnapshot(userId, "2026-Q1");

    const snap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    expect(snap).toBeNull();
  });

  it("scopes recompute by userId (no cross-tenant leakage)", async () => {
    // Create a second user and ingest components for them.
    const other = await prisma.user.create({
      data: {
        lyzrAccountId: `other-${Date.now()}-${Math.random()}`,
        email: `other-${Date.now()}-${Math.random()}@ex.com`,
        name: "Other",
      },
    });
    await ingestCapitalComponents(
      other.id,
      "other.csv",
      ["period", "component", "amount"],
      [
        ["2026-Q1", "cet1_capital", "999"],
        ["2026-Q1", "total_rwa", "10000"],
      ],
      `hash-other-${Date.now()}`,
    );

    // Now run recompute for the ORIGINAL user for the same period —
    // no snapshot should be created because that user has no components.
    await recomputeCapitalSnapshot(userId, "2026-Q1");

    const ourSnap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    expect(ourSnap).toBeNull();

    // But the other user's snapshot DOES exist.
    const theirSnap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId: other.id, periodKey: "2026-Q1" } },
    });
    expect(theirSnap).not.toBeNull();
  });

  it("deletes stale snapshot when the ingest DataSource is removed", async () => {
    const { dataSource } = await ingestCapitalComponents(
      userId,
      "to-delete.csv",
      ["period", "component", "amount"],
      [
        ["2026-Q1", "cet1_capital", "500"],
        ["2026-Q1", "total_rwa", "5000"],
      ],
      `hash-del-${Date.now()}`,
    );

    // Snapshot should exist after ingest.
    const before = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    expect(before).not.toBeNull();

    // Delete the DataSource (cascades delete CapitalComponent rows per schema).
    await prisma.dataSource.delete({ where: { id: dataSource.id } });

    // Recompute finds no components → deletes the snapshot.
    await recomputeCapitalSnapshot(userId, "2026-Q1");
    const after = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    expect(after).toBeNull();
  });
});
