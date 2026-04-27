import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  InboxFilterBar,
  parseFilters,
  filtersToQueryString,
  applyFilters,
  ALL_FILTERS,
  type Filters,
} from "@/app/(shell)/decision-inbox/inbox-filter-bar";

describe("parseFilters", () => {
  it("falls back to 'all' for missing or unknown values", () => {
    expect(parseFilters({})).toEqual(ALL_FILTERS);
    expect(parseFilters({ kind: "potato", severity: "?", age: "" })).toEqual(ALL_FILTERS);
  });

  it("preserves valid values", () => {
    expect(parseFilters({ kind: "variance", severity: "high", age: "gt_30d" })).toEqual({
      kind: "variance",
      severity: "high",
      age: "gt_30d",
    });
  });
});

describe("filtersToQueryString", () => {
  it("returns empty string when all filters are 'all'", () => {
    expect(filtersToQueryString(ALL_FILTERS)).toBe("");
  });

  it("only includes non-default keys", () => {
    expect(
      filtersToQueryString({ kind: "variance", severity: "all", age: "gt_30d" }),
    ).toBe("?kind=variance&age=gt_30d");
  });
});

describe("applyFilters", () => {
  const NOW = new Date("2026-04-27T00:00:00Z").getTime();
  const rows = [
    { kind: "post_journal" as const, severity: undefined, createdAt: new Date("2026-04-26T00:00:00Z") }, // 1d
    { kind: "variance" as const, severity: "high" as const, createdAt: new Date("2026-04-20T00:00:00Z") }, // 7d
    { kind: "reconciliation_break" as const, severity: "high" as const, createdAt: new Date("2026-03-01T00:00:00Z") }, // ~57d
    { kind: "ar_followup" as const, severity: "low" as const, createdAt: new Date("2026-04-10T00:00:00Z") }, // 17d
  ];

  it("returns all rows when all filters are 'all'", () => {
    expect(applyFilters(rows, ALL_FILTERS, NOW)).toHaveLength(4);
  });

  it("filters by kind", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, kind: "variance" }, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("variance");
  });

  it("severity filter hides decisions and non-matching", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, severity: "high" }, NOW);
    expect(out).toHaveLength(2);
    for (const r of out) expect(r.severity).toBe("high");
  });

  it("age lt_7d", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, age: "lt_7d" }, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("post_journal");
  });

  it("age 7_30d", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, age: "7_30d" }, NOW);
    expect(out.map((r) => r.kind).sort()).toEqual(["ar_followup", "variance"]);
  });

  it("age gt_30d", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, age: "gt_30d" }, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("reconciliation_break");
  });

  it("composes filters", () => {
    const out = applyFilters(
      rows,
      { kind: "reconciliation_break", severity: "high", age: "gt_30d" },
      NOW,
    );
    expect(out).toHaveLength(1);
  });
});

describe("InboxFilterBar (interactions)", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => { onChange = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("clicking a kind pill calls onChange with that kind", () => {
    render(<InboxFilterBar filters={ALL_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Variance" }));
    expect(onChange).toHaveBeenCalledWith({ ...ALL_FILTERS, kind: "variance" });
  });

  it("clicking a severity pill calls onChange with that severity", () => {
    render(<InboxFilterBar filters={ALL_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(onChange).toHaveBeenCalledWith({ ...ALL_FILTERS, severity: "high" });
  });

  it("clicking an age pill calls onChange with that bucket", () => {
    render(<InboxFilterBar filters={ALL_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "> 30d" }));
    expect(onChange).toHaveBeenCalledWith({ ...ALL_FILTERS, age: "gt_30d" });
  });

  it("active pill is visually distinct", () => {
    render(
      <InboxFilterBar
        filters={{ ...ALL_FILTERS, kind: "variance" }}
        onChange={onChange}
      />,
    );
    const variance = screen.getByRole("button", { name: "Variance" });
    expect(variance.className).toContain("bg-primary");
  });
});
