# Decision Inbox Dynamic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Decision Inbox scannable and filterable: add a kind chip + severity badge to each row, plus a URL-driven filter bar (kind / severity / age) that shows the filtered count in the Pending metric card.

**Architecture:** No schema change, no new endpoints. Server component reads `searchParams.kind|severity|age` and passes initial filter values to the client. The client renders a `<InboxFilterBar>`, holds filter state in `useState`, mirrors that to the URL via `router.replace()`, and uses `useMemo` to filter the row list. Each row renders a `<KindChip>` and an optional `<SeverityBadge>`.

**Tech Stack:** Next.js 16 App Router, React + Tailwind, vitest + jsdom for component tests.

**Spec:** `docs/superpowers/specs/2026-04-27-decision-inbox-dynamic-design.md`

**Branch:** `feature/unified-decision-inbox` (continues work on top of the unified-inbox commits).

---

## File Structure

**New files:**
- `app/(shell)/decision-inbox/inbox-filter-bar.tsx` — `InboxFilterBar` component (three pill groups: kind / severity / age) + the filter type definitions (`KindFilter`, `SeverityFilter`, `AgeFilter`).
- `app/(shell)/decision-inbox/badges.tsx` — `KindChip` + `SeverityBadge` components. Pure presentational; takes a `kind` or `severity` value and renders the styled pill.

**Modified files:**
- `app/(shell)/decision-inbox/inbox-row.ts` — add optional `severity?: "high" | "medium" | "low"` field; `actionToRow` narrows `Action.severity` (typed `string` in Prisma) to one of the three or drops it.
- `app/(shell)/decision-inbox/page.tsx` — accept `searchParams`, parse the three filter params, pass `initialFilters` to client.
- `app/(shell)/decision-inbox/decision-inbox-client.tsx` — render `<InboxFilterBar>`; track filter state via `useState` initialised from `initialFilters`; mirror to URL on change; compute filtered list via `useMemo`; render `<KindChip>` and `<SeverityBadge>` on each row; metric card shows filtered count; new "no items match" empty state.

**Test files:**
- `tests/unit/inbox-row-mappers.test.ts` (modify) — three new tests covering severity narrowing.
- `tests/component/inbox-filter.test.tsx` (new) — filter bar + filtered list interactions.

**Out of scope:** No changes to `inbox-row.ts`'s mapper signatures other than the severity narrowing. No changes to `app/(shell)/financial-reconciliation/`. No new API routes. No schema changes.

---

## Task 1: Extend `InboxRow` with severity narrowing (TDD)

**Files:**
- Modify: `app/(shell)/decision-inbox/inbox-row.ts`
- Modify: `tests/unit/inbox-row-mappers.test.ts` (add tests)

- [ ] **Step 1: Add the failing tests**

Open `tests/unit/inbox-row-mappers.test.ts`. Append these tests inside the existing `describe("inbox-row mappers", ...)` block (after the existing tests, before the closing `});`):

```ts
  it("actionToRow includes severity when it is one of high/medium/low", () => {
    for (const sev of ["high", "medium", "low"] as const) {
      const a = {
        id: `a_${sev}`, userId: "u", type: "variance", severity: sev,
        headline: "h", detail: null, driver: "", status: "pending",
        sourceDataSourceId: null, invoiceId: null, draftBody: null,
        createdAt: new Date(),
      };
      const row = actionToRow(a as any);
      expect(row.severity).toBe(sev);
    }
  });

  it("actionToRow leaves severity undefined when missing", () => {
    const a = {
      id: "a_x", userId: "u", type: "variance", severity: undefined as any,
      headline: "h", detail: null, driver: "", status: "pending",
      sourceDataSourceId: null, invoiceId: null, draftBody: null,
      createdAt: new Date(),
    };
    const row = actionToRow(a as any);
    expect(row.severity).toBeUndefined();
  });

  it("actionToRow drops unknown severity strings", () => {
    const a = {
      id: "a_y", userId: "u", type: "variance", severity: "potato",
      headline: "h", detail: null, driver: "", status: "pending",
      sourceDataSourceId: null, invoiceId: null, draftBody: null,
      createdAt: new Date(),
    };
    const row = actionToRow(a as any);
    expect(row.severity).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests, verify failures**

```
npx vitest run tests/unit/inbox-row-mappers.test.ts
```

Expected: 3 new tests fail (existing 5 pass). Failures should be `row.severity` is `undefined` for all three new tests, OR a TypeScript error if the field doesn't exist yet (compile failure first).

- [ ] **Step 3: Update `inbox-row.ts`**

Replace the file's contents with:

```ts
import type { Decision, Action } from "@prisma/client";

