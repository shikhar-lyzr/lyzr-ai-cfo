import { describe, it, expect, vi } from "vitest";
import {
  findHeader,
  parseAmount,
  parseDate,
  detectDateFormat,
} from "@/lib/csv/utils";

describe("findHeader", () => {
  it("matches exact canonical name", () => {
    expect(findHeader(["account", "amount", "date"], "amount")).toBe(1);
  });

  it("matches case-insensitively", () => {
    expect(findHeader(["Account", "AMOUNT", "Date"], "amount")).toBe(1);
  });

  it("normalizes underscores and spaces", () => {
    expect(findHeader(["Entry Date", "amount"], "entry_date")).toBe(0);
    expect(findHeader(["entry_date", "amount"], "entry date")).toBe(0);
    expect(findHeader(["entry-date", "amount"], "entry_date")).toBe(0);
  });

  it("falls back to aliases in order", () => {
    expect(findHeader(["Dr/Cr", "amount"], "debit_credit", ["dr_cr", "dr/cr"])).toBe(0);
  });

  it("returns -1 when nothing matches", () => {
    expect(findHeader(["a", "b", "c"], "amount")).toBe(-1);
  });
});

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("-500.00")).toBe(-500);
  });

  it("strips thousands commas", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  it("strips currency symbols from the allowlist", () => {
    expect(parseAmount("$1,234.56")).toBe(1234.56);
    expect(parseAmount("€1,234.56")).toBe(1234.56);
    expect(parseAmount("£1234")).toBe(1234);
    expect(parseAmount("¥100")).toBe(100);
    expect(parseAmount("₹2500.50")).toBe(2500.5);
  });

  it("treats accounting parens as negative", () => {
    expect(parseAmount("(500.00)")).toBe(-500);
    expect(parseAmount("($1,234.56)")).toBe(-1234.56);
  });

  it("treats trailing minus as negative", () => {
    expect(parseAmount("500.00-")).toBe(-500);
  });

  it("returns null for European decimal format", () => {
    expect(parseAmount("1.234,56")).toBeNull();
    expect(parseAmount("1 234,56")).toBeNull();
  });

  it("returns null for placeholders and empty", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("  ")).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });

  it("returns null for non-numeric content with digits embedded", () => {
    expect(parseAmount("1M")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses ISO YYYY-MM-DD", () => {
    const d = parseDate("2026-04-15");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(3); // April = 3
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses US MM/DD/YYYY by default", () => {
    const d = parseDate("04/15/2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses EU DD/MM/YYYY when format=eu is passed", () => {
    const d = parseDate("15/04/2026", "eu");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses named-month long form", () => {
    const d = parseDate("15 Apr 2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses named-month hyphen form", () => {
    const d = parseDate("15-Apr-2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("returns null for unrecognized formats", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("2026")).toBeNull();
  });
});

describe("detectDateFormat", () => {
  it("detects US when day > 12 appears anywhere", () => {
    expect(detectDateFormat(["01/15/2026", "02/03/2026"])).toBe("us");
  });

  it("detects EU when month position > 12 under US assumption", () => {
    expect(detectDateFormat(["15/01/2026", "03/04/2026"])).toBe("eu");
  });

  it("defaults to US and warns when column is fully ambiguous", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detectDateFormat(["01/02/2026", "03/04/2026"])).toBe("us");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores ISO values for disambiguation", () => {
    expect(detectDateFormat(["2026-01-15", "2026-02-20"])).toBe("us");
  });

  it("returns US for an empty column without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detectDateFormat([])).toBe("us");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
