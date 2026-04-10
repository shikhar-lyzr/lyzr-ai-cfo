import { describe, it, expect } from "vitest";
import { parseDate } from "@/lib/csv/ar-parser";

describe("parseDate", () => {
  describe("YYYY-MM-DD format", () => {
    it("parses standard ISO date", () => {
      const d = parseDate("2026-03-15");
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(2); // 0-indexed
      expect(d!.getDate()).toBe(15);
    });

    it("parses single-digit month and day", () => {
      const d = parseDate("2026-1-5");
      expect(d).not.toBeNull();
      expect(d!.getMonth()).toBe(0);
      expect(d!.getDate()).toBe(5);
    });
  });

  describe("MM/DD/YYYY format", () => {
    it("parses standard US date", () => {
      const d = parseDate("03/15/2026");
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(2);
      expect(d!.getDate()).toBe(15);
    });

    it("parses single-digit month and day", () => {
      const d = parseDate("1/5/2026");
      expect(d).not.toBeNull();
      expect(d!.getMonth()).toBe(0);
      expect(d!.getDate()).toBe(5);
    });
  });

  describe("DD-MMM-YYYY format", () => {
    it("parses standard format", () => {
      const d = parseDate("15-Mar-2026");
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(2);
      expect(d!.getDate()).toBe(15);
    });

    it("handles case-insensitive month", () => {
      const d = parseDate("1-jan-2026");
      expect(d).not.toBeNull();
      expect(d!.getMonth()).toBe(0);
    });

    it("parses all 12 months", () => {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      months.forEach((m, i) => {
        const d = parseDate(`1-${m}-2026`);
        expect(d).not.toBeNull();
        expect(d!.getMonth()).toBe(i);
      });
    });
  });

  describe("invalid inputs", () => {
    it("returns null for garbage", () => {
      expect(parseDate("not-a-date")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseDate("")).toBeNull();
    });

    it("returns null for partial date", () => {
      expect(parseDate("2026-03")).toBeNull();
    });

    it("returns null for completely invalid format", () => {
      expect(parseDate("March 15, 2026")).toBeNull();
    });

    it("trims whitespace before parsing", () => {
      const d = parseDate("  2026-03-15  ");
      expect(d).not.toBeNull();
      expect(d!.getDate()).toBe(15);
    });
  });
});
