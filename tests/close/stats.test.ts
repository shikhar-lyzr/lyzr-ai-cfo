import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    matchRun: { findFirst: vi.fn(), findMany: vi.fn() },
    break: { findMany: vi.fn() },
    dataSource: { findMany: vi.fn() },
    financialRecord: { findMany: vi.fn() },
    gLEntry: { findMany: vi.fn() },
    subLedgerEntry: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getCloseReadiness, getCloseBlockers, scoreToTier } from "@/lib/close/stats";

const mocked = prisma as unknown as {
  matchRun: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  break: { findMany: ReturnType<typeof vi.fn> };
  dataSource: { findMany: ReturnType<typeof vi.fn> };
  financialRecord: { findMany: ReturnType<typeof vi.fn> };
  gLEntry: { findMany: ReturnType<typeof vi.fn> };
  subLedgerEntry: { findMany: ReturnType<typeof vi.fn> };
};

describe("scoreToTier", () => {
  it("maps 90 to Ready, 70 to Caution, 30 to Not Ready", () => {
    expect(scoreToTier(90)).toBe("Ready");
    expect(scoreToTier(85)).toBe("Ready");
    expect(scoreToTier(70)).toBe("Caution");
    expect(scoreToTier(60)).toBe("Caution");
    expect(scoreToTier(30)).toBe("Not Ready");
  });
});

describe("getCloseReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no match runs. Tests that need runs override this.
    mocked.matchRun.findMany.mockResolvedValue([]);
  });

  it("returns hasData=false when no signals exist", async () => {
    mocked.dataSource.findMany.mockResolvedValue([]);
    mocked.financialRecord.findMany.mockResolvedValue([]);
    const res = await getCloseReadiness("u1", "2026-04");
    expect(res.hasData).toBe(false);
  });

  it("freshnessPenalty is 0 when user has gl + sub_ledger sources + variance FinancialRecords for the period", async () => {
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r1", periodKey: "2026-04", matched: 50, totalGL: 50, totalSub: 50, startedAt: new Date() },
    ]);
    mocked.break.findMany.mockResolvedValue([]);
    // The variance CSV upload path writes DataSource.type="csv" and records
    // the shape in metadata, but stats.ts's freshness check cannot see
    // metadata. The right signal for "does the user have variance data for
    // this period?" is whether FinancialRecord rows exist for that period.
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([
      { category: "OpEx", account: "Marketing", actual: 14200, budget: 11500 },
    ]);
    const res = await getCloseReadiness("u1", "2026-04");
    expect(res.hasData).toBe(true);
    if (res.hasData) {
      expect(res.signals.freshnessPenalty).toBe(0);
    }
  });

  it("freshnessPenalty is 1/3 when gl + sub_ledger present but no variance FinancialRecords", async () => {
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r1", periodKey: "2026-04", matched: 50, totalGL: 50, totalSub: 50, startedAt: new Date() },
    ]);
    mocked.break.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([]);
    const res = await getCloseReadiness("u1", "2026-04");
    expect(res.hasData).toBe(true);
    if (res.hasData) {
      expect(res.signals.freshnessPenalty).toBeCloseTo(1 / 3, 5);
    }
  });

  it("all-green scenario scores 100", async () => {
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r1", periodKey: "2026-04", matched: 50, totalGL: 50, totalSub: 50, startedAt: new Date() },
    ]);
    mocked.break.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
      { type: "variance" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([
      { category: "COGS", actual: 100, budget: 100 },
    ]);
    const res = await getCloseReadiness("u1", "2026-04");
    expect(res.hasData).toBe(true);
    if (res.hasData) {
      expect(res.score).toBe(100);
      expect(res.tier).toBe("Ready");
    }
  });

  it("80% match + 2 old breaks + missing subledger + 1 anomaly → Caution tier", async () => {
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r1", periodKey: "2026-04", matched: 40, totalGL: 50, totalSub: 50, startedAt: new Date() },
    ]);
    mocked.break.findMany.mockResolvedValue([
      { severity: "high", ageDays: 20 },
      { severity: "medium", ageDays: 8 },
    ]);
    mocked.dataSource.findMany.mockResolvedValue([{ type: "gl" }, { type: "variance" }]);
    mocked.financialRecord.findMany.mockResolvedValue([
      { category: "COGS", actual: 130, budget: 100 },
      { category: "Rent", actual: 100, budget: 100 },
    ]);
    const res = await getCloseReadiness("u1", "2026-04");
    expect(res.hasData).toBe(true);
    if (res.hasData) {
      expect(res.score).toBeGreaterThanOrEqual(60);
      expect(res.score).toBeLessThan(85);
      expect(res.tier).toBe("Caution");
      expect(res.narrative).toMatch(/Caution|caution/);
    }
  });

  it("aggregates MatchRuns across monthly keys when periodKey is quarterly", async () => {
    // Recon engine creates one MatchRun per month. A user viewing 2026-Q1
    // should see the combined Jan+Feb+Mar rate, not zero.
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r-jan", periodKey: "2026-01", matched: 6, totalGL: 6, totalSub: 6, startedAt: new Date("2026-02-01") },
      { id: "r-feb", periodKey: "2026-02", matched: 158, totalGL: 158, totalSub: 158, startedAt: new Date("2026-03-01") },
      { id: "r-mar", periodKey: "2026-03", matched: 163, totalGL: 163, totalSub: 166, startedAt: new Date("2026-04-01") },
    ]);
    mocked.break.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
      { type: "variance" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([]);

    const res = await getCloseReadiness("u1", "2026-Q1");
    expect(res.hasData).toBe(true);
    if (res.hasData) {
      // (6+158+163) * 2 / (6+6 + 158+158 + 163+166) = 654 / 657 ≈ 0.995
      expect(res.signals.matchRate).toBeCloseTo(0.995, 2);
      expect(res.score).toBeGreaterThan(90);
    }
  });

  it("unions breaks across monthly MatchRuns in the quarter", async () => {
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r-jan", periodKey: "2026-01", matched: 10, totalGL: 10, totalSub: 10, startedAt: new Date() },
      { id: "r-feb", periodKey: "2026-02", matched: 10, totalGL: 10, totalSub: 12, startedAt: new Date() },
    ]);
    mocked.break.findMany.mockResolvedValue([
      { severity: "high", ageDays: 10 },
      { severity: "medium", ageDays: 5 },
    ]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" }, { type: "sub_ledger" }, { type: "variance" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([]);

    await getCloseReadiness("u1", "2026-Q1");

    // break.findMany should look up breaks across BOTH matchRunIds
    expect(mocked.break.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matchRunId: { in: ["r-jan", "r-feb"] },
          status: "open",
        }),
      })
    );
  });
});

