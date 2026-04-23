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
});
