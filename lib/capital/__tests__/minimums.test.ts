import { describe, it, expect } from "vitest";
import { BASEL_III_MINIMUMS, effectiveMinimum } from "../minimums";

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
});
