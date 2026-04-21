import { describe, it, expect, vi, afterEach } from "vitest";
import { buildJourneyContext, JOURNEY_TITLES } from "../index";
import { prisma } from "@/lib/db";
import * as stats from "@/lib/reconciliation/stats";

describe("journey-context registry", () => {
  it("returns null when journeyId is undefined", async () => {
    expect(await buildJourneyContext("user-1", undefined)).toBeNull();
  });

  it("returns null when journeyId is empty string", async () => {
    expect(await buildJourneyContext("user-1", "")).toBeNull();
  });

  it("returns placeholder for known static journey", async () => {
    const out = await buildJourneyContext("user-1", "monthly-close");
    expect(out).toContain("## Current Journey: Monthly Close");
    expect(out).toContain("demo placeholder");
  });

  it("returns placeholder for unknown journey with the id as title", async () => {
    const out = await buildJourneyContext("user-1", "fake-journey");
    expect(out).toContain("## Current Journey: fake-journey");
    expect(out).toContain("demo placeholder");
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

  it("exports JOURNEY_TITLES for all six known journeys", () => {
    expect(JOURNEY_TITLES["financial-reconciliation"]).toBe("Financial Reconciliation");
    expect(JOURNEY_TITLES["monthly-close"]).toBe("Monthly Close");
    expect(JOURNEY_TITLES["daily-liquidity"]).toBe("Daily Liquidity");
    expect(JOURNEY_TITLES["ifrs9-ecl"]).toBe("IFRS 9 ECL");
    expect(JOURNEY_TITLES["regulatory-capital"]).toBe("Regulatory Capital");
    expect(JOURNEY_TITLES["regulatory-returns"]).toBe("Regulatory Returns");
  });
});