export type InboxRowKind =
  | "post_journal"
  | "variance"
  | "anomaly"
  | "recommendation"
  | "ar_followup"
  | "reconciliation_break";

export type InboxSeverity = "high" | "medium" | "low";

const SEVERITIES: ReadonlySet<string> = new Set(["high", "medium", "low"]);

export type DecisionWithProposal = Decision & {
  proposal: {
    id: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    currency: string;
    description: string;
    break?: { id: string; side: string; periodKey?: string } | null;
  } | null;
};

export type ActionWithSource = Action & { sourceName?: string | null };

export type InboxRow = {
  source: "decision" | "action";
  id: string;
  kind: InboxRowKind;
  headline: string;
  detail: string | null;
  createdAt: Date;
  breakId?: string;
  severity?: InboxSeverity;
  decision?: DecisionWithProposal;
  action?: ActionWithSource;
};

export function decisionToRow(d: DecisionWithProposal): InboxRow {
  return {
    source: "decision",
    id: d.id,
    kind: d.type as InboxRowKind,
    headline: d.headline,
    detail: d.detail,
    createdAt: d.createdAt,
    decision: d,
  };
}

export function actionToRow(a: ActionWithSource, breakId?: string): InboxRow {
  const severity = SEVERITIES.has(a.severity) ? (a.severity as InboxSeverity) : undefined;
  return {
    source: "action",
    id: a.id,
    kind: a.type as InboxRowKind,
    headline: a.headline,
    detail: a.detail,
    createdAt: a.createdAt,
    ...(breakId ? { breakId } : {}),
    ...(severity ? { severity } : {}),
    action: a,
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

```
npx vitest run tests/unit/inbox-row-mappers.test.ts
```

Expected: 8/8 pass.

- [ ] **Step 5: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/\(shell\)/decision-inbox/inbox-row.ts tests/unit/inbox-row-mappers.test.ts
git commit -m "feat(inbox): narrow Action.severity onto InboxRow"
```

---

## Task 2: KindChip + SeverityBadge components

**Files:**
- Create: `app/(shell)/decision-inbox/badges.tsx`

Pure presentational components. No tests yet — they have no logic, just static styling. They get exercised by Task 4's filter test and Task 5's manual smoke.

- [ ] **Step 1: Create `badges.tsx`**

Use the Write tool to create `app/(shell)/decision-inbox/badges.tsx`:

```tsx
import type { InboxRowKind, InboxSeverity } from "./inbox-row";

const KIND_META: Record<InboxRowKind, { label: string; classes: string }> = {
  post_journal:         { label: "Decision", classes: "bg-blue-100 text-blue-900" },
  variance:             { label: "Variance", classes: "bg-amber-100 text-amber-900" },
  anomaly:              { label: "Anomaly",  classes: "bg-rose-100 text-rose-900" },
  recommendation:       { label: "Rec",      classes: "bg-violet-100 text-violet-900" },
  ar_followup:          { label: "AR",       classes: "bg-emerald-100 text-emerald-900" },
  reconciliation_break: { label: "Recon",    classes: "bg-orange-100 text-orange-900" },
};

const SEVERITY_META: Record<InboxSeverity, { label: string; classes: string }> = {
  high:   { label: "High",   classes: "bg-red-600 text-white" },
  medium: { label: "Medium", classes: "bg-amber-500 text-white" },
  low:    { label: "Low",    classes: "bg-gray-300 text-gray-800" },
};

const PILL_BASE = "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide";

export function KindChip({ kind }: { kind: InboxRowKind }) {
  const m = KIND_META[kind];
  return <span className={`${PILL_BASE} ${m.classes}`}>{m.label}</span>;
}

export function SeverityBadge({ severity }: { severity: InboxSeverity }) {
  const m = SEVERITY_META[severity];
  return <span className={`${PILL_BASE} ${m.classes}`}>{m.label}</span>;
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/\(shell\)/decision-inbox/badges.tsx
git commit -m "feat(inbox): KindChip + SeverityBadge components"
```

---

## Task 3: InboxFilterBar component + filter type definitions

**Files:**
- Create: `app/(shell)/decision-inbox/inbox-filter-bar.tsx`

Pure presentational bar — three groups of single-select pills. Pattern mirrors `components/command-center/filter-bar.tsx`. No tests yet — exercised by Task 4's integration test.

- [ ] **Step 1: Create `inbox-filter-bar.tsx`**

Use the Write tool to create `app/(shell)/decision-inbox/inbox-filter-bar.tsx`:

```tsx
"use client";

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

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "post_journal", label: "Decision" },
  { value: "variance", label: "Variance" },
  { value: "anomaly", label: "Anomaly" },
  { value: "recommendation", label: "Rec" },
  { value: "ar_followup", label: "AR" },
  { value: "reconciliation_break", label: "Recon" },
];

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const AGE_OPTIONS: { value: AgeFilter; label: string }[] = [
  { value: "all", label: "Any age" },
  { value: "lt_7d", label: "< 7d" },
  { value: "7_30d", label: "7–30d" },
  { value: "gt_30d", label: "> 30d" },
];

function FilterGroup<T extends string>({
  label, options, active, onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={
            "px-2.5 py-1 text-xs rounded transition-colors border " +
            (active === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground border-border hover:bg-secondary/50")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function InboxFilterBar({
  filters, onChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 border border-border rounded-lg bg-card/50">
      <FilterGroup<KindFilter>
        label="Kind"
        options={KIND_OPTIONS}
        active={filters.kind}
        onChange={(v) => onChange({ ...filters, kind: v })}
      />
      <FilterGroup<SeverityFilter>
        label="Severity"
        options={SEVERITY_OPTIONS}
        active={filters.severity}
        onChange={(v) => onChange({ ...filters, severity: v })}
      />
      <FilterGroup<AgeFilter>
        label="Age"
        options={AGE_OPTIONS}
        active={filters.age}
        onChange={(v) => onChange({ ...filters, age: v })}
      />
    </div>
  );
}

// Helpers for URL <-> Filters round-trip.
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
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/\(shell\)/decision-inbox/inbox-filter-bar.tsx
git commit -m "feat(inbox): InboxFilterBar with kind/severity/age groups"
```

---

## Task 4: Component test for filter logic + URL round-trip (TDD)

**Files:**
- Create: `tests/component/inbox-filter.test.tsx`

We test the `applyFilters`, `parseFilters`, and `filtersToQueryString` helpers (pure functions), then test the bar component itself with click events.

- [ ] **Step 1: Write the test**

Use the Write tool to create `tests/component/inbox-filter.test.tsx`:

```tsx
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
    expect(out).toHaveLength(2); // variance + recon_break (both high), Decision (no severity) hidden, AR low hidden
    for (const r of out) expect(r.severity).toBe("high");
  });

  it("age lt_7d", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, age: "lt_7d" }, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("post_journal"); // only the 1d-old row
  });

  it("age 7_30d", () => {
    const out = applyFilters(rows, { ...ALL_FILTERS, age: "7_30d" }, NOW);
    expect(out.map((r) => r.kind).sort()).toEqual(["ar_followup", "variance"]); // 7d + 17d
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
    const filters: Filters = { ...ALL_FILTERS };
    render(<InboxFilterBar filters={filters} onChange={onChange} />);
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
```

- [ ] **Step 2: Run the tests**

```
npx vitest run tests/component/inbox-filter.test.tsx
```

Expected: all tests pass. (No production code changes since Tasks 1–3 already implemented the helpers.)

If a test fails, read the message before editing — the most likely cause is an off-by-one in age bounds or a missed import. Don't change the test logic without understanding why.

- [ ] **Step 3: Commit**

```bash
git add tests/component/inbox-filter.test.tsx
git commit -m "test(inbox): filter helpers + bar interactions"
```

---

## Task 5: Wire filter bar + badges into the page

**Files:**
- Modify: `app/(shell)/decision-inbox/page.tsx`
- Modify: `app/(shell)/decision-inbox/decision-inbox-client.tsx`

This is the integration task. Page reads searchParams; client renders the bar, applies filter, renders badges, mirrors filter changes to URL.

- [ ] **Step 1: Replace `page.tsx`**

Use the Write tool to fully replace `app/(shell)/decision-inbox/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listDecisions } from "@/lib/decisions/service";
import { decisionToRow, actionToRow, type InboxRow } from "./inbox-row";
import { parseFilters } from "./inbox-filter-bar";
import { DecisionInboxClient } from "./decision-inbox-client";

export const dynamic = "force-dynamic";

export default async function DecisionInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const initialFilters = parseFilters({
    kind: first(sp.kind),
    severity: first(sp.severity),
    age: first(sp.age),
  });

  const [pendingDecisions, pendingActionsRaw] = await Promise.all([
    listDecisions(session.userId, "pending"),
    prisma.action.findMany({
      where: { userId: session.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { dataSource: { select: { name: true } } },
    }),
  ]);

  const pendingActions = pendingActionsRaw.map((a) => ({
    ...a,
    sourceName: a.dataSource?.name ?? null,
  }));

  const reconBreakActionIds = pendingActions
    .filter((a) => a.type === "reconciliation_break")
    .map((a) => a.id);

  const breakRows = reconBreakActionIds.length === 0
    ? []
    : await prisma.break.findMany({
        where: { actionId: { in: reconBreakActionIds } },
        select: { id: true, actionId: true },
      });

  const breakIdByActionId = new Map(
    breakRows.filter((b) => b.actionId).map((b) => [b.actionId as string, b.id]),
  );

  const rows: InboxRow[] = (
    [
      ...pendingDecisions.map((d) => decisionToRow(d as any)),
      ...pendingActions.map((a) => actionToRow(a, breakIdByActionId.get(a.id))),
    ] as InboxRow[]
  ).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

  return <DecisionInboxClient rows={rows} initialFilters={initialFilters} />;
}
```

- [ ] **Step 2: Replace `decision-inbox-client.tsx`**

Use the Write tool to fully replace `app/(shell)/decision-inbox/decision-inbox-client.tsx`:

```tsx
"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import type { InboxRow } from "./inbox-row";
import { KindChip, SeverityBadge } from "./badges";
import {
  InboxFilterBar,
  applyFilters,
  filtersToQueryString,
  ALL_FILTERS,
  type Filters,
} from "./inbox-filter-bar";

type Props = { rows: InboxRow[]; initialFilters: Filters };

export function DecisionInboxClient({ rows, initialFilters }: Props) {
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const router = useRouter();

  const isBusy = dispatching !== null || busy;

  const visibleRows = useMemo(
    () => applyFilters(rows, filters, Date.now()),
    [rows, filters],
  );

  function setFiltersAndUrl(next: Filters) {
    setFilters(next);
    const qs = filtersToQueryString(next);
    router.replace(`/decision-inbox${qs}`);
  }

  function clearFilters() {
    setFiltersAndUrl(ALL_FILTERS);
  }

  function back() {
    setSelected(null);
    setReason("");
  }

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Request failed");
      return false;
    }
    return true;
  }

  async function dispatchDecision(id: string, outcome: "approve" | "reject" | "needs_info") {
    if (dispatching) return;
    setDispatching(id);
    try {
      const ok = await call(`/api/decisions/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, reason: reason.trim() || undefined }),
      });
      if (ok) { back(); startTransition(() => router.refresh()); }
    } finally {
      setDispatching(null);
    }
  }

  async function dispatchActionPatch(id: string, status: "approved" | "dismissed") {
    if (dispatching) return;
    setDispatching(id);
    try {
      const ok = await call(`/api/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (ok) { back(); startTransition(() => router.refresh()); }
    } finally {
      setDispatching(null);
    }
  }

  async function dispatchAr(id: string, op: "mark_sent" | "snooze" | "escalate", days?: number) {
    if (dispatching) return;
    setDispatching(id);
    try {
      const ok = await call(`/api/actions/${id}/ar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...(days != null ? { days } : {}) }),
      });
      if (ok) { back(); startTransition(() => router.refresh()); }
    } finally {
      setDispatching(null);
    }
  }

  if (selected) {
    return <DetailView
      row={selected}
      reason={reason}
      setReason={setReason}
      busy={isBusy}
      onBack={back}
      onDecision={dispatchDecision}
      onActionPatch={dispatchActionPatch}
      onAr={dispatchAr}
    />;
  }

  const noPendingAtAll = rows.length === 0;
  const filteredEmpty = !noPendingAtAll && visibleRows.length === 0;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1
          className="text-[28px] font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Decision Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Permission requests waiting on your approval. Resolved items are in the{" "}
          <Link href="/audit-trail" className="underline">audit trail</Link>.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard value={visibleRows.length} label="Pending" />
      </div>

      <InboxFilterBar filters={filters} onChange={setFiltersAndUrl} />

      {noPendingAtAll ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Nothing waiting on you. The agent will queue items here when it needs your call.
        </div>
      ) : filteredEmpty ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No items match these filters.{" "}
          <button onClick={clearFilters} className="underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((r) => (
            <button
              key={`${r.source}_${r.id}`}
              onClick={() => setSelected(r)}
              className="w-full text-left border border-border rounded-lg p-4 bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <KindChip kind={r.kind} />
                {r.severity && <SeverityBadge severity={r.severity} />}
                <h3 className="font-semibold text-base">{r.headline}</h3>
              </div>
              {r.detail && <p className="text-xs text-muted-foreground mb-2 ml-1">{r.detail}</p>}
              <p className="text-xs text-muted-foreground ml-1">
                {new Date(r.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailView({
  row, reason, setReason, busy, onBack, onDecision, onActionPatch, onAr,
}: {
  row: InboxRow;
  reason: string;
  setReason: (s: string) => void;
  busy: boolean;
  onBack: () => void;
  onDecision: (id: string, outcome: "approve" | "reject" | "needs_info") => void;
  onActionPatch: (id: string, status: "approved" | "dismissed") => void;
  onAr: (id: string, op: "mark_sent" | "snooze" | "escalate", days?: number) => void;
}) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={16} /> Back to inbox
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <KindChip kind={row.kind} />
          {row.severity && <SeverityBadge severity={row.severity} />}
          <h1 className="text-2xl font-semibold">{row.headline}</h1>
        </div>
        {row.detail && <p className="text-sm text-muted-foreground">{row.detail}</p>}
        <p className="text-xs text-muted-foreground">
          Filed {new Date(row.createdAt).toLocaleString()}
        </p>
      </div>

      {row.source === "decision" && row.decision?.proposal && (
        <ProposalBlock p={row.decision.proposal} />
      )}

      {row.source === "action" && row.kind === "ar_followup" && (
        <ArDraftBlock actionId={row.id} />
      )}

      <ButtonRow
        row={row}
        reason={reason}
        setReason={setReason}
        busy={busy}
        onDecision={onDecision}
        onActionPatch={onActionPatch}
        onAr={onAr}
      />
    </div>
  );
}

function ProposalBlock({ p }: { p: NonNullable<NonNullable<InboxRow["decision"]>["proposal"]> }) {
  return (
    <div className="border border-border rounded-lg p-6 bg-card space-y-3">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
        Journal Adjustment
      </h2>
      <p className="text-sm">{p.description}</p>
      <div className="grid grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">DR</div>
          <div className="font-mono">{p.debitAccount}</div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">CR</div>
          <div className="font-mono">{p.creditAccount}</div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">Amount</div>
          <div className="font-semibold">{p.amount.toFixed(2)} {p.currency}</div>
        </div>
      </div>
      {p.break && (
        <p className="text-xs text-muted-foreground">
          From break {p.break.id} ({p.break.side})
          {p.break.periodKey ? ` · period ${p.break.periodKey}` : ""}
        </p>
      )}
    </div>
  );
}

function ArDraftBlock({ actionId }: { actionId: string }) {
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/actions/${actionId}/ar`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setBody(j.draftBody ?? null); })
      .catch(() => { if (!cancelled) setBody(null); });
    return () => { cancelled = true; };
  }, [actionId]);

  if (body == null) return <div className="text-xs text-muted-foreground">Loading draft…</div>;
  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
        Draft email
      </h2>
      <pre className="text-xs whitespace-pre-wrap font-sans">{body}</pre>
    </div>
  );
}

