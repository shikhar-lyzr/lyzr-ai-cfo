# Decision Inbox — Dynamic (filterable + scannable rows)

**Date:** 2026-04-27
**Status:** Spec — pending implementation plan
**Builds on:** `2026-04-27-unified-decision-inbox-design.md`

## Problem

The unified Decision Inbox (just shipped on `feature/unified-decision-inbox`)
collapses Decision + pending Action rows into one list. In real data this
list is dominated by `reconciliation_break` Actions — the user's screen now
shows 141 nearly identical rows, all titled "Unresolved break: GL entry",
all dated the same minute, all the same kind. There is no way to:

1. Tell rows apart at a glance.
2. Focus on a subset (e.g. "show me only high-severity recon-breaks aged > 30 days").
3. Bookmark a filtered view.

## Decision

Two changes to the existing inbox, shipped as one PR:

1. **Restructured row visuals.** Each row gets a left-aligned `kind` chip and a
   severity badge (when the row has a severity). Headline + detail text are
   preserved.
2. **URL-driven filter bar.** Three single-select filter groups — kind, severity,
   age — at the top of the list. Filter state lives in `searchParams`
   (`?kind=…&severity=…&age=…`), so URLs are shareable and survive refresh.
   Filtering is client-side — the page still fetches all pending rows and the
   client component hides ones that don't match.

Default state: all filters set to "All". No filter pre-applied.

## Out of scope

- **Search box** — text search over headlines/details. Not yet; the kind+age
  filter cuts most of the noise.
- **Bulk actions** — multi-select dismiss across many rows. Premature.
- **Server-side filter (Prisma `where:`)** — current pending volume (low
  thousands at worst) doesn't justify it. Revisit at 10k+.
- **Severity vocabulary normalisation across the app.** The existing
  `components/command-center/filter-bar.tsx` uses `critical|warning|info`
  while the schema uses `high|medium|low`. We adopt the schema vocabulary in
  the inbox and leave the existing FilterBar alone. Aligning is a separate task.
- **Schema work to extract amount/age out of `Action.detail` text.** Phase 2 will
  rework recon_break Actions to carry structured fields. Today we display what
  the detail text already says.
- **Path A** (promoting variance/AR into Decision rows) — still deferred from
  the original unified-inbox spec.

## Row visual restructure

Today's row markup (simplified):

```
<button>
  <h3>{headline}</h3>
  <p>{detail}</p>
  <p>{timestamp} · {kind}</p>
</button>
```

New markup:

```
<button>
  <div class="row-top">
    <KindChip kind={r.kind} />
    {r.severity && <SeverityBadge severity={r.severity} />}
    <h3>{headline}</h3>
  </div>
  {detail && <p>{detail}</p>}
  <p>{timestamp}</p>   {/* kind moved into the chip */}
</button>
```

### KindChip

Six values map to short labels and pastel-bg/dark-fg pill colors. Tailwind
classes only; no new colors in `globals.css`.

| kind                  | label  | bg / fg |
|-----------------------|--------|---------|
| post_journal          | Decision | `bg-blue-100 text-blue-900` |
| variance              | Variance | `bg-amber-100 text-amber-900` |
| anomaly               | Anomaly  | `bg-rose-100 text-rose-900` |
| recommendation        | Rec      | `bg-violet-100 text-violet-900` |
| ar_followup           | AR       | `bg-emerald-100 text-emerald-900` |
| reconciliation_break  | Recon    | `bg-orange-100 text-orange-900` |

### SeverityBadge

Three values, only rendered when `row.action?.severity` is one of them. Decisions
have no severity column → no badge.

| severity | label     | classes |
|----------|-----------|---------|
| high     | High      | `bg-red-600 text-white` |
| medium   | Medium    | `bg-amber-500 text-white` |
| low      | Low       | `bg-gray-300 text-gray-800` |

`InboxRow` gains an optional `severity?: "high" | "medium" | "low"` field,
populated by `actionToRow` from `Action.severity`. (Decisions stay
severity-less.)

## Filter bar

Single horizontal row above the list, three filter groups, single-select pills
each. Visual style mirrors the existing `components/command-center/filter-bar.tsx`
to keep the codebase consistent — but the inbox's filter component is a
separate file (`inbox-filter-bar.tsx`) because the values are different.

Layout:

```
KIND      [All] [Decision] [Variance] [Anomaly] [Rec] [AR] [Recon]
SEVERITY  [All] [High] [Medium] [Low]
AGE       [Any age] [< 7d] [7–30d] [> 30d]
```

### Filter values

```ts
type KindFilter =
  | "all"
  | "post_journal"
  | "variance"
  | "anomaly"
  | "recommendation"
  | "ar_followup"
  | "reconciliation_break";

type SeverityFilter = "all" | "high" | "medium" | "low";

type AgeFilter = "all" | "lt_7d" | "7_30d" | "gt_30d";
```

