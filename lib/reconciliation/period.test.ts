import { describe, expect, it } from "vitest";
import { isValidPeriodKey, periodKeyFromDate } from "./period";

describe("periodKeyFromDate", () => {
  it("formats standard mid-month date in UTC as YYYY-MM", () => {
    expect(periodKeyFromDate(new Date("2026-04-15T10:00:00Z"))).toBe("2026-04");
  });
  it("handles Jan 1 UTC boundary", () => {
    expect(periodKeyFromDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
  it("handles Dec 31 UTC boundary", () => {
    expect(periodKeyFromDate(new Date("2025-12-31T23:59:59Z"))).toBe("2025-12");
  });
  it("uses UTC even when local zone disagrees (Dec 31 23:30 UTC-5 -> Jan 1 UTC)", () => {
    expect(periodKeyFromDate(new Date("2025-12-31T23:30:00-05:00"))).toBe("2026-01");
  });
  it("handles leap day", () => {
    expect(periodKeyFromDate(new Date("2024-02-29T12:00:00Z"))).toBe("2024-02");
  });
  it("zero-pads single-digit months", () => {
    expect(periodKeyFromDate(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09");
  });
});

describe("isValidPeriodKey", () => {
  it("accepts 2026-04", () => {
    expect(isValidPeriodKey("2026-04")).toBe(true);
  });
  it("accepts 2024-12 (December boundary)", () => {
    expect(isValidPeriodKey("2024-12")).toBe(true);
  });
  it("accepts 2024-01 (January boundary)", () => {
    expect(isValidPeriodKey("2024-01")).toBe(true);
  });
  it("rejects month 00", () => {
    expect(isValidPeriodKey("2024-00")).toBe(false);
  });
  it("rejects month 13", () => {
    expect(isValidPeriodKey("2024-13")).toBe(false);
  });
  it("rejects short year", () => {
    expect(isValidPeriodKey("26-04")).toBe(false);
  });
  it("rejects unpadded month", () => {
    expect(isValidPeriodKey("2026-4")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidPeriodKey("")).toBe(false);
  });
  it("rejects extra suffix (ensures $ anchor works)", () => {
    expect(isValidPeriodKey("2026-04-01")).toBe(false);
  });
});
