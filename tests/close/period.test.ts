import { describe, it, expect } from "vitest";
import { resolveActivePeriod } from "@/lib/close/period";

describe("resolveActivePeriod", () => {
  const periods = [
    { periodKey: "2026-04" },
    { periodKey: "2026-03" },
    { periodKey: "2026-02" },
  ];

  it("returns requested period when it exists in the list", () => {
    expect(resolveActivePeriod(periods, "2026-03")).toBe("2026-03");
  });

  it("falls back to first (most recent) period when requested is missing", () => {
    expect(resolveActivePeriod(periods, "2025-12")).toBe("2026-04");
  });

  it("falls back when no period requested", () => {
    expect(resolveActivePeriod(periods, undefined)).toBe("2026-04");
  });

  it("returns null when list is empty", () => {
    expect(resolveActivePeriod([], "2026-04")).toBeNull();
  });
});
