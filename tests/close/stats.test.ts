import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    matchRun: { findFirst: vi.fn() },
    break: { findMany: vi.fn() },
    dataSource: { findMany: vi.fn() },
    financialRecord: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getCloseReadiness, scoreToTier } from "@/lib/close/stats";

const mocked = prisma as unknown as {
  matchRun: { findFirst: ReturnType<typeof vi.fn> };
  break: { findMany: ReturnType<typeof vi.fn> };
  dataSource: { findMany: ReturnType<typeof vi.fn> };
  financialRecord: { findMany: ReturnType<typeof vi.fn> };
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
