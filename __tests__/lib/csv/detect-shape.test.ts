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
});
