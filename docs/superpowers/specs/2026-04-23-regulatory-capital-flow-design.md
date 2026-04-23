# Regulatory Capital Flow — Design

**Date:** 2026-04-23
**Status:** Approved (ready for implementation plan)
**Scope:** Basel III Pillar 1 capital adequacy — ratios + RWA breakdown (the "B-phase"), with data model and architecture shaped so leverage ratio and capital buffers (the "C-phase") can be added additively.

## Goal

Turn the static mock at [app/(shell)/regulatory-capital/page.tsx](../../../app/(shell)/regulatory-capital/page.tsx) into a real, period-aware, upload-driven flow that mirrors the pattern already used by monthly-close and financial-reconciliation: CSV upload → Prisma persist → period-aware computation → page renders from DB → Ask-AI integration through journey-context.

## Non-goals (for this spec)

- Leverage ratio card and computation (C-phase — additive schema extension).
- Capital buffers: CCB, CCyB, G-SIB/D-SIB surcharges (C-phase — adds an `"above_minimum"` amber tier, shifts the comparison to `ratio vs (minimum + required_buffers)`).
- Historical trend charts (the "CET1 trend" nudge will be answered textually by the AI for now; charting is its own effort).
- Direct integrations with regulatory reporting tools (Moody's RiskAuthority, OneSumX, AxiomSL). CSV upload is the ingestion path; integrations are a later, separate effort using the same data model.

## Scoping decisions

### Scope level — B, with C staged

Agreed: implement the B-phase (ratios + RWA breakdown). Data model is designed so C-phase features slot in additively — new `component` string values, new `CapitalSnapshot` columns, no restructuring.

### Upload shape — two separate CSVs

Capital components and RWA breakdown ingest as two separate shapes, matching how the data is actually sourced at banks (treasury owns capital components, risk owns RWA). Capital components is **required** to compute ratios; RWA breakdown is **optional** and unlocks the "what drives RWA?" drill-down. Mirrors the reconciliation pattern (GL + sub-ledger + FX — each optional, each unlocking progressively richer signals).

### Ratio status tiers — hardcoded Basel III minimums, buffers deferred to C

For the B-phase, status is binary: `above_buffer` (green) or `below_minimum` (red). The `RatioStatus` type includes a third `above_minimum` (amber) value that the B-phase never produces — it is there so the C-phase can extend the comparison to `ratio vs (minimum + required_buffers)` without changing callers.

## Data model

Four new Prisma models.

```prisma
model CapitalPeriod {
  id        String   @id @default(cuid())
  userId    String
  periodKey String   // "2026-03", "2026-Q1", "2026"
  status    String   @default("open")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, periodKey])
  @@index([userId, createdAt])
}

model CapitalComponent {
  id           String   @id @default(cuid())
  dataSourceId String
  periodKey    String
  component    String   // "cet1_capital" | "additional_tier1" | "tier2" |
                        // "goodwill" | "dta" | "other_deduction" | "total_rwa"
  amount       Float    // positive; deductions stored positive, sign applied by stats
  currency     String   @default("USD")
  createdAt    DateTime @default(now())

  dataSource DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@index([dataSourceId, periodKey])
  @@index([periodKey, component])
}

model RwaLine {
  id             String   @id @default(cuid())
  dataSourceId   String
  periodKey      String
  riskType       String   // "credit" | "market" | "operational"
  exposureClass  String   // "corporate" | "retail_mortgage" | "sovereign" | ...
  exposureAmount Float
  riskWeight     Float    // decimal, not percent (0.5 not 50)
  rwa            Float    // carried from source; see "why carry rwa explicitly" below
  createdAt      DateTime @default(now())

  dataSource DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@index([dataSourceId, periodKey])
  @@index([periodKey, riskType])
}

model CapitalSnapshot {
  id           String   @id @default(cuid())
  userId       String
  periodKey    String
  cet1Ratio    Float
  tier1Ratio   Float
  totalRatio   Float
  cet1Capital  Float    // net of deductions
  tier1Capital Float
  totalCapital Float
  totalRwa     Float
  computedAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, periodKey])
  @@index([userId, computedAt])
}
```

The `User` model gains relations to `CapitalPeriod` and `CapitalSnapshot`. The `DataSource` model gains relations to `CapitalComponent` and `RwaLine`.

### Design notes

- **Both `CapitalComponent` rows AND `CapitalSnapshot` rollup exist** — same rationale as `MatchRun` + `Break`. Snapshot is the fast path for page renders and is deterministic; components are the audit trail. Replacing an upload recomputes the snapshot.
- **`rwa` is carried explicitly on `RwaLine`** rather than computed as `exposureAmount × riskWeight` because real risk engines apply credit conversion factors, collateral haircuts, and rounding that make the product differ from the source's reported RWA. Trusting the source value avoids silently disagreeing with the bank's own filing.
- **`component` is a string, not an enum** — matches `DataSource.type`, `Break.severity`. C-phase adds values (`"leverage_exposure"`, `"ccb_requirement"`, `"ccyb_requirement"`, `"gsib_surcharge"`) without a constraint migration.
- **Dedup is handled by the parent `DataSource.contentHash`** — the existing `/api/upload` dedup plumbing applies unchanged.
- **C-phase extensions:**
  - New `component` string values (listed above).
  - New `CapitalSnapshot` columns: `leverageRatio`, `bufferRequired`, `bufferMet`. Additive, one migration.
  - No new tables.

## Ingestion

### CSV shape detection

Extend [lib/csv/detect-shape.ts](../../../lib/csv/detect-shape.ts) with two new shapes:

- `capital_components` — headers include `period`, `component`, `amount`; optionally `currency`.
- `rwa_breakdown` — headers include `period`, `risk_type`, `exposure_class`, `exposure_amount`, `risk_weight`, `rwa`.

Detection is header-based (same as `gl` / `sub_ledger` / `fx` / `ar` / `variance`). No ambiguity: `rwa_breakdown` requires `risk_type`, `capital_components` does not.

### Parser

New `lib/csv/capital-parser.ts` exports:

- `parseCapitalComponents(headers, rows) → { components: CapitalComponentRow[], skipped: SkippedRow[] }`
- `parseRwaBreakdown(headers, rows) → { lines: RwaLineRow[], skipped: SkippedRow[] }`

Validation:
- `component` values are normalized (lowercased, whitespace-collapsed) against a known set. Unknown values fall into `"other_deduction"` with a `skipped`-row note — banks sometimes use non-standard component naming, and the LLM column mapper fallback doesn't apply here because this is a row-level issue not a header-level one.
- `amount` and `exposure_amount` must parse as numbers; negative values are rejected (deductions expressed as positive amounts; sign applied by stats layer).
- `risk_weight` accepts `0.5` or `50%`; normalizes to decimal.
- `period` must match the project's periodKey format (`YYYY-MM`, `YYYY-Qn`, `YYYY`). Unparseable rows are skipped, not errored.

### Persistence

New `lib/capital/persist.ts`:

- `ingestCapitalComponents(userId, fileName, headers, rows, contentHash) → { dataSource, skipped, periodsTouched }` — mirrors `ingestGl`:
  1. Create `DataSource` with `type: "capital_components"`.
  2. Parse rows.
  3. Upsert `CapitalPeriod` for each touched period.
  4. `createMany` `CapitalComponent` rows.
  5. Mark DataSource `ready`.
- `ingestRwaBreakdown(...)` — same structure, writes `RwaLine`.

### Upload route

Extend [app/api/upload/route.ts](../../../app/api/upload/route.ts) with two new branches after the existing `gl` / `sub_ledger` / `fx` branches:

```ts
if (shape === "capital_components") {
  const { dataSource, skipped, periodsTouched } = await ingestCapitalComponents(...);
  return NextResponse.json({ kind: "capital_components", dataSource, skipped: skipped.length, periodsTouched });
}
if (shape === "rwa_breakdown") {
  const { dataSource, skipped, periodsTouched } = await ingestRwaBreakdown(...);
  return NextResponse.json({ kind: "rwa_breakdown", dataSource, skipped: skipped.length, periodsTouched });
}
```

Snapshot recompute happens **inside** `ingestCapitalComponents` and `ingestRwaBreakdown` — after the rows are persisted, the persist function calls `recomputeCapitalSnapshot(userId, periodKey)` for each period in `periodsTouched` before returning. This keeps the upload route thin and ensures the recompute can't be accidentally forgotten by a future caller.

Recompute is **synchronous** (not fire-and-forget) — same reason reconciliation auto-match is: serverless runtimes (Vercel, Netlify) do not guarantee detached promises complete, and the page redirect relies on the snapshot existing. Snapshot computation is cheap (a few aggregate queries).

### Data-sources tab

Add a fourth tab `capital` to [app/(shell)/data-sources/page.tsx](../../../app/(shell)/data-sources/page.tsx), alongside `variance`, `ar`, `reconciliation`. Tab filter matches `s.type === "capital_components"` or `s.type === "rwa_breakdown"`. Upload hint: "Upload a capital components CSV or RWA breakdown CSV — we auto-detect the shape." On successful upload, redirect to `/regulatory-capital`.

## Computation

New module `lib/capital/` with five files.

### `lib/capital/minimums.ts`

```ts
export const BASEL_III_MINIMUMS = {
  cet1: 0.045,   // 4.5%
  tier1: 0.060,  // 6.0%
  total: 0.080,  // 8.0%
} as const;

export type RatioKey = keyof typeof BASEL_III_MINIMUMS;

// Callers use effectiveMinimum() rather than reading BASEL_III_MINIMUMS directly,
// so the C-phase can add buffer logic here without touching callers.
export function effectiveMinimum(key: RatioKey): number {
  return BASEL_III_MINIMUMS[key];
}
```

### `lib/capital/period.ts`

Mirrors [lib/close/period.ts](../../../lib/close/period.ts):

- `listCapitalPeriods(userId)` — all `CapitalPeriod` rows, newest first.
- `resolveActivePeriod(periods, requested)` — requested if valid, else newest.
- `safely(fn, fallback)` — same safety wrapper used on the monthly-close page.

### `lib/capital/stats.ts`

- `getCapitalSnapshot(userId, periodKey): Promise<Snapshot | { hasData: false }>` — fast read path. Returns the persisted `CapitalSnapshot` row, or `{ hasData: false }` if none.

- `recomputeCapitalSnapshot(userId, periodKey): Promise<Snapshot | { hasData: false }>` — called from upload path:
  1. Fetch all `CapitalComponent` rows for this period (user-scoped via `DataSource` join).
  2. Dedupe exact-duplicate rows — two rows are duplicates when `(periodKey, component, amount, currency)` all match. Same pattern as variance dedupe in [lib/close/stats.ts:255](../../../lib/close/stats.ts#L255); handles the same-CSV-uploaded-twice case. This is **not** a merge across legitimate multi-row entries for the same component (e.g. two separate goodwill lines from different subsidiaries) — those will have different amounts and both will sum correctly in step 3.
  3. Aggregate:
     - `cet1Gross = sum(cet1_capital)`
     - `deductions = sum(goodwill) + sum(dta) + sum(other_deduction)`
     - `cet1Net = cet1Gross - deductions`
     - `at1 = sum(additional_tier1)`
     - `tier1 = cet1Net + at1`
     - `t2 = sum(tier2)`
     - `totalCapital = tier1 + t2`
     - `totalRwa = sum(total_rwa)`
  4. **RWA reconciliation:** if RWA breakdown also present for the period, compare `totalRwa` from capital components to `sum(rwa)` from `RwaLine` rows. If they disagree by more than 1%, prefer the capital-components total (treasury's authoritative input to ratios) but flag the discrepancy so the agent can surface it.
  5. Compute ratios: `cet1Ratio = cet1Net / totalRwa`, etc. If `totalRwa === 0`, return `{ hasData: false }` — ratios undefined.
  6. Upsert `CapitalSnapshot`.

- `getRwaBreakdown(userId, periodKey): Promise<RwaBreakdownRow[]>` — aggregates `RwaLine` by `riskType`, returns `{ riskType, totalRwa, share, lines }` per risk type. `[]` if no RWA upload.

- `getCapitalBreaches(userId, periodKey): Promise<Breach[]>`:

  ```ts
  type Breach =
    | { kind: "ratio_breach"; ratio: RatioKey; value: number; minimum: number; gap: number }
    | { kind: "missing_source"; sourceType: "capital_components" | "rwa_breakdown" }
    | { kind: "rwa_mismatch"; capitalTotal: number; rwaLineTotal: number; deltaPct: number };
  ```

  - `ratio_breach` when a ratio falls below `effectiveMinimum(key)`.
  - `missing_source` for `capital_components` is a hard block — no snapshot possible.
  - `missing_source` for `rwa_breakdown` is a soft warning — snapshot still computes.
  - `rwa_mismatch` only flagged when both uploads are present and totals diverge > 1%.

### `lib/capital/index.ts`

Barrel re-exports: `listCapitalPeriods`, `resolveActivePeriod`, `safely`, `getCapitalSnapshot`, `recomputeCapitalSnapshot`, `getRwaBreakdown`, `getCapitalBreaches`, `effectiveMinimum`, `BASEL_III_MINIMUMS`.

### Status type

```ts
export type RatioStatus = "above_buffer" | "above_minimum" | "below_minimum";
// B-phase produces only above_buffer (green) and below_minimum (red).
// C-phase adds above_minimum (amber) when ratio is above the minimum but
// inside the buffer requirement.
```

## Page rendering

Rewrite [app/(shell)/regulatory-capital/page.tsx](../../../app/(shell)/regulatory-capital/page.tsx) from static mock to a real page, mirroring [app/(shell)/monthly-close/page.tsx](../../../app/(shell)/monthly-close/page.tsx).

```
async function RegulatoryCapitalPage({ searchParams: { period? } })
  ├── getSession() → userId (or empty-state if not signed in)
  ├── listCapitalPeriods(userId) → periods
  │    └── if empty: empty-state → /data-sources?tab=capital
  ├── resolveActivePeriod(periods, requested) → active
  ├── Parallel fetch:
  │    ├── safely(getCapitalSnapshot)   → snapshot
  │    ├── safely(getCapitalBreaches)   → breaches
  │    └── safely(getRwaBreakdown)      → rwaBreakdown (may be empty)
  └── Render
```

### Sections

1. **Header row** — period picker (new `PeriodPicker` client component, same pattern as [app/(shell)/monthly-close/period-picker.tsx](../../../app/(shell)/monthly-close/period-picker.tsx)).

2. **Three ratio cards** — replaces the current static `CAPITAL_RATIOS.map()`. Each card shows the big ratio value, "Min. required: X%", a progress bar colored by `RatioStatus`, and an `ExplainButton`. If no snapshot, show `—` placeholders and a link to upload.

3. **Breaches section** — renders only if `breaches.length > 0`:
   - `ratio_breach` row: "CET1 is 4.1% — below 4.5% minimum (gap: 0.4%)" with `ExplainButton`.
   - `missing_source` row: "No RWA breakdown uploaded for 2026-Q1" with an Upload link.
   - `rwa_mismatch` row: "Capital components report $X RWA, RWA breakdown sums to $Y (2.3% gap)" with `ExplainButton`.

4. **RWA breakdown section** — renders only if `rwaBreakdown.length > 0`. Table: Risk Type | Total RWA | Share | # exposure classes. **All rows are collapsed by default**; clicking a row expands it in place to show its exposure-class lines. Only one row expanded at a time. If empty: small "Upload RWA breakdown to see what drives your RWA" hint.

5. **JourneyPage nudges** — keep existing three: "Are we above minimums?", "What drives RWA?", "CET1 trend".

### Empty-state matrix

| Snapshot | RWA | Rendered |
|---|---|---|
| No | No | Three `—` cards; empty-state → `/data-sources?tab=capital`. |
| Yes | No | Real ratio cards; breach section with "missing RWA breakdown" soft warning; no RWA table. |
| Yes | Yes | Cards + breaches + RWA table. |
| No | Yes | Three `—` cards; breach section with "missing capital components" hard block. |

### New client components

- `app/(shell)/regulatory-capital/period-picker.tsx` — copy of monthly-close picker.
- `app/(shell)/regulatory-capital/explain-button.tsx` — copy of monthly-close ExplainButton (fork if they diverge later).

## AI agent integration

### Journey context builder

New file `lib/agent/journey-context/regulatory-capital.ts`. Register in [lib/agent/journey-context/index.ts](../../../lib/agent/journey-context/index.ts):

- Add `"regulatory-capital": buildCapitalContext` to `BUILDERS`.
- Add a period-resolution branch (same pattern as the reconciliation branch, but reading from `CapitalPeriod`).

The builder emits a markdown block appended to the agent's system prompt:

```
## Current Journey: Regulatory Capital
### Period: 2026-Q1

### Snapshot
CET1 ratio: 13.2% (min 4.5%) — above
Tier 1 ratio: 15.1% (min 6.0%) — above
Total Capital ratio: 17.8% (min 8.0%) — above
CET1 capital (net of deductions): $12.4B
Total RWA: $93.9B

### Deductions applied
Goodwill: $0.8B
Deferred tax assets: $0.3B

### RWA breakdown (if uploaded)
Credit risk: $78.2B (83%)
Market risk: $9.1B (10%)
Operational risk: $6.6B (7%)

### Breaches / warnings
(none, or list them)

### Uploads present
Capital components: yes (as of 2026-04-15)
RWA breakdown: yes (as of 2026-04-15)
```

Pulls from `getCapitalSnapshot`, `getRwaBreakdown`, `getCapitalBreaches` — the same functions the page uses, so the agent sees what the user sees. If no snapshot, the builder returns a short "no capital data for this period — tell the user to upload via /data-sources?tab=capital" message.

### Agent tools

**No new gitclaw `tool()` definitions for the B-phase.** Rationale: existing tools operate on variance/AR data and aren't relevant here. The journey-context block above contains the full snapshot, and the close and reconciliation journeys also lean on context rather than tools for "explain this number" questions. Tools are reserved for state-mutating actions (create actions, post adjustments, send emails). C-phase may add tools for actions like "propose capital restoration plan" or "draft buffer breach disclosure document."

### Chat/actions API registration

Add `"regulatory-capital"` to the set of `journeyId` values the `/api/chat` and `/api/actions` routes forward into `buildContext`. A grep-and-add; no new logic.

### ExplainButton prompts

- Ratio card: `"Explain why the ${ratio} ratio is ${value} for period ${periodKey}"`
- Ratio breach: `"Why is ${ratio} below the regulatory minimum for ${periodKey}? Suggest actions to restore it."`
- RWA table row: `"What drives ${riskType} RWA for ${periodKey}? Which exposure classes contribute most?"`
- RWA mismatch: `"The capital components file shows $X total RWA but the RWA breakdown sums to $Y. What could explain the discrepancy?"`

## Testing

Match the existing test conventions in [lib/reconciliation/__tests__](../../../lib/reconciliation/__tests__) and [lib/agent/__tests__](../../../lib/agent/__tests__):

- **Unit** — `lib/capital/__tests__/stats.test.ts`:
  - snapshot computation for the happy path.
  - deductions applied correctly; sign convention.
  - RWA reconciliation flagging at the 1% threshold boundary.
  - ratio breach detection at the minimum boundary (4.5% CET1 should not be a breach; 4.49% should).
  - zero-RWA returns `{ hasData: false }`.
  - dedup of exact-duplicate component rows.

- **Unit** — `lib/csv/__tests__/capital-parser.test.ts`:
  - happy-path parse of each shape.
  - risk_weight as `50%` vs `0.5` both normalize.
  - unknown component falls into `other_deduction` with skipped-row note.
  - negative amounts rejected.

- **Integration** — `app/api/upload/route.test.ts` gets new cases for each new shape: happy path creates `DataSource` + rows + snapshot; replay of the same file dedup-flags correctly; snapshot recomputes when a second file arrives.

- **Journey-context** — `lib/agent/journey-context/__tests__/registry.test.ts` gets a `regulatory-capital` case asserting the builder is registered and produces a non-empty string when data exists.

## Files touched or created

**Created:**
- `lib/capital/period.ts`
- `lib/capital/stats.ts`
- `lib/capital/persist.ts`
- `lib/capital/minimums.ts`
- `lib/capital/index.ts`
- `lib/capital/__tests__/stats.test.ts`
- `lib/csv/capital-parser.ts`
- `lib/csv/__tests__/capital-parser.test.ts`
- `lib/agent/journey-context/regulatory-capital.ts`
- `app/(shell)/regulatory-capital/period-picker.tsx`
- `app/(shell)/regulatory-capital/explain-button.tsx`

**Modified:**
- `prisma/schema.prisma` — four new models + `User`/`DataSource` relations.
- `lib/csv/detect-shape.ts` — add `capital_components` and `rwa_breakdown` shapes.
- `app/api/upload/route.ts` — add two new shape branches.
- `app/(shell)/data-sources/page.tsx` — add `capital` tab.
- `app/(shell)/regulatory-capital/page.tsx` — full rewrite from static mock to real page.
- `lib/agent/journey-context/index.ts` — register builder + period-resolution branch.
- `lib/agent/journey-context/__tests__/registry.test.ts` — add test case.
- `app/api/upload/route.test.ts` — add cases for new shapes.
- `app/api/chat/route.ts` and `app/api/actions/route.ts` (if they gate on `journeyId`) — allow `"regulatory-capital"`.

**Migration:**
- One Prisma migration adding the four new models plus relations.

## Risks & open questions

- **Sign convention for deductions.** Spec stores deductions as positive amounts and subtracts in the stats layer. If a bank's export expresses deductions as negatives, the parser should detect and normalize (easy fix in the parser, but worth a test case).
- **Ratio decimals vs percentages in the DB.** Spec stores ratios as decimals (0.132 for 13.2%). The page formats for display; the context block formats for display. Grep for inconsistencies during implementation.
- **CET1 trend nudge.** Answering textually for now is acceptable, but the AI only has the current period in context. If a user asks "how has CET1 moved across periods," the agent will need to either look it up itself or the context builder will need to include recent-period snapshots. Decide during implementation — likely a small extension to the context builder (include last 3 snapshots).
- **Currency.** Spec assumes a single currency per snapshot. If a multi-currency bank uploads mixed-currency components, the snapshot is wrong. Out of scope for B-phase; add a currency-normalization step in the persist layer if we hit it.
