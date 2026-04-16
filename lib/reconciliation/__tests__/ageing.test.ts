import { describe, it, expect } from "vitest";
import { ageDays, ageBucket, severity } from "../ageing";

const today = new Date("2026-04-16");

describe("ageDays", () => {
  it("returns whole-day difference", () => {
    expect(ageDays(new Date("2026-04-01"), today)).toBe(15);
    expect(ageDays(today, today)).toBe(0);
  });
});

describe("ageBucket", () => {
  it("classifies boundaries correctly", () => {
    expect(ageBucket(0)).toBe("0-30");
    expect(ageBucket(30)).toBe("0-30");
    expect(ageBucket(31)).toBe("31-60");
    expect(ageBucket(60)).toBe("31-60");
    expect(ageBucket(61)).toBe("60+");
  });
});

describe("severity", () => {
  it("is high when age > 60 OR |amount| > 10000", () => {
    expect(severity(61, 100)).toBe("high");
    expect(severity(5, 20000)).toBe("high");
    expect(severity(100, 15000)).toBe("high");
  });
  it("is medium when age > 30 OR |amount| > 1000 (and not high)", () => {
    expect(severity(31, 100)).toBe("medium");
    expect(severity(5, 5000)).toBe("medium");
  });
  it("is low otherwise", () => {
    expect(severity(10, 500)).toBe("low");
    expect(severity(0, 0)).toBe("low");
  });
});
