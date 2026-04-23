import { describe, it, expect } from "vitest";
import { resolveActivePeriod, safely } from "../period";

describe("resolveActivePeriod", () => {
  it("returns null when no periods exist", () => {
    expect(resolveActivePeriod([], "2026-Q1")).toBeNull();
  });

  it("returns requested periodKey when it exists", () => {
    const periods = [{ periodKey: "2026-Q1" }, { periodKey: "2025-Q4" }];
    expect(resolveActivePeriod(periods, "2025-Q4")).toBe("2025-Q4");
  });

  it("falls back to newest (first in list) when requested is invalid", () => {
    const periods = [{ periodKey: "2026-Q1" }, { periodKey: "2025-Q4" }];
    expect(resolveActivePeriod(periods, "2024-Q1")).toBe("2026-Q1");
  });

  it("falls back to newest when requested is undefined", () => {
    const periods = [{ periodKey: "2026-Q1" }];
    expect(resolveActivePeriod(periods, undefined)).toBe("2026-Q1");
  });
});

describe("safely", () => {
  it("returns producer value when it resolves", async () => {
    const result = await safely(async () => 42, 0);
    expect(result).toBe(42);
  });

  it("returns fallback when producer throws", async () => {
    const result = await safely(async () => {
      throw new Error("boom");
    }, 99);
    expect(result).toBe(99);
  });
});
