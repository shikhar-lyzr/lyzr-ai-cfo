import { describe, it, expect } from "vitest";
import { parseGlCsv } from "@/lib/csv/gl-parser";
import type { FXRateInput } from "@/lib/reconciliation/types";

describe("parseGlCsv", () => {
  const baseDate = new Date("2025-01-15");
  const rates: FXRateInput[] = [
    { fromCurrency: "USD", toCurrency: "USD", rate: 1.0, asOf: baseDate },
    { fromCurrency: "EUR", toCurrency: "USD", rate: 1.1, asOf: baseDate },
  ];

  it("parses a 2-row GL CSV with all headers present", async () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    const rows = [
      ["2025-01-15", "2025-01-15", "1000", "REF001", "Test memo", "1000", "USD", "DR", "Vendor A"],
      ["2025-01-16", "2025-01-16", "2000", "REF002", "Test memo 2", "500", "USD", "CR", "Vendor B"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.entries[0]).toEqual({
      entryDate: new Date("2025-01-15"),
      postingDate: new Date("2025-01-15"),
      account: "1000",
      reference: "REF001",
      memo: "Test memo",
      amount: 1000,
      txnCurrency: "USD",
      baseAmount: 1000,
      debitCredit: "DR",
      counterparty: "Vendor A",
    });
  });

  it("skips a row with non-numeric amount", async () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    const rows = [
      ["2025-01-15", "2025-01-15", "1000", "REF001", "Test", "1000", "USD", "DR", "Vendor A"],
      ["2025-01-16", "2025-01-16", "2000", "REF002", "Test", "invalid", "USD", "CR", "Vendor B"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].row).toBe(3); // 1-indexed + header
    expect(result.skipped[0].reason).toMatch(/non-numeric amount/);
  });

  it("throws when required headers missing", async () => {
    const headers = ["entry_date", "account", "reference", "amount"];
    const rows = [["2025-01-15", "1000", "REF001", "1000"]];
    await expect(parseGlCsv(headers, rows, rates)).rejects.toThrow("GL CSV missing required headers");
  });

  it("converts currency using FX rates", async () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    const rows = [
      ["2025-01-15", "2025-01-15", "1000", "REF001", "Test", "100", "EUR", "DR", "Vendor A"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].baseAmount).toBeCloseTo(110, 2); // 100 EUR * 1.1 rate
  });

  it("defaults posting_date to entry_date when missing", async () => {
    const headers = ["entry_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    const rows = [
      ["2025-01-15", "1000", "REF001", "Test", "1000", "USD", "DR", "Vendor A"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].postingDate).toEqual(result.entries[0].entryDate);
  });

  it("defaults memo and counterparty to undefined when missing", async () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "amount", "currency", "debit_credit"];
    const rows = [
      ["2025-01-15", "2025-01-15", "1000", "REF001", "1000", "USD", "DR"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].memo).toBeUndefined();
    expect(result.entries[0].counterparty).toBeUndefined();
  });

  it("normalizes debit_credit to DR or CR", async () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    const rows = [
      ["2025-01-15", "2025-01-15", "1000", "REF001", "Test", "1000", "USD", "DR", "Vendor A"],
      ["2025-01-16", "2025-01-16", "2000", "REF002", "Test", "500", "USD", "CR", "Vendor B"],
      ["2025-01-17", "2025-01-17", "3000", "REF003", "Test", "250", "USD", "cr", "Vendor C"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].debitCredit).toBe("DR");
    expect(result.entries[1].debitCredit).toBe("CR");
    expect(result.entries[2].debitCredit).toBe("CR"); // normalized from lowercase
  });

  it("skips row with bad entry_date", async () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    const rows = [
      ["not-a-date", "2025-01-15", "1000", "REF001", "Test", "1000", "USD", "DR", "Vendor A"],
    ];
    const result = await parseGlCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/bad entry_date/);
  });
});