function ButtonRow({
  row, reason, setReason, busy, onDecision, onActionPatch, onAr,
}: {
  row: InboxRow;
  reason: string;
  setReason: (s: string) => void;
  busy: boolean;
  onDecision: (id: string, outcome: "approve" | "reject" | "needs_info") => void;
  onActionPatch: (id: string, status: "approved" | "dismissed") => void;
  onAr: (id: string, op: "mark_sent" | "snooze" | "escalate", days?: number) => void;
}) {
  const btn = "px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50";
  const primary = `${btn} bg-green-600 text-white`;
  const danger = `${btn} bg-red-600 text-white`;
  const neutral = `${btn} border border-border`;

  if (row.source === "decision") {
    return (
      <div className="space-y-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional for approve/needs-info, recommended for reject)"
          className="w-full px-3 py-2 bg-card border border-border rounded text-sm min-h-[80px]"
        />
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => onDecision(row.id, "approve")} className={primary}>Approve</button>
          <button disabled={busy} onClick={() => onDecision(row.id, "reject")} className={danger}>Reject</button>
          <button disabled={busy} onClick={() => onDecision(row.id, "needs_info")} className={neutral}>Needs Info</button>
        </div>
      </div>
    );
  }

  if (row.kind === "variance") {
    return (
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => onActionPatch(row.id, "approved")} className={primary}>Approve</button>
        <button disabled={busy} onClick={() => onActionPatch(row.id, "dismissed")} className={neutral}>Dismiss</button>
      </div>
    );
  }
  if (row.kind === "anomaly" || row.kind === "recommendation") {
    return (
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => onActionPatch(row.id, "approved")} className={primary}>Acknowledge</button>
        <button disabled={busy} onClick={() => onActionPatch(row.id, "dismissed")} className={neutral}>Dismiss</button>
      </div>
    );
  }
  if (row.kind === "reconciliation_break") {
    const href = row.breakId
      ? `/financial-reconciliation?breakId=${row.breakId}`
      : `/financial-reconciliation`;
    return (
      <div className="flex gap-3">
        <Link href={href} className={primary}>
          Investigate
        </Link>
        <button disabled={busy} onClick={() => onActionPatch(row.id, "dismissed")} className={neutral}>Dismiss</button>
      </div>
    );
  }
  if (row.kind === "ar_followup") {
    return (
      <div className="flex gap-3 flex-wrap">
        <button disabled={busy} onClick={() => onAr(row.id, "mark_sent")} className={primary}>Mark Sent</button>
        <button disabled={busy} onClick={() => onAr(row.id, "snooze", 7)} className={neutral}>Snooze 7d</button>
        <button disabled={busy} onClick={() => onAr(row.id, "escalate")} className={danger}>Escalate</button>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 3: Run typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Run the full vitest suite**

```
npx vitest run
```

Expected: all previously-passing tests still pass, plus the new filter tests from Task 4. Existing component test `tests/component/inbox-row-buttons.test.tsx` may break because it doesn't pass `initialFilters` — fix in Step 5.

- [ ] **Step 5: Update existing component tests for new prop**

Open `tests/component/inbox-row-buttons.test.tsx`. Find every `<DecisionInboxClient rows={...} />` usage and add `initialFilters={ALL_FILTERS}`. Add the import at the top:

```ts
import { ALL_FILTERS } from "@/app/(shell)/decision-inbox/inbox-filter-bar";
```

Then update each render call:

```tsx
render(<DecisionInboxClient rows={[...]} initialFilters={ALL_FILTERS} />);
```

(Use Edit with `replace_all` on the literal `<DecisionInboxClient rows={` if helpful, but verify the result.)

- [ ] **Step 6: Run the full vitest suite again**

```
npx vitest run
```

Expected: all green again.

- [ ] **Step 7: Self-review the diff**

```
git diff HEAD
git status
```

Verify:
- `page.tsx` accepts and parses searchParams.
- Client renders `<InboxFilterBar>` and uses `applyFilters`.
- KindChip + SeverityBadge are rendered both on list rows AND in the detail view header.
- Metric card shows `visibleRows.length`, not `rows.length`.
- Two empty states are conditionally rendered.
- `tests/component/inbox-row-buttons.test.tsx` updated to pass `initialFilters`.

- [ ] **Step 8: Commit**

```bash
git add app/\(shell\)/decision-inbox/page.tsx app/\(shell\)/decision-inbox/decision-inbox-client.tsx tests/component/inbox-row-buttons.test.tsx
git commit -m "feat(inbox): wire filter bar + chips into the list and detail view"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test run**

```
npx vitest run
```

Expected: all tests pass except the pre-existing `tests/chat-route/pipeline-sse.test.ts` flake (1 fail). If a different test fails, that's a regression you introduced.

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Manual smoke (controller does this)**

The implementer reports DONE. The controller (parent session) restarts the dev server in the worktree and verifies in browser:

| Flow | Expected |
|------|----------|
| `/decision-inbox` (no params) | Filter bar with 3 groups, all "All" selected; same row count as before; rows show Recon chip on the left, Severity badge if present |
| Click "Recon" pill | URL becomes `/decision-inbox?kind=reconciliation_break`; only recon rows visible; metric count drops to that subset |
| Click "High" severity pill | URL adds `&severity=high`; only high-severity rows; if Decisions were visible they vanish |
| Click "> 30d" | URL adds `&age=gt_30d`; only old rows |
| Reload page | Filters preserved (URL is source of truth) |
| Pick a combo that produces 0 rows | "No items match these filters. Clear filters" empty state |
| Click "Clear filters" | URL goes back to bare `/decision-inbox`; all rows visible |

If anything in the manual checklist fails, do NOT mark Task 6 done. Report back to the controller.

---

## Done definition

- All filter helpers (`parseFilters`, `filtersToQueryString`, `applyFilters`) covered by unit tests.
- `InboxFilterBar` interactions covered by component tests.
- Existing `inbox-row-buttons.test.tsx` updated for the new prop and still passing.
- Typecheck clean; full suite passes (modulo the pre-existing pipeline-sse flake).
- KindChip + SeverityBadge render on both list rows and the detail view header.
- URL is source of truth for filters; default state is everything-"all".
