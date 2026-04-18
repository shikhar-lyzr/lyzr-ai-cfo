import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { getReconciliationStats, getTopBreaks } from "../stats";

const U = "test-user-stats-periods";

async function cleanup() {
  await prisma.break.deleteMany({ where: { matchRun: { userId: U } } });
  await prisma.matchRun.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { id: U } });
}

beforeEach(async () => {
  await cleanup();
  await prisma.user.create({ data: { id: U, lyzrAccountId: U, email: `${U}@x`, name: "T" } });
  const marRun = await prisma.matchRun.create({
    data: { userId: U, periodKey: "2026-03", triggeredBy: "test", strategyConfig: {}, totalGL: 10, totalSub: 10, matched: 8, partial: 0, unmatched: 2 },
  });
  const aprRun = await prisma.matchRun.create({
    data: { userId: U, periodKey: "2026-04", triggeredBy: "test", strategyConfig: {}, totalGL: 20, totalSub: 20, matched: 18, partial: 0, unmatched: 2 },
  });
  await prisma.break.createMany({
    data: [
      { matchRunId: marRun.id, side: "gl_only", entryId: "mar-x", amount: 500, baseAmount: 500, txnCurrency: "USD", ageDays: 10, ageBucket: "0-30", severity: "high", severityRank: 3, status: "open" },
      { matchRunId: aprRun.id, side: "gl_only", entryId: "apr-y", amount: 9000, baseAmount: 9000, txnCurrency: "USD", ageDays: 5, ageBucket: "0-30", severity: "high", severityRank: 3, status: "open" },
    ],
  });
});
afterEach(cleanup);

describe("period-scoped stats", () => {
  it("getReconciliationStats scopes to periodKey", async () => {
    const mar = await getReconciliationStats(U, "2026-03");
    if (!mar.hasData) throw new Error("expected data for 2026-03");
    expect(mar.openBreakValue).toBe(500);
    expect(mar.openBreakCount).toBe(1);

    const apr = await getReconciliationStats(U, "2026-04");
    if (!apr.hasData) throw new Error("expected data for 2026-04");
    expect(apr.openBreakValue).toBe(9000);
    expect(apr.openBreakCount).toBe(1);
  });

  it("returns hasData:false for unknown period", async () => {
    const may = await getReconciliationStats(U, "2026-05");
    expect(may.hasData).toBe(false);
  });

  it("getTopBreaks scopes to periodKey", async () => {
    const mar = await getTopBreaks(U, "2026-03", 5);
    expect(mar.length).toBe(1);
    expect(mar[0].amount).toBe(500);

    const apr = await getTopBreaks(U, "2026-04", 5);
    expect(apr.length).toBe(1);
    expect(apr[0].amount).toBe(9000);
  });
});
