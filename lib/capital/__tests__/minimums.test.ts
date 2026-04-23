import { describe, it, expect } from "vitest";
import { BASEL_III_MINIMUMS, effectiveMinimum, ratioStatus } from "../minimums";

describe("capital minimums", () => {
  it("exports hardcoded Basel III Pillar 1 minimums", () => {
    expect(BASEL_III_MINIMUMS.cet1).toBe(0.045);
    expect(BASEL_III_MINIMUMS.tier1).toBe(0.060);
    expect(BASEL_III_MINIMUMS.total).toBe(0.080);
  });

  it("effectiveMinimum returns the same as BASEL_III_MINIMUMS in B-phase", () => {
    expect(effectiveMinimum("cet1")).toBe(0.045);
    expect(effectiveMinimum("tier1")).toBe(0.060);
    expect(effectiveMinimum("total")).toBe(0.080);
  });

  it("classifies a ratio at the exact minimum as above_buffer (not a breach)", () => {
    expect(ratioStatus(0.045, "cet1")).toBe("above_buffer");
    expect(ratioStatus(0.060, "tier1")).toBe("above_buffer");
    expect(ratioStatus(0.080, "total")).toBe("above_buffer");
  });

  it("classifies a ratio just below the minimum as below_minimum", () => {
    expect(ratioStatus(0.0449, "cet1")).toBe("below_minimum");
    expect(ratioStatus(0.0599, "tier1")).toBe("below_minimum");
    expect(ratioStatus(0.0799, "total")).toBe("below_minimum");
  });
});
