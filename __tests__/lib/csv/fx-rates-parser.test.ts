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
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0]).toEqual({
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: 0.92,
      asOf: new Date("2025-01-15"),
    });
    expect(result.rates[1]).toEqual({
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
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0].fromCurrency).toBe("USD");
    expect(result.rates[1].fromCurrency).toBe("GBP");
  });

  it("skips rows with bad date", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["USD", "EUR", "0.92", "2025-01-15"],
      ["EUR", "USD", "1.09", "not-a-date"],
      ["GBP", "USD", "1.27", "2025-01-16"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0].fromCurrency).toBe("USD");
    expect(result.rates[1].fromCurrency).toBe("GBP");
  });

  it("normalizes currency codes to uppercase", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["usd", "eur", "0.92", "2025-01-15"],
      ["EUR", "usd", "1.09", "2025-01-15"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0].fromCurrency).toBe("USD");
    expect(result.rates[0].toCurrency).toBe("EUR");
    expect(result.rates[1].fromCurrency).toBe("EUR");
    expect(result.rates[1].toCurrency).toBe("USD");
  });

  it("handles empty rows array", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows: string[][] = [];
    const result = parseFxRatesCsv(headers, rows);
    expect(result.rates).toHaveLength(0);
  });

  it("parses decimal rates correctly", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["USD", "JPY", "110.5", "2025-01-15"],
      ["USD", "CHF", "0.884", "2025-01-15"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0].rate).toBe(110.5);
    expect(result.rates[1].rate).toBe(0.884);
  });

  it("puts unparseable rows into skipped[] with row number + reason", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["EUR", "USD", "1.08", "2026-04-01"],
      ["GBP", "USD", "not-a-number", "2026-04-01"],
      ["JPY", "USD", "0.0066", "not-a-date"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result.rates).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].row).toBe(3);
    expect(result.skipped[0].reason).toContain("rate");
    expect(result.skipped[1].row).toBe(4);
    expect(result.skipped[1].reason).toContain("as_of");
  });
});