describe("getCloseBlockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.matchRun.findMany.mockResolvedValue([]);
  });

  it("emits break, missing_source, and variance blockers in that order", async () => {
    mocked.matchRun.findMany.mockResolvedValue([{ id: "r1", periodKey: "2026-04", startedAt: new Date() }]);
    mocked.break.findMany.mockResolvedValue([
      {
        id: "b1",
        side: "gl_only",
        entryId: "gl-1",
        baseAmount: 500,
        ageDays: 10,
        severity: "high",
      },
    ]);
    mocked.gLEntry.findMany.mockResolvedValue([{ id: "gl-1", reference: "INV-001" }]);
    mocked.subLedgerEntry.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([{ type: "gl" }]);
    mocked.financialRecord.findMany.mockResolvedValue([
      { category: "COGS", actual: 200, budget: 100 },
    ]);

    const blockers = await getCloseBlockers("u1", "2026-04");
    const kinds = blockers.map((b) => b.kind);

    const firstBreak = kinds.indexOf("break");
    const firstMissing = kinds.indexOf("missing_source");
    const firstVariance = kinds.indexOf("variance");

    expect(firstBreak).toBeGreaterThanOrEqual(0);
    expect(firstMissing).toBeGreaterThan(firstBreak);
    expect(firstVariance).toBeGreaterThan(firstMissing);
  });

  it("looks up GLEntry.reference when side='gl_only' and SubLedgerEntry.reference when side='sub_only'", async () => {
    mocked.matchRun.findMany.mockResolvedValue([{ id: "r1", periodKey: "2026-04", startedAt: new Date() }]);
    mocked.break.findMany.mockResolvedValue([
      {
        id: "b-gl",
        side: "gl_only",
        entryId: "gl-1",
        baseAmount: 100,
        ageDays: 1,
        severity: "low",
      },
      {
        id: "b-sub",
        side: "sub_only",
        entryId: "sub-1",
        baseAmount: 200,
        ageDays: 2,
        severity: "medium",
      },
    ]);
    mocked.gLEntry.findMany.mockResolvedValue([{ id: "gl-1", reference: "GL-REF" }]);
    mocked.subLedgerEntry.findMany.mockResolvedValue([{ id: "sub-1", reference: "SUB-REF" }]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
      { type: "variance" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([]);

    const blockers = await getCloseBlockers("u1", "2026-04");
    const breakBlockers = blockers.filter((b) => b.kind === "break");

    expect(breakBlockers).toHaveLength(2);
    const byId = Object.fromEntries(
      breakBlockers.map((b) => [b.kind === "break" ? b.breakId : "", b])
    );
    expect(byId["b-gl"].kind === "break" && byId["b-gl"].ref).toBe("GL-REF");
    expect(byId["b-sub"].kind === "break" && byId["b-sub"].ref).toBe("SUB-REF");

    expect(mocked.gLEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["gl-1"] } } })
    );
    expect(mocked.subLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["sub-1"] } } })
    );
  });

  it("surfaces one variance row per (category, account) pair, not per record", async () => {
    mocked.matchRun.findFirst.mockResolvedValue(null);
    mocked.break.findMany.mockResolvedValue([]);
    mocked.gLEntry.findMany.mockResolvedValue([]);
    mocked.subLedgerEntry.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
      { type: "variance" },
    ]);
    // Same (Marketing, Digital Ads) appears in two DataSources (user uploaded
    // the same CSV twice). Plus two other Marketing accounts, only one of
    // which is over threshold. Plus a clean account. Expected: 2 blockers
    // (Digital Ads, Contractors) — NOT 4 (no duplicates) and NOT 1 aggregate.
    mocked.financialRecord.findMany.mockResolvedValue([
      { category: "Marketing", account: "Marketing - Digital Ads", actual: 19800, budget: 15100 },
      { category: "Marketing", account: "Marketing - Digital Ads", actual: 19800, budget: 15100 },
      { category: "Marketing", account: "Marketing - Contractors", actual: 12400, budget: 10400 },
      { category: "Marketing", account: "Marketing - Events", actual: 8200, budget: 8000 },
    ]);

    const blockers = await getCloseBlockers("u1", "2026-Q1");
    const variances = blockers.filter((b) => b.kind === "variance");
    expect(variances).toHaveLength(2);
    const keys = variances
      .map((b) => b.kind === "variance" ? `${b.category}|${b.account}` : "")
      .sort();
    expect(keys).toEqual([
      "Marketing|Marketing - Contractors",
      "Marketing|Marketing - Digital Ads",
    ]);
  });

  it("aggregates monthly rows for the same (category, account) into one blocker", async () => {
    mocked.matchRun.findFirst.mockResolvedValue(null);
    mocked.break.findMany.mockResolvedValue([]);
    mocked.gLEntry.findMany.mockResolvedValue([]);
    mocked.subLedgerEntry.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
      { type: "variance" },
    ]);
    // Quarter-level period with three monthly rows (Jan/Feb/Mar) for one
    // (category, account). Each month differs — dedup must NOT collapse them.
    mocked.financialRecord.findMany.mockResolvedValue([
      { category: "OpEx", account: "Legal", actual: 700, budget: 500 },
      { category: "OpEx", account: "Legal", actual: 650, budget: 500 },
      { category: "OpEx", account: "Legal", actual: 750, budget: 500 },
    ]);

    const blockers = await getCloseBlockers("u1", "2026-Q1");
    const variances = blockers.filter((b) => b.kind === "variance");
    expect(variances).toHaveLength(1);
    if (variances[0].kind === "variance") {
      expect(variances[0].category).toBe("OpEx");
      expect(variances[0].account).toBe("Legal");
      // Summed (3 months), pct = (2100-1500)/1500 = 40%
      expect(variances[0].actual).toBe(2100);
      expect(variances[0].budget).toBe(1500);
      expect(variances[0].pct).toBeCloseTo(0.4, 5);
    }
  });

  it("falls back to '(missing)' when the referenced entry was deleted", async () => {
    mocked.matchRun.findMany.mockResolvedValue([{ id: "r1", periodKey: "2026-04", startedAt: new Date() }]);
    mocked.break.findMany.mockResolvedValue([
      {
        id: "b1",
        side: "gl_only",
        entryId: "gl-deleted",
        baseAmount: 50,
        ageDays: 5,
        severity: "low",
      },
    ]);
    mocked.gLEntry.findMany.mockResolvedValue([]);
    mocked.subLedgerEntry.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "sub_ledger" },
      { type: "variance" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([]);

    const blockers = await getCloseBlockers("u1", "2026-04");
    const breakBlocker = blockers.find((b) => b.kind === "break");
    expect(breakBlocker).toBeDefined();
    if (breakBlocker && breakBlocker.kind === "break") {
      expect(breakBlocker.ref).toBe("(missing)");
    }
  });

  it("unions breaks across all MatchRuns in the quarter", async () => {
    mocked.matchRun.findMany.mockResolvedValue([
      { id: "r-jan", periodKey: "2026-01", startedAt: new Date() },
      { id: "r-feb", periodKey: "2026-02", startedAt: new Date() },
      { id: "r-mar", periodKey: "2026-03", startedAt: new Date() },
    ]);
    mocked.break.findMany.mockResolvedValue([
      { id: "b-jan", side: "gl_only", entryId: "gl-1", baseAmount: 100, ageDays: 20, severity: "high" },
      { id: "b-mar", side: "sub_only", entryId: "sub-1", baseAmount: 200, ageDays: 5, severity: "medium" },
    ]);
    mocked.gLEntry.findMany.mockResolvedValue([{ id: "gl-1", reference: "GL-A" }]);
    mocked.subLedgerEntry.findMany.mockResolvedValue([{ id: "sub-1", reference: "SUB-B" }]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" }, { type: "sub_ledger" }, { type: "variance" },
    ]);
    mocked.financialRecord.findMany.mockResolvedValue([]);

    const blockers = await getCloseBlockers("u1", "2026-Q1");
    const breakBlockers = blockers.filter((b) => b.kind === "break");
    expect(breakBlockers).toHaveLength(2);
    expect(mocked.break.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matchRunId: { in: ["r-jan", "r-feb", "r-mar"] },
          status: "open",
        }),
      })
    );
  });
});
