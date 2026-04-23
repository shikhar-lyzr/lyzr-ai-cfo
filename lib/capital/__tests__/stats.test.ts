import { describe, it, expect } from "vitest";
import {
  computeSnapshot,
  dedupeComponents,
  type ComponentInput,
  type RwaLineInput,
} from "../stats";

describe("dedupeComponents", () => {
  it("drops exact duplicates on (periodKey, component, amount, currency)", () => {
    const rows: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 50, currency: "USD" },
    ];
    expect(dedupeComponents(rows)).toHaveLength(2);
  });

  it("keeps legitimate multi-row entries (same component, different amounts)", () => {
    const rows: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "goodwill", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "goodwill", amount: 200, currency: "USD" },
    ];
    expect(dedupeComponents(rows)).toHaveLength(2);
  });
});

describe("computeSnapshot", () => {
  const baseComponents: ComponentInput[] = [
    { periodKey: "2026-Q1", component: "cet1_capital", amount: 12_400_000_000, currency: "USD" },
    { periodKey: "2026-Q1", component: "additional_tier1", amount: 1_500_000_000, currency: "USD" },
    { periodKey: "2026-Q1", component: "tier2", amount: 2_500_000_000, currency: "USD" },
    { periodKey: "2026-Q1", component: "total_rwa", amount: 93_900_000_000, currency: "USD" },
  ];

  it("computes ratios on the happy path (no deductions, no RWA lines)", () => {
    const snap = computeSnapshot(baseComponents, []);
    expect(snap.hasData).toBe(true);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.cet1Capital).toBe(12_400_000_000);
    expect(snap.tier1Capital).toBe(13_900_000_000);
    expect(snap.totalCapital).toBe(16_400_000_000);
    expect(snap.totalRwa).toBe(93_900_000_000);
    expect(snap.cet1Ratio).toBeCloseTo(0.132, 3);
    expect(snap.tier1Ratio).toBeCloseTo(0.148, 4);
    expect(snap.totalRatio).toBeCloseTo(0.1747, 4);
    expect(snap.rwaMismatch).toBeNull();
  });

  it("subtracts deductions from CET1", () => {
    const with_deductions: ComponentInput[] = [
      ...baseComponents,
      { periodKey: "2026-Q1", component: "goodwill", amount: 800_000_000, currency: "USD" },
      { periodKey: "2026-Q1", component: "dta", amount: 300_000_000, currency: "USD" },
    ];
    const snap = computeSnapshot(with_deductions, []);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.cet1Capital).toBe(12_400_000_000 - 800_000_000 - 300_000_000);
    expect(snap.tier1Capital).toBe(snap.cet1Capital + 1_500_000_000);
  });

  it("returns hasData:false when totalRwa is 0", () => {
    const noRwa: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
    ];
    expect(computeSnapshot(noRwa, []).hasData).toBe(false);
  });

  it("returns hasData:false when components list is empty", () => {
    expect(computeSnapshot([], []).hasData).toBe(false);
  });

  it("dedupes before aggregating", () => {
    const duplicated: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "total_rwa", amount: 1000, currency: "USD" },
    ];
    const snap = computeSnapshot(duplicated, []);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.cet1Capital).toBe(100);
  });

  it("flags RWA mismatch > 1% when both sources disagree", () => {
    const rwaLines: RwaLineInput[] = [
      { periodKey: "2026-Q1", riskType: "credit", exposureClass: "x", exposureAmount: 0, riskWeight: 0, rwa: 80_000_000_000 },
      { periodKey: "2026-Q1", riskType: "market", exposureClass: "y", exposureAmount: 0, riskWeight: 0, rwa: 5_000_000_000 },
    ];
    // capital says 93.9B, rwa lines sum to 85B → ~9.5% gap.
    const snap = computeSnapshot(baseComponents, rwaLines);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.rwaMismatch).not.toBeNull();
    expect(snap.rwaMismatch!.capitalTotal).toBe(93_900_000_000);
    expect(snap.rwaMismatch!.rwaLineTotal).toBe(85_000_000_000);
    expect(snap.rwaMismatch!.deltaPct).toBeGreaterThan(0.09);
  });

  it("does NOT flag mismatch when sources agree within 1%", () => {
    const rwaLines: RwaLineInput[] = [
      { periodKey: "2026-Q1", riskType: "credit", exposureClass: "x", exposureAmount: 0, riskWeight: 0, rwa: 93_500_000_000 },
    ];
    // 93.5B vs 93.9B → 0.43% gap — below threshold.
    const snap = computeSnapshot(baseComponents, rwaLines);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.rwaMismatch).toBeNull();
  });

  it("always prefers capital_components total_rwa for ratios, ignoring RWA lines", () => {
    const rwaLines: RwaLineInput[] = [
      { periodKey: "2026-Q1", riskType: "credit", exposureClass: "x", exposureAmount: 0, riskWeight: 0, rwa: 50_000_000_000 },
    ];
    const snap = computeSnapshot(baseComponents, rwaLines);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.totalRwa).toBe(93_900_000_000);
  });
});
