# Monthly Close — Dynamic, Period-Aware Flow

**Status:** Design approved, pending implementation plan
**Date:** 2026-04-22
**Mirrors:** `2026-04-18-reconciliation-periods-design.md` (same patterns)

## Problem

`app/(shell)/monthly-close/page.tsx` renders entirely from two hardcoded constants (`MONTHLY_CLOSE_STEPS`, `MONTHLY_CLOSE_BLOCKERS`). No Prisma queries, no period awareness, no empty states, no agent context threading. The reconciliation page (`app/(shell)/financial-reconciliation/page.tsx`) is the reference for how period-aware flows should work in this product. Monthly close should match that bar: every visible number traces to a real row the user uploaded.

## Goals

1. Every metric on the monthly-close page is computed from existing Prisma tables. No hardcoded arrays.
2. Period-aware: URL-scoped `?period=YYYY-MM`, picker lets users switch periods, missing period falls back to most recent with data.
3. Empty states match reconciliation's discipline: route users to the action that fills them, never show fake numbers.
4. Agent chat panel receives `periodKey` and supports "Explain This" drill-down on metrics.

## Non-Goals (ship-later)

- Multi-entity / intercompany rollups — needs `Entity` schema migration.
- Formal approval / sign-off workflows — needs `User.role` + `CloseApproval` tables.
- ERP connectors (NetSuite/SAP/QuickBooks) — each is weeks of dedicated work.
- AI Journal Assistant UI — backend (`JournalAdjustment`, `GLEntry`) exists; UI is a follow-up spec.
- Continuous Close toggle — backend ready; UI + cron is a follow-up spec.

## Architecture

Server component page, same shape as reconciliation. All reads happen in parallel via a single `Promise.all`. No new Prisma models; a "close period" is derived from the union of `ReconPeriod.periodKey` and `DISTINCT FinancialRecord.period` for the user.

```
app/(shell)/monthly-close/page.tsx          — server component, period-scoped
app/(shell)/monthly-close/period-picker.tsx  — client, mirrors recon picker
app/(shell)/monthly-close/explain-button.tsx — client, dispatches openAskAi
app/api/close/periods/route.ts               — GET: list user's close periods + stats
app/api/close/readiness/route.ts             — GET: readiness score for one period
app/api/documents/generate/route.ts          — EXTENDED: accepts "close_package" type
lib/close/period.ts                           — period key helpers
lib/close/stats.ts                            — getCloseReadiness, getCloseBlockers
lib/close/tasks.ts                            — deriveTaskCounts from Prisma rows
lib/agent/index.ts                            — EXTENDED: close_package report type
agent/skills/monthly-close/SKILL.md           — NEW: gitclaw skill defining the 6-pillar instructions
```

### Agent architecture — one agent, many skills

