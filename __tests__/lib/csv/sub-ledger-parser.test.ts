import { describe, it, expect } from "vitest";
import { parseSubLedgerCsv } from "@/lib/csv/sub-ledger-parser";
import type { FXRateInput } from "@/lib/reconciliation/types";

describe("parseSubLedgerCsv", () => {
  const baseDate = new Date("2025-01-15");
  const rates: FXRateInput[] = [
    { fromCurrency: "USD", toCurrency: "USD", rate: 1.0, asOf: baseDate },
    { fromCurrency: "EUR", toCurrency: "USD", rate: 1.1, asOf: baseDate },
  ];

  it("parses a 2-row sub-ledger CSV with all headers present", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    const rows = [
      ["2025-01-15", "1000", "AP", "REF001", "Test memo", "1000", "USD", "Vendor A"],
      ["2025-01-16", "2000", "AR", "REF002", "Test memo 2", "500", "USD", "Customer B"],
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.entries[0]).toEqual({
      entryDate: new Date("2025-01-15"),
      sourceModule: "AP",
      account: "1000",
      reference: "REF001",
      memo: "Test memo",
      amount: 1000,
      txnCurrency: "USD",
      baseAmount: 1000,
      counterparty: "Vendor A",
    });
    expect(result.entries[1].sourceModule).toBe("AR");
  });

  it("skips a row with non-numeric amount", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    const rows = [
      ["2025-01-15", "1000", "AP", "REF001", "Test", "1000", "USD", "Vendor A"],
      ["2025-01-16", "2000", "AP", "REF002", "Test", "invalid", "USD", "Vendor B"],
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].row).toBe(3); // 1-indexed + header
    expect(result.skipped[0].reason).toMatch(/non-numeric amount/);
  });

  it("throws when required headers missing", async () => {
    const headers = ["entry_date", "account", "reference", "amount"];
    const rows = [["2025-01-15", "1000", "REF001", "1000"]];
    await expect(parseSubLedgerCsv(headers, rows, rates)).rejects.toThrow("Sub-ledger CSV missing required headers");
  });

  it("converts currency using FX rates", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    const rows = [
      ["2025-01-15", "1000", "AP", "REF001", "Test", "100", "EUR", "Vendor A"],
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].baseAmount).toBeCloseTo(110, 2); // 100 EUR * 1.1 rate
  });

  it("defaults memo and counterparty to undefined when missing", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "amount", "currency"];
    const rows = [
      ["2025-01-15", "1000", "AP", "REF001", "1000", "USD"],
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].memo).toBeUndefined();
    expect(result.entries[0].counterparty).toBeUndefined();
  });

  it("normalizes source_module to AP/AR/FA", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    const rows = [
      ["2025-01-15", "1000", "AP", "REF001", "Test", "1000", "USD", "Vendor A"],
      ["2025-01-16", "2000", "AR", "REF002", "Test", "500", "USD", "Customer B"],
      ["2025-01-17", "3000", "FA", "REF003", "Test", "250", "USD", "Bank"],
      ["2025-01-18", "4000", "UNKNOWN", "REF004", "Test", "100", "USD", "Other"], // should default to AP
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(4);
    expect(result.entries[0].sourceModule).toBe("AP");
    expect(result.entries[1].sourceModule).toBe("AR");
    expect(result.entries[2].sourceModule).toBe("FA");
    expect(result.entries[3].sourceModule).toBe("AP"); // unknown defaults to AP
  });

  it("skips row with bad entry_date", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    const rows = [
      ["not-a-date", "1000", "AP", "REF001", "Test", "1000", "USD", "Vendor A"],
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/bad entry_date/);
  });

  it("defaults source_module to AP when missing value", async () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    const rows = [
      ["2025-01-15", "1000", "", "REF001", "Test", "1000", "USD", "Vendor A"],
    ];
    const result = await parseSubLedgerCsv(headers, rows, rates);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].sourceModule).toBe("AP");
  });
});