### Severity-filter behaviour for Decision rows

When `severity` filter is anything other than `all`, Decision rows are hidden
(they have no severity field, so they can't match). When it is `all`, Decision
rows participate normally.

### Age buckets (relative to "now" at filter-application time)

- `lt_7d` → `now - createdAt < 7d`
- `7_30d` → `7d ≤ now - createdAt ≤ 30d`
- `gt_30d` → `now - createdAt > 30d`

Computed client-side. `Date.now()` evaluated once per render — adequate; one
day of drift across a long-lived tab is not a correctness issue here.

## URL state

URL is the source of truth. The page (server component) reads `searchParams`
and passes the parsed values to the client as `initialFilters`. The client
holds them in `useState` so pill clicks feel instant, and on each click also
calls `router.replace()` to keep the URL in sync. On refresh / back-button
navigation, the URL repopulates `initialFilters`.

```ts
// app/(shell)/decision-inbox/page.tsx
type SearchParams = {
  kind?: KindFilter;
  severity?: SeverityFilter;
  age?: AgeFilter;
};
```

Invalid or unknown values silently fall back to `"all"` (don't throw).

## Empty-state copy

When the filter combination produces zero rows but the underlying pending list
is non-empty, the inbox shows a different empty state from the "no pending
items" one:

> "No items match these filters. [Clear filters]"

The `[Clear filters]` link resets all three filters to `"all"` (i.e. navigates
to `/decision-inbox` with no query string).

When the underlying pending list is *also* empty, current copy is preserved:

> "Nothing waiting on you. The agent will queue items here when it needs your call."

## Pending-count metric card

The "Pending" metric card shows the **filtered** count, not the total. (When
all filters are "All" the two are equal.) This matches the user's mental model:
"the number on the card is the number of rows I see below."

## Files

**New:**
- `app/(shell)/decision-inbox/inbox-filter-bar.tsx` — three filter groups,
  pill-button group helper. Mirrors the existing command-center FilterBar's
  visual style; new file because the value sets differ.

**Modified:**
- `app/(shell)/decision-inbox/inbox-row.ts` — add optional `severity?: "high" | "medium" | "low"` to `InboxRow`. `actionToRow` reads `Action.severity` and includes it when valid.
- `app/(shell)/decision-inbox/page.tsx` — accept `searchParams`, parse the three filter params with safe fallback, pass as `initialFilters` prop to client.
- `app/(shell)/decision-inbox/decision-inbox-client.tsx` — render `InboxFilterBar`; track filter state via `useState` initialised from `initialFilters`; on filter change, `router.replace()` the URL; compute filtered list via `useMemo`; render KindChip + SeverityBadge per row; updated metric-card count + empty-state.

**Tests:**
- `tests/unit/inbox-row-mappers.test.ts` — extend with: `actionToRow` populates `severity` when present, leaves it undefined when missing, ignores unknown severity strings.
- `tests/component/inbox-filter.test.tsx` (new) — vitest + jsdom: filter bar interactions update URL (`router.replace` called with right param); clearing filters navigates to bare path; filter equality semantics (selecting "high severity" hides Decisions and low/medium Actions).

## Testing

Component-level (vitest + jsdom):
- Each filter group: clicking a pill calls `router.replace` with the right `?key=value` (or removes the param when "all").
- Selecting `severity=high` hides Decision rows.
- Selecting `age=gt_30d` shows only rows with `createdAt < now - 30d`. Use `vi.useFakeTimers` or pass a fixed "now" to the filter logic.
- Empty-state copy switches when filters produce zero rows and underlying list is non-empty.
- Pending metric card shows filtered count.

Mapper unit tests:
- `actionToRow({severity: "high"})` → row.severity === "high".
- `actionToRow({severity: undefined})` → row.severity undefined.
- `actionToRow({severity: "potato"})` → row.severity undefined. (`Action.severity`
  is typed `string` in Prisma; the mapper narrows it to the known three values
  and drops anything else. Same shape as the existing `kind` narrowing.)

No new integration tests — page loader behavior is unchanged from the prior
plan.

## Risks / open questions

- **Severity vocabulary mismatch with the rest of the app.** The existing
  command-center FilterBar uses `critical|warning|info`. We use
  `high|medium|low` (schema). Two filter bars on different pages will show
  different vocabulary. Accepted; aligning is out of scope.
- **Date.now() evaluated at render** — fine for now; if "the user keeps the tab
  open for hours" becomes a real workflow, age buckets could go stale. Cheap
  fix later: window-focus event triggers a re-render.
- **Filter parameter pollution.** Phase 2's break-detail page is on a
  *different* route (`/financial-reconciliation`), so it does not read these
  filter params and won't conflict.
