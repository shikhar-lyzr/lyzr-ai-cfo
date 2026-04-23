import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    subLedgerEntry: { count: vi.fn() },
    gLEntry: { count: vi.fn() },
    document: { findFirst: vi.fn() },
    journalAdjustment: { count: vi.fn() },
    matchRun: { findFirst: vi.fn(), findMany: vi.fn() },
    break: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { deriveTaskCounts } from "@/lib/close/tasks";

const m = prisma as unknown as {
  subLedgerEntry: { count: ReturnType<typeof vi.fn> };
  gLEntry: { count: ReturnType<typeof vi.fn> };
  document: { findFirst: ReturnType<typeof vi.fn> };
  journalAdjustment: { count: ReturnType<typeof vi.fn> };
  matchRun: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  break: { count: ReturnType<typeof vi.fn> };
};

describe("deriveTaskCounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces 5 cards with concrete counts", async () => {
    m.subLedgerEntry.count.mockResolvedValueOnce(8).mockResolvedValueOnce(10);
    m.gLEntry.count.mockResolvedValueOnce(9).mockResolvedValueOnce(10);
    m.document.findFirst.mockResolvedValue({ id: "d1" });
    m.journalAdjustment.count.mockResolvedValue(2);
    m.matchRun.findMany.mockResolvedValue([{ id: "r1" }]);
    m.break.count.mockResolvedValue(3);

    const cards = await deriveTaskCounts("u1", "2026-04");
    expect(cards).toHaveLength(5);
    expect(cards[0]).toMatchObject({ key: "subledger", completed: 8, total: 10 });
    expect(cards[1]).toMatchObject({ key: "gl", completed: 9, total: 10 });
    expect(cards[2]).toMatchObject({ key: "variance", completed: 1, total: 1 });
    expect(cards[3]).toMatchObject({ key: "journal", completed: 2, total: 3 });
    expect(cards[4]).toMatchObject({ key: "package", completed: 1, total: 1 });
  });

  it("empty-state variant when total=0", async () => {
    m.subLedgerEntry.count.mockResolvedValue(0);
    m.gLEntry.count.mockResolvedValue(0);
    m.document.findFirst.mockResolvedValue(null);
    m.journalAdjustment.count.mockResolvedValue(0);
    m.matchRun.findMany.mockResolvedValue([]);
    m.break.count.mockResolvedValue(0);

    const cards = await deriveTaskCounts("u1", "2026-04");
    expect(cards[0]).toMatchObject({ key: "subledger", completed: 0, total: 0, isEmpty: true });
    expect(cards[3]).toMatchObject({ key: "journal", completed: 0, total: 0, isEmpty: true });
    expect(cards[4]).toMatchObject({ key: "package", completed: 0, total: 1 });
  });

  it("queries with expanded monthly keys when periodKey is a quarter", async () => {
    m.subLedgerEntry.count.mockResolvedValue(0);
    m.gLEntry.count.mockResolvedValue(0);
    m.document.findFirst.mockResolvedValue(null);
    m.journalAdjustment.count.mockResolvedValue(0);
    m.matchRun.findMany.mockResolvedValue([]);
    m.break.count.mockResolvedValue(0);

    await deriveTaskCounts("u1", "2026-Q1");

    // GL/Sub counts must use `periodKey: { in: [...3 months] }`
    expect(m.subLedgerEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodKey: { in: ["2026-01", "2026-02", "2026-03"] },
        }),
      })
    );
    expect(m.gLEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodKey: { in: ["2026-01", "2026-02", "2026-03"] },
        }),
      })
    );
  });

  it("scopes journal adjustments to the period's date range", async () => {
    m.subLedgerEntry.count.mockResolvedValue(0);
    m.gLEntry.count.mockResolvedValue(0);
    m.document.findFirst.mockResolvedValue(null);
    m.journalAdjustment.count.mockResolvedValue(0);
    m.matchRun.findMany.mockResolvedValue([]);
    m.break.count.mockResolvedValue(0);

    await deriveTaskCounts("u1", "2026-Q1");

    expect(m.journalAdjustment.count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        entryDate: {
          gte: new Date(Date.UTC(2026, 0, 1)),
          lt: new Date(Date.UTC(2026, 3, 1)),
        },
      },
    });
  });

  it("omits date filter on journal adjustments when period cannot be mapped to months", async () => {
    m.subLedgerEntry.count.mockResolvedValue(0);
    m.gLEntry.count.mockResolvedValue(0);
    m.document.findFirst.mockResolvedValue(null);
    m.journalAdjustment.count.mockResolvedValue(0);
    m.matchRun.findMany.mockResolvedValue([]);
    m.break.count.mockResolvedValue(0);

    await deriveTaskCounts("u1", "FY26");

    expect(m.journalAdjustment.count).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });
});
