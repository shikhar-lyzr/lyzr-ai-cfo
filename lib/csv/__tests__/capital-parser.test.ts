import { describe, it, expect } from "vitest";
import {
  parseCapitalComponents,
  parseRwaBreakdown,
  KNOWN_COMPONENTS,
} from "../capital-parser";

describe("parseCapitalComponents", () => {
  const headers = ["period", "component", "amount", "currency"];

  it("parses a happy-path file", () => {
    const rows = [
      ["2026-Q1", "cet1_capital", "12400000000", "USD"],
      ["2026-Q1", "additional_tier1", "1500000000", "USD"],
      ["2026-Q1", "tier2", "2500000000", "USD"],
      ["2026-Q1", "total_rwa", "93900000000", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(4);
    expect(out.components[0]).toEqual({
      periodKey: "2026-Q1",
      component: "cet1_capital",
      amount: 12400000000,
      currency: "USD",
    });
    expect(out.skipped).toEqual([]);
  });

  it("normalizes component names (case / whitespace / underscores)", () => {
    const rows = [
      ["2026-Q1", "  CET1 Capital  ", "100", "USD"],
      ["2026-Q1", "Additional-Tier1", "50", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components[0].component).toBe("cet1_capital");
    expect(out.components[1].component).toBe("additional_tier1");
  });

  it("maps unknown component names to other_deduction with skipped note", () => {
    const rows = [
      ["2026-Q1", "some_custom_bucket", "100", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(1);
    expect(out.components[0].component).toBe("other_deduction");
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0]).toMatchObject({
      row: 2,
      reason: expect.stringContaining("unknown component"),
    });
  });

  it("rejects negative amounts (skipped, not errored)", () => {
    const rows = [
      ["2026-Q1", "cet1_capital", "-100", "USD"],
      ["2026-Q1", "tier2", "500", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(1);
    expect(out.components[0].component).toBe("tier2");
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0].reason).toContain("negative");
  });

  it("skips rows with unparseable amount", () => {
    const rows = [
      ["2026-Q1", "cet1_capital", "not-a-number", "USD"],
      ["2026-Q1", "tier2", "", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(0);
    expect(out.skipped).toHaveLength(2);
  });

  it("defaults currency to USD when column missing", () => {
    const out = parseCapitalComponents(
      ["period", "component", "amount"],
      [["2026-Q1", "cet1_capital", "100"]],
    );
    expect(out.components[0].currency).toBe("USD");
  });

  it("skips rows with invalid period format", () => {
    const rows = [
      ["not-a-period", "cet1_capital", "100", "USD"],
      ["2026-13", "cet1_capital", "100", "USD"],
      ["2026-Q1", "cet1_capital", "100", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(1);
    expect(out.skipped).toHaveLength(2);
  });

  it("exports the known-component list for tests and UI hints", () => {
    expect(KNOWN_COMPONENTS).toContain("cet1_capital");
    expect(KNOWN_COMPONENTS).toContain("total_rwa");
    expect(KNOWN_COMPONENTS).toContain("goodwill");
  });

  it("throws when required headers are missing", () => {
    expect(() => parseCapitalComponents(["foo", "bar"], [])).toThrow(
      /missing required headers/,
    );
  });
});

describe("parseRwaBreakdown", () => {
  const headers = ["period", "risk_type", "exposure_class", "exposure_amount", "risk_weight", "rwa"];

  it("parses a happy-path file", () => {
    const rows = [
      ["2026-Q1", "credit", "corporate", "50000000", "1.0", "50000000"],
      ["2026-Q1", "market", "trading_book", "20000000", "0.5", "10000000"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0]).toEqual({
      periodKey: "2026-Q1",
      riskType: "credit",
      exposureClass: "corporate",
      exposureAmount: 50000000,
      riskWeight: 1.0,
      rwa: 50000000,
    });
  });

  it("accepts risk_weight as a percent string", () => {
    const rows = [
      ["2026-Q1", "credit", "retail", "100", "50%", "50"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines[0].riskWeight).toBe(0.5);
  });

  it("skips unknown riskType", () => {
    const rows = [
      ["2026-Q1", "ozymandias", "x", "100", "1.0", "100"],
      ["2026-Q1", "credit", "corp", "100", "1.0", "100"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines).toHaveLength(1);
    expect(out.skipped).toHaveLength(1);
  });

  it("accepts case-insensitive riskType", () => {
    const rows = [
      ["2026-Q1", "Credit", "corp", "100", "1.0", "100"],
      ["2026-Q1", "OPERATIONAL", "foo", "100", "1.0", "100"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0].riskType).toBe("credit");
    expect(out.lines[1].riskType).toBe("operational");
  });

  it("accepts header variants with spaces or hyphens", () => {
    const headerVariants = ["period", "risk type", "exposure-class", "exposure amount", "risk weight", "rwa"];
    const rows = [["2026-Q1", "credit", "corp", "100", "1.0", "100"]];
    const out = parseRwaBreakdown(headerVariants, rows);
    expect(out.lines).toHaveLength(1);
  });

  it("throws when required headers are missing", () => {
    expect(() => parseRwaBreakdown(["period", "rwa"], [])).toThrow(
      /missing required headers/,
    );
  });
});
