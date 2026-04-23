import { describe, it, expect } from "vitest";
import { detectFastPath } from "../detect-shape";

describe("detectFastPath", () => {
  it("detects capital_components from component+amount+period headers", () => {
    expect(detectFastPath(["period", "component", "amount", "currency"]))
      .toBe("capital_components");
    expect(detectFastPath(["Period", "Component", "Amount"]))
      .toBe("capital_components");
  });

  it("detects rwa_breakdown from risk_type header", () => {
    expect(detectFastPath([
      "period", "risk_type", "exposure_class", "exposure_amount", "risk_weight", "rwa",
    ])).toBe("rwa_breakdown");
    expect(detectFastPath([
      "period", "risk type", "exposure class", "exposure amount", "risk weight", "rwa",
    ])).toBe("rwa_breakdown");
  });

  it("rwa_breakdown wins over capital_components when both component and risk_type present", () => {
    // Hypothetical malformed file — risk_type is the more specific signal.
    expect(detectFastPath(["period", "component", "amount", "risk_type", "rwa"]))
      .toBe("rwa_breakdown");
  });

  it("does NOT classify a GL/sub-ledger CSV as capital", () => {
    expect(detectFastPath(["entry_date", "account", "debit_credit", "amount"]))
      .toBe("gl");
  });
});
