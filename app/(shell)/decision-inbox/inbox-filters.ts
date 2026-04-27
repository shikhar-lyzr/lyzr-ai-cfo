import type { InboxRowKind, InboxSeverity } from "./inbox-row";

export type KindFilter = "all" | InboxRowKind;
export type SeverityFilter = "all" | InboxSeverity;
export type AgeFilter = "all" | "lt_7d" | "7_30d" | "gt_30d";

export type Filters = {
  kind: KindFilter;
  severity: SeverityFilter;
  age: AgeFilter;
};

export const ALL_FILTERS: Filters = { kind: "all", severity: "all", age: "all" };

export const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "post_journal", label: "Decision" },
  { value: "variance", label: "Variance" },
  { value: "anomaly", label: "Anomaly" },
  { value: "recommendation", label: "Rec" },
  { value: "ar_followup", label: "AR" },
  { value: "reconciliation_break", label: "Recon" },
];

export const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const AGE_OPTIONS: { value: AgeFilter; label: string }[] = [
  { value: "all", label: "Any age" },
  { value: "lt_7d", label: "< 7d" },
  { value: "7_30d", label: "7–30d" },
  { value: "gt_30d", label: "> 30d" },
];

const KIND_VALUES: ReadonlySet<string> = new Set(KIND_OPTIONS.map((o) => o.value));
const SEVERITY_VALUES: ReadonlySet<string> = new Set(SEVERITY_OPTIONS.map((o) => o.value));
const AGE_VALUES: ReadonlySet<string> = new Set(AGE_OPTIONS.map((o) => o.value));

export function parseFilters(input: {
  kind?: string;
  severity?: string;
  age?: string;
}): Filters {
  return {
    kind: KIND_VALUES.has(input.kind ?? "") ? (input.kind as KindFilter) : "all",
    severity: SEVERITY_VALUES.has(input.severity ?? "") ? (input.severity as SeverityFilter) : "all",
    age: AGE_VALUES.has(input.age ?? "") ? (input.age as AgeFilter) : "all",
  };
}

export function filtersToQueryString(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.kind !== "all") sp.set("kind", f.kind);
  if (f.severity !== "all") sp.set("severity", f.severity);
  if (f.age !== "all") sp.set("age", f.age);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function applyFilters(
  rows: { kind: InboxRowKind; severity?: InboxSeverity; createdAt: Date }[],
  f: Filters,
  now: number,
): typeof rows {
  return rows.filter((r) => {
    if (f.kind !== "all" && r.kind !== f.kind) return false;
    if (f.severity !== "all" && r.severity !== f.severity) return false;
    if (f.age !== "all") {
      const ageMs = now - r.createdAt.getTime();
      const d = ageMs / (24 * 60 * 60 * 1000);
      if (f.age === "lt_7d" && !(d < 7)) return false;
      if (f.age === "7_30d" && !(d >= 7 && d <= 30)) return false;
      if (f.age === "gt_30d" && !(d > 30)) return false;
    }
    return true;
  });
}
