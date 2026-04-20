import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildReconciliationContext } from "./financial-reconciliation";
import * as stats from "../../reconciliation/stats";

describe("buildReconciliationContext", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns empty-period copy when hasData is false", async () => {
    vi.spyOn(stats, "getReconciliationStats").mockResolvedValue({ hasData: false });
    vi.spyOn(stats, "getTopBreaks").mockResolvedValue([]);
    const ctx = await buildReconciliationContext("u1", "2026-04");
    expect(ctx).toContain("2026-04");
    expect(ctx.toLowerCase()).toMatch(/no data|waiting|upload/);
  });

  it("includes the period key in the header when data exists", async () => {
    vi.spyOn(stats, "getReconciliationStats").mockResolvedValue({
      hasData: true, matchRate: 0.95, openBreakCount: 2, openBreakValue: 100,
      oldestBreakDays: 3, glOnly: 0, subOnly: 0, lastRunAt: new Date(),
    } as any);
    vi.spyOn(stats, "getTopBreaks").mockResolvedValue([] as any);
    const ctx = await buildReconciliationContext("u1", "2026-04");
    expect(ctx).toContain("2026-04");
    expect(ctx).toMatch(/95/);
  });
});
