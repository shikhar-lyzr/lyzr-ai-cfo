import { describe, it, expect } from "vitest";
import { autoDetectArColumns, parseArCsv } from "@/lib/csv/ar-parser";

describe("autoDetectArColumns", () => {
  it("detects standard AR headers", () => {
    const headers = ["invoice number", "customer", "customer email", "amount", "invoice date", "due date"];
    const mapping = autoDetectArColumns(headers);
    expect(mapping.invoiceNumber).toBe(0);
    expect(mapping.customer).toBe(1);
    expect(mapping.customerEmail).toBe(2);
    expect(mapping.amount).toBe(3);
    expect(mapping.invoiceDate).toBe(4);
    expect(mapping.dueDate).toBe(5);
  });

  it("detects alternative header names", () => {
    const headers = ["inv_no", "client", "balance", "issue_date", "payment_due"];
    const mapping = autoDetectArColumns(headers);
    expect(mapping.invoiceNumber).toBe(0);
    expect(mapping.customer).toBe(1);
    expect(mapping.amount).toBe(2);
    expect(mapping.invoiceDate).toBe(3);
    expect(mapping.dueDate).toBe(4);
  });

  it("detects email before customer to avoid 'customer email' matching customer", () => {
    const headers = ["inv#", "customer email", "customer", "amount due", "invoice date", "due date"];
    const mapping = autoDetectArColumns(headers);
    expect(mapping.customerEmail).toBe(1);
    expect(mapping.customer).toBe(2);
  });
});

describe("parseArCsv", () => {
  const stdHeaders = ["invoice number", "customer", "customer email", "amount", "invoice date", "due date"];

  it("parses valid rows", async () => {
    const rows = [
      ["INV-1001", "Acme Corp", "billing@acme.com", "12500.00", "2026-02-15", "2026-03-01"],
      ["INV-1002", "Beta Inc", "", "8750", "2026-02-20", "2026-03-06"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.invoices).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.invoices[0].invoiceNumber).toBe("INV-1001");
    expect(result.invoices[0].amount).toBe(12500);
    expect(result.invoices[0].customerEmail).toBe("billing@acme.com");
    expect(result.invoices[1].customerEmail).toBeUndefined();
  });

  it("skips rows with missing required fields", async () => {
    const rows = [
      ["", "Acme Corp", "", "12500", "2026-02-15", "2026-03-01"],
      ["INV-1002", "", "", "8750", "2026-02-20", "2026-03-06"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.invoices).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].reason).toBe("missing_required_field");
    expect(result.skipped[1].reason).toBe("missing_required_field");
  });

  it("skips rows with negative amounts", async () => {
    const rows = [
      ["INV-1001", "Acme Corp", "", "-500", "2026-02-15", "2026-03-01"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.invoices).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("negative_amount");
  });

  it("skips rows with unparseable amounts", async () => {
    const rows = [
      ["INV-1001", "Acme Corp", "", "not-a-number", "2026-02-15", "2026-03-01"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.invoices).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("invalid_amount");
  });

  it("skips rows with unparseable dates", async () => {
    const rows = [
      ["INV-1001", "Acme Corp", "", "1000", "not-a-date", "2026-03-01"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.invoices).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("unparseable_date");
  });

  it("handles dollar signs and commas in amounts", async () => {
    const rows = [
      ["INV-1001", "Acme Corp", "", "$12,500.00", "2026-02-15", "2026-03-01"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0].amount).toBe(12500);
  });

  it("returns correct row numbers in skip reasons (1-indexed + header)", async () => {
    const rows = [
      ["INV-1001", "Acme Corp", "", "1000", "2026-02-15", "2026-03-01"],
      ["", "Bad Row", "", "500", "2026-02-20", "2026-03-06"],
    ];

    const result = await parseArCsv(stdHeaders, rows);
    expect(result.skipped[0].row).toBe(3); // row index 1 + 2 (header + 1-indexed)
  });
});
