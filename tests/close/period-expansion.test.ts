import { describe, it, expect } from "vitest";
import { expandPeriodKey } from "@/lib/close/period-expansion";

describe("expandPeriodKey", () => {
  it("returns [key] for a monthly key like 2026-03", () => {
    expect(expandPeriodKey("2026-03")).toEqual(["2026-03"]);
  });

  it("expands YYYY-Q1 to the three months of Q1", () => {
    expect(expandPeriodKey("2026-Q1")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("expands YYYY-Q2 to April-May-June", () => {
    expect(expandPeriodKey("2026-Q2")).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("expands YYYY-Q3 and YYYY-Q4 correctly", () => {
    expect(expandPeriodKey("2026-Q3")).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(expandPeriodKey("2026-Q4")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("expands YYYY to all 12 months", () => {
    expect(expandPeriodKey("2026")).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
      "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
    ]);
  });

  it("accepts lowercase q", () => {
    expect(expandPeriodKey("2026-q1")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("returns [key] unchanged for unrecognized shapes (defensive)", () => {
    expect(expandPeriodKey("custom-label")).toEqual(["custom-label"]);
    expect(expandPeriodKey("")).toEqual([""]);
  });
});