We keep the existing single-agent topology: one Lyzr-hosted agent acts as the LLM brain, gitclaw provides the runtime. Journey-specific behavior lives in `agent/skills/<journey>/SKILL.md` files, which `loadSkillContent` ([lib/agent/index.ts:39](lib/agent/index.ts#L39)) pre-loads into the system prompt. Adding monthly-close is therefore `+1 SKILL.md + new tools in buildTools`, not `+1 agent`.

**When to split into sub-agents (future spec, not this one):** when the combined SKILL content plus tool descriptions pushes the system prompt past ~30k tokens, or when `buildTools` crosses ~20 tools. At that point migrate to gitclaw's `agents:` block with `delegation.mode: router` — same Lyzr endpoint, tool-scoped sub-agents per journey. Not needed now.

## Components

### 1. Close Readiness Score

A 0–100 number plus a tier (`Ready` ≥ 85, `Caution` 60–84, `Not Ready` < 60). Weighted average:

| Signal | Weight | Source |
|---|---|---|
| Reconciliation match rate | 40% | `getReconciliationStats(userId, period).matchRate` |
| Open break severity | 20% | Count + aging from existing `MatchRun` + open breaks; older/more severe = worse |
| Data-source freshness | 20% | Required source types uploaded for period: GL, SubLedger, Variance. Missing any → proportional penalty |
| Variance anomalies | 20% | Count of categories where `|actual − budget| / budget > 0.15` in `FinancialRecord` for period |

Rendered as a large circular score at page top with a two-sentence narrative ("72% — Caution. 3 open breaks aging past 10 days; COGS variance 22% above budget."). Narrative is template-generated server-side from the same numbers — not an LLM call.

### 2. Blocking Intelligence

List of concrete blockers queried for the active period:

- **Unresolved breaks** from existing reconciliation queries (high-severity first, aging-sorted). Each row has an `AskAiButton` pre-filled with `investigate break {id} for period {periodKey}` — reuses the pattern from [app/(shell)/financial-reconciliation/page.tsx:75](app/(shell)/financial-reconciliation/page.tsx#L75).
- **Missing data sources** — "No SubLedger uploaded for 2026-04" with a link to `/data-sources?tab=reconciliation`.
- **Variance anomalies** above threshold, each with an "Explain" button.

If no blockers: a green "No outstanding blockers for this period" card.

### 3. Derived task progress (5 cards)

Every card is `{completed} / {total}` from real rows, never hardcoded:

| Card | `completed` | `total` |
|---|---|---|
| Sub-ledger Close | `SubLedgerEntry.count({ dataSource.userId, periodKey, matchStatus != "unmatched" })` | `SubLedgerEntry.count({ dataSource.userId, periodKey })` |
| GL Entries | `GLEntry.count({ dataSource.userId, periodKey, matchStatus != "unmatched" })` | `GLEntry.count({ dataSource.userId, periodKey })` |
| Variance Review | `1` if `Document({ userId, type: "variance_report" })` exists since most recent variance upload for period, else `0` | `1` |
| Journal Adjustments | `JournalAdjustment.count({ userId, postedAt in period })` | Count of breaks older than aging threshold (expected adjustments) |
| Close Package | `1` if `Document({ userId, type: "close_package", period })` exists, else `0` | `1` |

When `total = 0` for a card (e.g., no SubLedger uploaded), the card renders an empty-state variant with a CTA instead of `0/0`.

### 4. Variance Engine (embedded)

Reuses the existing `/api/chart/budget-vs-actual` endpoint, extended with an optional `period` query param. Chart component embedded inline on the close page. Top-3 variance rows shown as a table with driver commentary — commentary pulled from the most recent `variance_report` `Document` if one exists; otherwise a "Generate variance report" CTA.

### 5. Close Package Generator

Extends the existing document-generation flow:

- `app/api/documents/generate/route.ts` line 15 — allowlist gains `"close_package"`.
- `lib/agent/index.ts` `generateReport()` — add a `close_package` branch with a prompt that pulls: match rate, blockers list, top-3 variances, posted journal adjustments, all scoped to the requested `periodKey`.
- `POST /api/documents/generate` accepts an optional `period` param (falls back to most recent).
- Add `period String?` column to `Document` model. This is the only schema change in this spec — trivial additive migration, nullable so existing rows are unaffected. Non-goals section updated to note this is a small additive migration, not a refactor.
- On the monthly-close page, a "Generate Close Package" button calls this endpoint with `{ type: "close_package", period: active }`. Resulting document title links to `/documents/[id]`.

### 6. "Explain This" drill-down

Every metric (score digits, each task card's numerator/denominator, each variance row) has a small `?` icon. On click it dispatches the existing `openAskAi` custom event with a pre-built prompt. Reuses [components/command-center/...](components/command-center) chat-panel wiring that reconciliation already uses. No new infrastructure.

Example prompts dispatched:
- Score: `"Explain why the close readiness score is {score}% for period {periodKey}"`
- Task card: `"Why is {taskName} at {completed}/{total} for period {periodKey}?"`
- Variance row: `"Why did {category} actual exceed budget by {pct}% in {periodKey}?"`

## Data Flow

```
URL ?period=2026-04
  ↓
page.tsx server component
  ├─ union(ReconPeriod, DISTINCT FinancialRecord.period) WHERE userId   → period list
  ├─ active = period in list ? period : mostRecent(list)
  ├─ Promise.all([
  │     getCloseReadiness(userId, active),
  │     getCloseBlockers(userId, active),
  │     deriveTaskCounts(userId, active),
  │     varianceTopN(userId, active, 3),
  │     documentExists(userId, "close_package", active),
  │   ])
  ↓
Render: score + narrative, blockers, 5 task cards, variance chart, generate-package button
  ↓
JourneyChatPanel receives periodKey → "Ask AI" / "Explain" work with period context
```

## Empty States

Following reconciliation's pattern:

- **No periods at all** (user has uploaded nothing): single card "Upload your first GL, sub-ledger, or budget CSV to see your close status" → `/data-sources`. No score, no cards.
- **Periods exist but active period has no data**: matches the per-card empty-state variant described in Component 3. Page still renders with score = `—` and a narrative explaining what's missing.
- **All green**: "Period ready to close" banner + highlighted "Generate Close Package" button.

## Error Handling

- Single `Promise.all` — avoids the pool-timeout issue observed earlier with parallel independent Prisma calls. Each function in the array handles its own errors and returns a fallback shape rather than throwing.
- Missing or invalid `period` query param → silently fall back to most-recent-with-data, same as recon ([app/(shell)/financial-reconciliation/page.tsx:67-68](app/(shell)/financial-reconciliation/page.tsx#L67-L68)).
- `generateReport` failures → return a 500 with the error message (existing pattern in `app/api/documents/generate/route.ts`). UI toasts the error, score/blockers still render.

## Testing

- **Unit — `lib/close/stats.ts`**: given a mock Prisma result set (one recon period with 80% match rate, 2 open breaks, 1 variance anomaly), `getCloseReadiness` returns a deterministic score. Weights covered. Vitest.
- **Unit — `lib/close/tasks.ts`**: given mock counts, `deriveTaskCounts` produces correct `{completed, total}` for each of the 5 cards, including the edge case where `total = 0`.
- **Integration**: extend `prisma/seed.ts` (or a new `scripts/seed-close-demo.ts`) to create a user with a close-ready period and a close-blocked period. Manual verification that `/monthly-close?period=...` renders different states for each.
- **Manual**: open `/monthly-close` against Neon prod data; verify every visible number traces to a concrete row.

## Rollout

Single PR. No feature flag — existing page is hardcoded so there's nothing to guard. One additive migration: `Document.period String?` (nullable, backward compatible). Vercel deploy reuses the existing build pipeline (fixed in commits `f595a31` and `77bf56f`).

## Open Questions

None blocking implementation. Weights in Component 1 are calibrated estimates; they can be tuned by looking at seeded data during implementation and are centralized in `lib/close/stats.ts` for easy adjustment.
