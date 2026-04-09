import { describe, it, expect } from "vitest";
import { relativeTime, formatCurrency, severityColor } from "@/lib/utils";

describe("relativeTime", () => {
  it("returns 'just now' for times less than a minute ago", () => {
    const now = new Date();
    expect(relativeTime(now)).toBe("just now");
  });

  it("returns minutes for times less than an hour ago", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(relativeTime(thirtyMinAgo)).toBe("30m ago");
  });

  it("returns hours for times less than a day ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(relativeTime(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days for times more than a day ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(relativeTime(threeDaysAgo)).toBe("3d ago");
  });
});

describe("formatCurrency", () => {
  it("formats thousands with K suffix", () => {
    expect(formatCurrency(14200)).toBe("$14.2K");
  });

  it("formats exact thousands cleanly", () => {
    expect(formatCurrency(50000)).toBe("$50.0K");
  });

  it("formats amounts under 1000 without suffix", () => {
    expect(formatCurrency(500)).toBe("$500");
  });
});

describe("severityColor", () => {
  it("returns danger classes for critical", () => {
    expect(severityColor("critical")).toContain("danger");
  });

  it("returns warning classes for warning", () => {
    expect(severityColor("warning")).toContain("warning");
  });

  it("returns success classes for info", () => {
    expect(severityColor("info")).toContain("success");
  });
});
