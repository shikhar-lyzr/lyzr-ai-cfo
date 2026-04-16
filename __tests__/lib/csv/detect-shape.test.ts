import { describe, it, expect } from "vitest";
import { detectFastPath } from "@/lib/csv/detect-shape";

describe("detectFastPath", () => {
  it("classifies standard AR headers as 'ar'", () => {
    const headers = ["invoice number", "customer", "customer email", "amount", "invoice date", "due date"];
    expect(detectFastPath(headers)).toBe("ar");
  });

  it("classifies invoice + due date as 'ar' (2 signals)", () => {
    const headers = ["inv_no", "name", "balance", "due_date"];
    expect(detectFastPath(headers)).toBe("ar");
  });

  it("classifies invoice alone as 'unknown' (only 1 signal)", () => {
    const headers = ["invoice_id", "description", "total"];
    expect(detectFastPath(headers)).toBe("unknown");
  });

  it("classifies standard variance headers as 'variance'", () => {
    const headers = ["account", "period", "actual", "budget", "category"];
    expect(detectFastPath(headers)).toBe("variance");
  });

  it("classifies budget + forecast as 'variance'", () => {
    const headers = ["line item", "month", "spent", "forecast"];
    expect(detectFastPath(headers)).toBe("variance");
  });

  it("returns 'unknown' for ambiguous headers", () => {
    const headers = ["id", "name", "value", "date"];
    expect(detectFastPath(headers)).toBe("unknown");
  });

  it("returns 'unknown' for empty headers", () => {
    expect(detectFastPath([])).toBe("unknown");
  });

  it("handles mixed-case headers", () => {
    const headers = ["Invoice Number", "CUSTOMER", "Amount Due", "Due Date"];
    expect(detectFastPath(headers)).toBe("ar");
  });

  it("recognizes debtor as a customer signal", () => {
    const headers = ["inv_number", "debtor", "amount_outstanding", "payment_due"];
    expect(detectFastPath(headers)).toBe("ar");
  });

  it("prefers AR over variance when both signals present", () => {
    // Edge case: has both sets of signals. Invoice+dueDate+customer = 3 AR signals
    const headers = ["invoice_number", "customer", "actual", "budget", "due_date"];
    expect(detectFastPath(headers)).toBe("ar");
  });

  it("classifies GL headers as 'gl'", () => {
    const headers = ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"];
    expect(detectFastPath(headers)).toBe("gl");
  });

  it("classifies debit-credit variant as 'gl'", () => {
    const headers = ["date", "account", "debit credit", "amount", "description"];
    expect(detectFastPath(headers)).toBe("gl");
  });

  it("classifies sub-ledger headers as 'sub_ledger'", () => {
    const headers = ["entry_date", "account", "source_module", "reference", "memo", "amount", "currency", "counterparty"];
    expect(detectFastPath(headers)).toBe("sub_ledger");
  });

  it("classifies source module variant as 'sub_ledger'", () => {
    const headers = ["date", "account", "source module", "description"];
    expect(detectFastPath(headers)).toBe("sub_ledger");
  });

  it("prefers GL over variance when both could apply", () => {
    // GL check runs before variance check
    const headers = ["debit_credit", "account", "actual", "budget"];
    expect(detectFastPath(headers)).toBe("gl");
  });

  it("prefers GL over AR when both could apply", () => {
    const headers = ["invoice_number", "customer", "debit_credit", "amount"];
    expect(detectFastPath(headers)).toBe("gl");
  });

  it("classifies FX rate headers as 'fx'", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    expect(detectFastPath(headers)).toBe("fx");
  });

  it("classifies FX rate variant headers as 'fx'", () => {
    const headers = ["from currency", "to currency", "rate", "date"];
    expect(detectFastPath(headers)).toBe("fx");
  });
});
