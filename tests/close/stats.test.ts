import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    matchRun: { findFirst: vi.fn() },
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
  matchRun: { findFirst: ReturnType<typeof vi.fn> };
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
  });

  it("returns hasData=false when no signals exist", async () => {
    mocked.matchRun.findFirst.mockResolvedValue(null);
    mocked.dataSource.findMany.mockResolvedValue([]);
    mocked.financialRecord.findMany.mockResolvedValue([]);
    const res = await getCloseReadiness("u1", "2026-04");
    expect(res.hasData).toBe(false);
  });

  it("all-green scenario scores 100", async () => {
    mocked.matchRun.findFirst.mockResolvedValue({
      id: "r1",
      matched: 50,
      totalGL: 50,
      totalSub: 50,
    });
    mocked.break.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([
      { type: "gl" },
      { type: "subledger" },
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
    mocked.matchRun.findFirst.mockResolvedValue({
      id: "r1",
      matched: 40,
      totalGL: 50,
      totalSub: 50,
    });
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
});

describe("getCloseBlockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits break, missing_source, and variance blockers in that order", async () => {
    mocked.matchRun.findFirst.mockResolvedValue({ id: "r1" });
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
    mocked.matchRun.findFirst.mockResolvedValue({ id: "r1" });
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
      { type: "subledger" },
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

  it("falls back to '(missing)' when the referenced entry was deleted", async () => {
    mocked.matchRun.findFirst.mockResolvedValue({ id: "r1" });
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
      { type: "subledger" },
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
});
