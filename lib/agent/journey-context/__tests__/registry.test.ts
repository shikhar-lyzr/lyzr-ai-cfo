import { describe, it, expect, vi, afterEach } from "vitest";
import { buildJourneyContext, JOURNEY_TITLES } from "../index";
import { prisma } from "@/lib/db";
import * as stats from "@/lib/reconciliation/stats";
import * as closeStats from "@/lib/close/stats";
import * as closeTasks from "@/lib/close/tasks";

describe("journey-context registry", () => {
  it("returns null when journeyId is undefined", async () => {
    expect(await buildJourneyContext("user-1", undefined)).toBeNull();
  });

  it("returns null when journeyId is empty string", async () => {
    expect(await buildJourneyContext("user-1", "")).toBeNull();
  });

  it("returns placeholder for unknown journey with the id as title", async () => {
    const out = await buildJourneyContext("user-1", "fake-journey");
    expect(out).toContain("## Current Journey: fake-journey");
    expect(out).toContain("demo placeholder");
  });

  describe("monthly-close context", () => {
    afterEach(() => vi.restoreAllMocks());

    it("returns live readiness + blocker signals, NOT the placeholder", async () => {
      vi.spyOn(closeStats, "getCloseReadiness").mockResolvedValue({
        hasData: true,
        score: 27,
        tier: "Not Ready",
        narrative: "27% — Not Ready. 2 missing data sources; 8 variance anomalies.",
        signals: { matchRate: 0, openBreakPenalty: 0, freshnessPenalty: 0.67, variancePenalty: 1 },
      } as any);
      vi.spyOn(closeStats, "getCloseBlockers").mockResolvedValue([
        { kind: "missing_source", sourceType: "sub_ledger" },
        { kind: "missing_source", sourceType: "variance" },
        {
          kind: "variance",
          category: "G&A",
          account: "G&A - Legal",
          actual: 15600,
          budget: 8000,
          pct: 0.95,
        },
      ] as any);
      vi.spyOn(closeTasks, "deriveTaskCounts").mockResolvedValue([] as any);

      const out = await buildJourneyContext("user-1", "monthly-close", "2026-Q1");

      expect(out).toContain("## Current Journey: Monthly Close");
      expect(out).toContain("2026-Q1");
      expect(out).toContain("27%");
      expect(out).toContain("Not Ready");
      expect(out).toContain("G&A - Legal");
      expect(out).not.toContain("demo placeholder");
      expect(out).not.toContain("no live backing data");
    });

    it("falls back to an empty-state message when no data exists for the period", async () => {
      vi.spyOn(closeStats, "getCloseReadiness").mockResolvedValue({ hasData: false } as any);
      vi.spyOn(closeStats, "getCloseBlockers").mockResolvedValue([] as any);
      vi.spyOn(closeTasks, "deriveTaskCounts").mockResolvedValue([] as any);

      const out = await buildJourneyContext("user-1", "monthly-close", "2026-05");

      expect(out).toContain("Monthly Close");
      expect(out).toContain("2026-05");
      expect(out).not.toContain("demo placeholder");
    });
  });

  describe("financial-reconciliation newest-period fallback", () => {
    afterEach(() => vi.restoreAllMocks());

    it("resolves periodKey from newest ReconPeriod when none passed", async () => {
      const findFirstSpy = vi
        .spyOn(prisma.reconPeriod, "findFirst")
        .mockResolvedValue({ periodKey: "2026-03" } as any);
      vi.spyOn(stats, "getReconciliationStats").mockResolvedValue({ hasData: false } as any);
      vi.spyOn(stats, "getTopBreaks").mockResolvedValue([] as any);

      const out = await buildJourneyContext("user-1", "financial-reconciliation");

      expect(findFirstSpy).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(out).toContain("2026-03");
    });
  });

  describe("regulatory-capital context", () => {
    afterEach(() => vi.restoreAllMocks());

    it("returns live snapshot + breaches, NOT the placeholder", async () => {
      const capitalStats = await import("@/lib/capital/stats");
      vi.spyOn(capitalStats, "getCapitalSnapshot").mockResolvedValue({
        hasData: true,
        cet1Ratio: 0.132,
        tier1Ratio: 0.151,
        totalRatio: 0.178,
        cet1Capital: 12_400_000_000,
        tier1Capital: 13_900_000_000,
        totalCapital: 16_400_000_000,
        totalRwa: 93_900_000_000,
        rwaMismatch: null,
      } as any);
      vi.spyOn(capitalStats, "getCapitalBreaches").mockResolvedValue([] as any);
      vi.spyOn(capitalStats, "getRwaBreakdown").mockResolvedValue([
        { riskType: "credit", totalRwa: 78_000_000_000, share: 0.83, lineCount: 4, lines: [] },
        { riskType: "market", totalRwa: 9_100_000_000, share: 0.097, lineCount: 2, lines: [] },
        { riskType: "operational", totalRwa: 6_800_000_000, share: 0.072, lineCount: 1, lines: [] },
      ] as any);

      const out = await buildJourneyContext("user-1", "regulatory-capital", "2026-Q1");

      expect(out).toContain("Regulatory Capital");
      expect(out).toContain("2026-Q1");
      expect(out).toContain("CET1");
      expect(out).toContain("13.2%");
      expect(out).toContain("credit");
      expect(out).not.toContain("demo placeholder");
    });

    it("empty-state message when no capital data for the period", async () => {
      const capitalStats = await import("@/lib/capital/stats");
      vi.spyOn(capitalStats, "getCapitalSnapshot").mockResolvedValue({ hasData: false } as any);
      vi.spyOn(capitalStats, "getCapitalBreaches").mockResolvedValue([
        { kind: "missing_source", sourceType: "capital_components" },
      ] as any);
      vi.spyOn(capitalStats, "getRwaBreakdown").mockResolvedValue([] as any);

      const out = await buildJourneyContext("user-1", "regulatory-capital", "2026-Q1");

      expect(out).toContain("Regulatory Capital");
      expect(out).toContain("2026-Q1");
      expect(out).toContain("/data-sources?tab=capital");
      expect(out).not.toContain("demo placeholder");
    });
  });

  it("exports JOURNEY_TITLES for all six known journeys", () => {
    expect(JOURNEY_TITLES["financial-reconciliation"]).toBe("Financial Reconciliation");
    expect(JOURNEY_TITLES["monthly-close"]).toBe("Monthly Close");
    expect(JOURNEY_TITLES["daily-liquidity"]).toBe("Daily Liquidity");
    expect(JOURNEY_TITLES["ifrs9-ecl"]).toBe("IFRS 9 ECL");
    expect(JOURNEY_TITLES["regulatory-capital"]).toBe("Regulatory Capital");
    expect(JOURNEY_TITLES["regulatory-returns"]).toBe("Regulatory Returns");
  });
});
