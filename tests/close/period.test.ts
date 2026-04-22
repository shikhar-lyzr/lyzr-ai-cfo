import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    reconPeriod: { findMany: vi.fn() },
    financialRecord: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { listClosePeriods, resolveActivePeriod } from "@/lib/close/period";

const m = prisma as unknown as {
  reconPeriod: { findMany: ReturnType<typeof vi.fn> };
  financialRecord: { findMany: ReturnType<typeof vi.fn> };
};

describe("resolveActivePeriod", () => {
  const periods = [
    { periodKey: "2026-04" },
    { periodKey: "2026-03" },
    { periodKey: "2026-02" },
  ];

  it("returns requested period when it exists in the list", () => {
    expect(resolveActivePeriod(periods, "2026-03")).toBe("2026-03");
  });

  it("falls back to first (most recent) period when requested is missing", () => {
    expect(resolveActivePeriod(periods, "2025-12")).toBe("2026-04");
  });

  it("falls back when no period requested", () => {
    expect(resolveActivePeriod(periods, undefined)).toBe("2026-04");
  });

  it("returns null when list is empty", () => {
    expect(resolveActivePeriod([], "2026-04")).toBeNull();
  });
});

describe("listClosePeriods", () => {
  beforeEach(() => {
    m.reconPeriod.findMany.mockReset();
    m.financialRecord.findMany.mockReset();
  });

  it("tags a period found only in ReconPeriod as source: recon", async () => {
    m.reconPeriod.findMany.mockResolvedValue([{ periodKey: "2026-04" }]);
    m.financialRecord.findMany.mockResolvedValue([]);

    const result = await listClosePeriods("user-1");

    expect(result).toEqual([{ periodKey: "2026-04", source: "recon" }]);
  });

  it("tags a period found only in FinancialRecord as source: records", async () => {
    m.reconPeriod.findMany.mockResolvedValue([]);
    m.financialRecord.findMany.mockResolvedValue([{ period: "2026-03" }]);

    const result = await listClosePeriods("user-1");

    expect(result).toEqual([{ periodKey: "2026-03", source: "records" }]);
  });

  it("tags a period found in both tables as source: both", async () => {
    m.reconPeriod.findMany.mockResolvedValue([{ periodKey: "2026-02" }]);
    m.financialRecord.findMany.mockResolvedValue([{ period: "2026-02" }]);

    const result = await listClosePeriods("user-1");

    expect(result).toEqual([{ periodKey: "2026-02", source: "both" }]);
  });

  it("merges periods across tables and returns them in periodKey-desc order", async () => {
    // Older period only in recon, newer period only in records, middle in both.
    m.reconPeriod.findMany.mockResolvedValue([
      { periodKey: "2026-01" },
      { periodKey: "2026-03" },
    ]);
    m.financialRecord.findMany.mockResolvedValue([
      { period: "2026-04" },
      { period: "2026-03" },
    ]);

    const result = await listClosePeriods("user-1");

    expect(result).toEqual([
      { periodKey: "2026-04", source: "records" },
      { periodKey: "2026-03", source: "both" },
      { periodKey: "2026-01", source: "recon" },
    ]);
  });

  it("scopes both queries by userId", async () => {
    m.reconPeriod.findMany.mockResolvedValue([]);
    m.financialRecord.findMany.mockResolvedValue([]);

    await listClosePeriods("user-xyz");

    expect(m.reconPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-xyz" } })
    );
    expect(m.financialRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dataSource: { userId: "user-xyz" } } })
    );
  });
});
