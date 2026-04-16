import { describe, it, expect } from "vitest";
import { convert } from "../fx";
import type { FXRateInput } from "../types";

const RATES: FXRateInput[] = [
  { fromCurrency: "EUR", toCurrency: "USD", rate: 1.1, asOf: new Date("2026-01-01") },
  { fromCurrency: "EUR", toCurrency: "USD", rate: 1.08, asOf: new Date("2026-03-01") },
  { fromCurrency: "GBP", toCurrency: "USD", rate: 1.25, asOf: new Date("2026-01-01") },
];

describe("convert", () => {
  it("returns the same amount when fromCurrency === toCurrency", () => {
    expect(convert(100, "USD", "USD", new Date("2026-02-01"), RATES)).toBe(100);
  });

  it("converts EUR→USD using the nearest earlier rate", () => {
    expect(convert(100, "EUR", "USD", new Date("2026-02-01"), RATES)).toBeCloseTo(110);
    expect(convert(100, "EUR", "USD", new Date("2026-03-15"), RATES)).toBeCloseTo(108);
  });

  it("throws when no rate exists on or before asOf", () => {
    expect(() => convert(100, "EUR", "USD", new Date("2025-12-01"), RATES))
      .toThrow(/no FX rate/i);
  });

  it("throws when currency pair is unknown", () => {
    expect(() => convert(100, "JPY", "USD", new Date("2026-02-01"), RATES))
      .toThrow(/no FX rate/i);
  });
});
