import { describe, it, expect } from "vitest";
import { parseCSV, autoDetectColumns, parseRows } from "@/lib/csv/variance-parser";

describe("parseCSV", () => {
  it("parses headers and rows from CSV text", () => {
    const text = "Account,Period,Actual,Budget,Category\nSalaries,Q1,50000,45000,HR\nRent,Q1,10000,10000,Facilities";
    const { headers, rows } = parseCSV(text);
    expect(headers).toEqual(["account", "period", "actual", "budget", "category"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Salaries", "Q1", "50000", "45000", "HR"]);
  });

  it("trims whitespace from headers and cells", () => {
    const text = " Account , Period , Actual \n Salaries , Q1 , 50000 ";
    const { headers, rows } = parseCSV(text);
    expect(headers).toEqual(["account", "period", "actual"]);
    expect(rows[0]).toEqual(["Salaries", "Q1", "50000"]);
  });
});

describe("autoDetectColumns", () => {
  it("detects standard variance headers", () => {
    const headers = ["account", "period", "actual", "budget", "category"];
    const mapping = autoDetectColumns(headers);
    expect(mapping.account).toBe(0);
    expect(mapping.period).toBe(1);
    expect(mapping.actual).toBe(2);
    expect(mapping.budget).toBe(3);
    expect(mapping.category).toBe(4);
  });

  it("detects alternative header names", () => {
    const headers = ["line item", "month", "spent", "forecast", "department"];
    const mapping = autoDetectColumns(headers);
    expect(mapping.account).toBe(0);
    expect(mapping.period).toBe(1);
    expect(mapping.actual).toBe(2);
    expect(mapping.budget).toBe(3);
    expect(mapping.category).toBe(4);
  });
});

describe("parseRows", () => {
  it("parses rows using column mapping", () => {
    const rows = [["Salaries", "Q1", "50000", "45000", "HR"]];
    const mapping = { account: 0, period: 1, actual: 2, budget: 3, category: 4 };
    const parsed = parseRows(rows, mapping);
    expect(parsed).toEqual([
      { account: "Salaries", period: "Q1", actual: 50000, budget: 45000, category: "HR" },
    ]);
  });

  it("skips rows with zero actual and budget", () => {
    const rows = [
      ["Salaries", "Q1", "50000", "45000", "HR"],
      ["Empty", "Q1", "0", "0", "Other"],
    ];
    const mapping = { account: 0, period: 1, actual: 2, budget: 3, category: 4 };
    const parsed = parseRows(rows, mapping);
    expect(parsed).toHaveLength(1);
  });
});
