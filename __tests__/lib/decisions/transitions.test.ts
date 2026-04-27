import { describe, it, expect } from "vitest";
import { legalTransition, type DecisionOutcome, type DecisionStatus } from "@/lib/decisions/transitions";

describe("legalTransition", () => {
  it("pending + approve → approved", () => {
    expect(legalTransition("pending", "approve")).toBe("approved");
  });
  it("pending + reject → rejected", () => {
    expect(legalTransition("pending", "reject")).toBe("rejected");
  });
  it("pending + needs_info → needs_info", () => {
    expect(legalTransition("pending", "needs_info")).toBe("needs_info");
  });
  it("needs_info + approve → approved", () => {
    expect(legalTransition("needs_info", "approve")).toBe("approved");
  });
  it("needs_info + reject → rejected", () => {
    expect(legalTransition("needs_info", "reject")).toBe("rejected");
  });
  it("needs_info + needs_info → null (no self-transition)", () => {
    expect(legalTransition("needs_info", "needs_info")).toBeNull();
  });
  it("approved + approve → null (terminal)", () => {
    expect(legalTransition("approved", "approve")).toBeNull();
  });
  it("rejected + approve → null (terminal)", () => {
    expect(legalTransition("rejected", "approve")).toBeNull();
  });
  it("rejects unknown current status", () => {
    expect(legalTransition("garbage" as DecisionStatus, "approve")).toBeNull();
  });
  it("rejects unknown outcome", () => {
    expect(legalTransition("pending", "garbage" as DecisionOutcome)).toBeNull();
  });
});
