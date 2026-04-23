// tests/integration/close-readiness-upload.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { getCloseReadiness, getCloseBlockers } from "@/lib/close/stats";
import { deriveTaskCounts } from "@/lib/close/tasks";
import { deleteTestUser } from "./cleanup";

// Neon pooler round-trips add up across seed + the three read functions; 5s
// vitest default is not enough. Matches existing integration tests.
describe("close-readiness upload integration", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("cold state returns hasData=false with isEmpty task cards", async () => {
    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(false);

    const blockers = await getCloseBlockers(userId, "2026-04");
    // With no sources at all, every required source is "missing"
    expect(blockers.length).toBe(3);
    expect(blockers.every((b) => b.kind === "missing_source")).toBe(true);

    const tasks = await deriveTaskCounts(userId, "2026-04");
    expect(tasks).toHaveLength(5);
    // All ledger-backed cards empty; variance + package cards total=1 with completed=0
    expect(tasks[0].isEmpty).toBe(true); // subledger
    expect(tasks[1].isEmpty).toBe(true); // gl
    expect(tasks[2].total).toBe(1); // variance (special: total always 1)
  });

  it("GL upload only populates GL task card but matchRate stays 0", async () => {
    // Seed a GL DataSource + 10 unmatched entries + a MatchRun with matched=0
    const gl = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    await prisma.gLEntry.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        dataSourceId: gl.id,
        periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        postingDate: new Date("2026-04-15"),
        account: "2100",
        reference: `INV-${i}`,
        amount: 100,
        txnCurrency: "USD",
        baseAmount: 100,
        debitCredit: "DR",
        counterparty: "Acme",
        matchStatus: "unmatched",
      })),
    });
    await prisma.matchRun.create({
      data: {
        userId,
        periodKey: "2026-04",
        triggeredBy: "upload",
        strategyConfig: {},
        totalGL: 10,
        totalSub: 0,
        matched: 0,
        partial: 0,
        unmatched: 10,
        completedAt: new Date(),
      },
    });

    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(true);
    if (readiness.hasData) {
      expect(readiness.signals.matchRate).toBe(0);
      // sub_ledger + variance missing -> 2/3
      expect(readiness.signals.freshnessPenalty).toBeCloseTo(2 / 3, 5);
    }

    const tasks = await deriveTaskCounts(userId, "2026-04");
    // tasks[1] is the GL card
    expect(tasks[1].isEmpty).toBe(false);
    expect(tasks[1].total).toBe(10);
    expect(tasks[1].completed).toBe(0);
    // sub-ledger still empty
    expect(tasks[0].isEmpty).toBe(true);
  });

  it("GL + sub-ledger fully matched: matchRate=1.0, freshness 1/3", async () => {
    const gl = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    const sub = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "test-sub.csv", status: "ready" },
    });
    // 10 GL + 10 Sub, all matched
    await prisma.gLEntry.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        dataSourceId: gl.id,
        periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        postingDate: new Date("2026-04-15"),
        account: "2100",
        reference: `INV-${i}`,
        amount: 100,
        txnCurrency: "USD",
        baseAmount: 100,
        debitCredit: "DR",
        counterparty: "Acme",
        matchStatus: "matched",
      })),
    });
    await prisma.subLedgerEntry.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        dataSourceId: sub.id,
        sourceModule: "AP",
        periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        account: "2100",
        reference: `INV-${i}`,
        amount: 100,
        txnCurrency: "USD",
        baseAmount: 100,
        counterparty: "Acme",
        matchStatus: "matched",
      })),
    });
    await prisma.matchRun.create({
      data: {
        userId,
        periodKey: "2026-04",
        triggeredBy: "upload",
        strategyConfig: {},
        totalGL: 10,
        totalSub: 10,
        matched: 10,
        partial: 0,
        unmatched: 0,
        completedAt: new Date(),
      },
    });

    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(true);
    if (readiness.hasData) {
      // (matched * 2) / (totalGL + totalSub) = 20 / 20 = 1.0
      expect(readiness.signals.matchRate).toBe(1);
      // gl + sub_ledger present, variance still missing -> 1/3
      expect(readiness.signals.freshnessPenalty).toBeCloseTo(1 / 3, 5);
    }

    const tasks = await deriveTaskCounts(userId, "2026-04");
    expect(tasks[0].isEmpty).toBe(false); // sub-ledger
    expect(tasks[0].total).toBe(10);
    expect(tasks[0].completed).toBe(10);
  });
});
