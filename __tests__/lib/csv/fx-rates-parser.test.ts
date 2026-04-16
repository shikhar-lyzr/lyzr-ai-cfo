import { describe, it, expect } from "vitest";
import { parseFxRatesCsv } from "@/lib/csv/fx-rates-parser";

describe("parseFxRatesCsv", () => {
  it("parses a 2-row FX CSV with all valid headers", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["USD", "EUR", "0.92", "2025-01-15"],
      ["EUR", "USD", "1.09", "2025-01-15"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: 0.92,
      asOf: new Date("2025-01-15"),
    });
    expect(result[1]).toEqual({
      fromCurrency: "EUR",
      toCurrency: "USD",
      rate: 1.09,
      asOf: new Date("2025-01-15"),
    });
  });

  it("throws on missing required headers", () => {
    const headers = ["from_currency", "to_currency", "rate"];
    const rows = [["USD", "EUR", "0.92"]];
    expect(() => parseFxRatesCsv(headers, rows)).toThrow("FX CSV missing required headers");
  });

  it("skips rows with bad rate", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["USD", "EUR", "0.92", "2025-01-15"],
      ["EUR", "USD", "invalid", "2025-01-15"],
      ["GBP", "USD", "1.27", "2025-01-15"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result).toHaveLength(2);
    expect(result[0].fromCurrency).toBe("USD");
    expect(result[1].fromCurrency).toBe("GBP");
  });

  it("skips rows with bad date", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["USD", "EUR", "0.92", "2025-01-15"],
      ["EUR", "USD", "1.09", "not-a-date"],
      ["GBP", "USD", "1.27", "2025-01-16"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result).toHaveLength(2);
    expect(result[0].fromCurrency).toBe("USD");
    expect(result[1].fromCurrency).toBe("GBP");
  });

  it("normalizes currency codes to uppercase", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["usd", "eur", "0.92", "2025-01-15"],
      ["EUR", "usd", "1.09", "2025-01-15"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result).toHaveLength(2);
    expect(result[0].fromCurrency).toBe("USD");
    expect(result[0].toCurrency).toBe("EUR");
    expect(result[1].fromCurrency).toBe("EUR");
    expect(result[1].toCurrency).toBe("USD");
  });

  it("handles empty rows array", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows: string[][] = [];
    const result = parseFxRatesCsv(headers, rows);
    expect(result).toHaveLength(0);
  });

  it("parses decimal rates correctly", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["USD", "JPY", "110.5", "2025-01-15"],
      ["USD", "CHF", "0.884", "2025-01-15"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result).toHaveLength(2);
    expect(result[0].rate).toBe(110.5);
    expect(result[1].rate).toBe(0.884);
  });
});
