# Agentic Journeys — Umbrella Pattern + Financial Reconciliation Pilot

**Status:** Approved via brainstorming, 2026-04-16.
**Scope:** (1) Define the shared contract every journey must satisfy to become agentic; (2) implement Financial Reconciliation end-to-end as the reference pilot. The other four shell journeys (Regulatory Capital, IFRS 9 ECL, Daily Liquidity, Regulatory Returns) are deliberately out of scope for this spec — each gets its own spec after the pattern is validated by the pilot.

## 1. Background

Today the app ships six journey pages (`app/(shell)/<journey>/page.tsx`). Only **Monthly Close** is actually agentic — it has a skill, tools, a data model (`FinancialRecord`), and is fed by `sample-budget-vs-actual.csv`. The other five render the same shell (`JourneyPage` + `JourneyChatPanel`) but their top widgets come from hardcoded arrays in `lib/config/journey-sample-data.ts` and the chat has no domain skill to drive.

This spec closes the gap for Financial Reconciliation and establishes a reusable contract for the remaining four.

## 2. Umbrella pattern — the six-piece contract

Every journey that becomes agentic MUST provide all six pieces at the prescribed paths:

| # | Piece | Path | Notes |
|---|---|---|---|
| 1 | Data models | `prisma/schema.prisma` | User-scoped via `DataSource` where applicable, same convention as `FinancialRecord`. |
| 2 | Seeder + sample CSV(s) | `public/samples/` + `lib/seed/<journey>.ts` | Wired into `/api/seed-demo` via a new option. |
| 3 | Pure domain library | `lib/<journey>/` | Stateless functions. No Prisma in the library. Consumes plain objects; returns plain objects. Prisma adapter lives alongside in the same folder. |
| 4 | Agent tools | `lib/agent/tools/<journey>.ts` | `createXTools(userId)` factory parallel to `createFinancialTools`. Registered in `lib/agent/index.ts`. |
| 5 | Skill + workflow | `agent/skills/<journey>/SKILL.md` + `agent/workflows/<journey>.yaml` | Same frontmatter shape as existing `monthly-close`. |
| 6 | Live widgets | Server-side helper `lib/<journey>/stats.ts`; page becomes `async` server component | No more `journey-sample-data.ts` imports for that journey. |

The same pattern lets us retire `lib/config/journey-sample-data.ts` one journey at a time.

## 3. Financial Reconciliation — pilot scope

### 3.1 Feature scope (confirmed with user)

Everything included. No trimming.

- Core Prisma models, sample CSVs, tools, skill, workflow, live widgets.
- **FX re-measurement engine** — `FXRate` table + `convert()` at ingest; `baseAmount` persisted on every entry.
- **Adjustment writeback** — `AdjustmentProposal` → user approval → `JournalAdjustment` posted → break status flips to `adjusted`.
- **Multi-strategy matcher** — exact + amount/date tolerance + fuzzy (Jaro-Winkler on memo).
- **Ageing auto-escalation** — breaks >60 days AND high severity auto-create `Action` rows that appear in the existing actions feed.

### 3.2 Matching trigger model

**Both auto-on-upload and agent-initiated, every run preserved as history.**

- When the user has at least one `ready` GL `DataSource` AND one `ready` sub-ledger `DataSource`, the upload handler fires `runMatchRun` synchronously in-request (fine at demo scale, <5s for 200×200) with `triggeredBy: "upload"` and default strategy config.
- The agent can call `run_matching` at any point with overridden `strategyConfig` (e.g. tighter tolerance, fuzzy off). Each run is a new `MatchRun` row.
- Every `MatchRun` is the audit trail: user can see "last run matched 87%, this tighter run matches 91%".

### 3.3 Match engine architecture — pure library

Chosen over tool-composed and SQL approaches. Single source of truth, fully testable, same engine serves the upload hook, the agent tool, and any future "Recompute" button.

## 4. Prisma data model

```prisma
model GLEntry {
  id           String   @id @default(cuid())
  dataSourceId String
  entryDate    DateTime
  postingDate  DateTime
  account      String              // GL account code, e.g. "2100-AP"
  reference    String              // invoice/txn ID — primary match key
  memo         String?
  amount       Float                // in txnCurrency
  txnCurrency  String               // "USD" | "EUR" | "GBP"
  baseAmount   Float                // FX-converted at postingDate, stored
  debitCredit  String               // "DR" | "CR"
  counterparty String?
  matchStatus  String   @default("unmatched") // unmatched | matched | partial | disputed
  createdAt    DateTime @default(now())
  dataSource   DataSource @relation(fields: [dataSourceId], references: [id])
  matches      MatchLink[]
  @@index([dataSourceId, matchStatus])
  @@index([reference])
}

model SubLedgerEntry {
  id             String   @id @default(cuid())
  dataSourceId   String
  sourceModule   String              // "AP" | "AR" | "FA"
  entryDate      DateTime
  account        String
  reference      String
  memo           String?
  amount         Float
  txnCurrency    String
  baseAmount     Float
  counterparty   String?
  matchStatus    String   @default("unmatched")
  createdAt      DateTime @default(now())
  dataSource     DataSource @relation(fields: [dataSourceId], references: [id])
  matches        MatchLink[]
  @@index([dataSourceId, matchStatus])
  @@index([reference])
}

model MatchRun {
  id              String   @id @default(cuid())
  userId          String
  triggeredBy     String              // "upload" | "agent" | "manual"
  strategyConfig  String              // JSON string of { exact, tolerance, fuzzy }
  totalGL         Int
  totalSub        Int
  matched         Int
  partial         Int
  unmatched       Int
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  user            User     @relation(fields: [userId], references: [id])
  links           MatchLink[]
  breaks          Break[]
}

model MatchLink {
  id           String   @id @default(cuid())
  matchRunId   String
  glEntryId    String
  subEntryId   String
  strategy     String              // "exact" | "tolerance" | "fuzzy"
  confidence   Float                // 0..1
  amountDelta  Float                // baseAmount diff (sub - gl)
  dateDelta    Int                  // days diff (sub - gl)
  matchRun     MatchRun @relation(fields: [matchRunId], references: [id])
  glEntry      GLEntry  @relation(fields: [glEntryId], references: [id])
  subEntry     SubLedgerEntry @relation(fields: [subEntryId], references: [id])
  @@index([matchRunId])
}

model Break {
  id            String   @id @default(cuid())
  matchRunId    String
  side          String              // "gl_only" | "sub_only"
  entryId       String              // polymorphic: points to GLEntry.id OR SubLedgerEntry.id based on side
  amount        Float
  baseAmount    Float
  txnCurrency   String
  ageDays       Int                  // computed at run-time: today - entryDate
  ageBucket     String              // "0-30" | "31-60" | "60+"
  severity      String              // "low" | "medium" | "high"
  status        String   @default("open") // open | investigating | adjusted | written_off
  actionId      String?             // set when auto-escalated to Actions feed
  matchRun      MatchRun @relation(fields: [matchRunId], references: [id])
  proposals     AdjustmentProposal[]
  @@index([matchRunId, status])
  @@index([ageBucket, severity])
}

model AdjustmentProposal {
  id              String   @id @default(cuid())
  breakId         String
  proposedBy      String              // "agent" | "user"
  description     String
  debitAccount    String
  creditAccount   String
  amount          Float
  baseAmount      Float
  currency        String
  journalDate     DateTime
  status          String   @default("pending") // pending | approved | rejected | posted
  approvedBy      String?
  approvedAt      DateTime?
  postedJournalId String?
  createdAt       DateTime @default(now())
  break           Break    @relation(fields: [breakId], references: [id])
}

model JournalAdjustment {
  id         String   @id @default(cuid())
  userId     String
  proposalId String   @unique
  entryDate  DateTime
  lines      String              // JSON: [{account, dr, cr, amount, baseAmount}]
  postedAt   DateTime @default(now())
}

model FXRate {
  id           String   @id @default(cuid())
  fromCurrency String
  toCurrency   String               // always "USD" for now (base)
  rate         Float
  asOf         DateTime
  @@unique([fromCurrency, toCurrency, asOf])
  @@index([asOf])
}
```

**Design decisions embedded:**

- **`baseAmount` precomputed at ingest, not at match time.** Keeps matching arithmetic fast and deterministic and preserves historical rates even if `FXRate` is later updated.
- **`Break.entryId` is polymorphic** rather than two nullable FK columns. Simpler filtering, matches ledger domain convention. The adapter layer guards against missing entries because no DB-level FK enforces it.
- **`MatchRun` is the audit trail.** Every run — upload-triggered or agent-triggered — becomes a row, letting the agent reason about history ("last run matched 87%, this one 91%").
- **`User` must gain a relation field** `matchRuns MatchRun[]` + `journalAdjustments JournalAdjustment[]`. (Prisma relation requirement.)
- **`AdjustmentProposal.status = "posted"`** is terminal only after `JournalAdjustment` is successfully inserted in the same transaction.

## 5. Pure match engine — `lib/reconciliation/`

```
lib/reconciliation/
  types.ts              // shared types (GLEntryInput, SubLedgerEntryInput, StrategyConfig, MatchResult)
  fx.ts                 // convert(amount, from, to, asOf, rates): baseAmount
  strategies/
    exact.ts            // reference equality
    tolerance.ts        // amount±δ, date±d, same counterparty
    fuzzy.ts            // Jaro-Winkler on memo + amount proximity
  match-engine.ts       // orchestrator — runs strategies in order, dedupes
  ageing.ts             // ageBucket(), severity()
  persist.ts            // Prisma adapter: runMatchRun() + saveMatchRun()
  stats.ts              // server-side page helpers (getReconciliationStats, getTopBreaks)
  index.ts              // barrel export
```

### 5.1 Core contract

```ts
export type Strategy = "exact" | "tolerance" | "fuzzy";

export type StrategyConfig = {
  exact: boolean;
  tolerance: { enabled: boolean; amount: number; daysPlus: number; daysMinus: number };
  fuzzy:     { enabled: boolean; threshold: number };
};

export type MatchResult = {
  links: Array<{ glId: string; subId: string; strategy: Strategy; confidence: number; amountDelta: number; dateDelta: number; partial: boolean }>;
  breaks: Array<{ side: "gl_only" | "sub_only"; entryId: string }>;
  stats: { totalGL: number; totalSub: number; matched: number; partial: number; unmatched: number };
};

export function runMatchRun(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  config: StrategyConfig
): MatchResult;
```

### 5.2 Matching invariants

1. **Strategy ordering — exact → tolerance → fuzzy.** Each strategy operates only on residuals from the previous one.
2. **One-to-one.** Once a GL entry is linked, it's removed from the pool before the next strategy runs. A sub-ledger entry can link to only one GL entry per run.
3. **Tolerance match criteria.** `|amountDelta| ≤ config.tolerance.amount` AND `dateDelta ∈ [-daysMinus, +daysPlus]` AND counterparty string match. `amountDelta` and `dateDelta` are computed on base currency / entry date.
4. **Partial flag.** A tolerance match with `amountDelta != 0` (but within tolerance) is marked `partial: true`. Partials count as matched for stats but surface in UI as "needs review".
5. **Confidence scoring.**
   - Exact: `1.0`.
   - Tolerance: `1 - (|amountDelta|/tolerance.amount + |dateDelta|/max(daysPlus,daysMinus))/2`.
   - Fuzzy: `memoSimilarity * 0.7 + amountProximity * 0.3`, where `amountProximity = 1 - |amountDelta|/max(|glAmount|, |subAmount|)`.

### 5.3 FX handling

- All FX lookups happen at ingest (`parsers/gl-parser.ts` and `parsers/sub-ledger-parser.ts`), not at match time.
- `fx.convert(amount, from, to, asOf, rates)` picks the nearest earlier `FXRate.asOf` for the `(from, to)` pair. If none exists, throws — the parser falls back to inserting a default rate of 1.0 with a warning in the upload response.
- Strategies operate exclusively on `baseAmount`. No FX logic inside strategies — keeps them pure arithmetic.

### 5.4 Ageing

- `ageBucket(entryDate, today): "0-30" | "31-60" | "60+"`
- `severity(ageDays, baseAmount): "low" | "medium" | "high"`
  - high: `ageDays > 60` OR `|baseAmount| > 10_000`
  - medium: `ageDays > 30` OR `|baseAmount| > 1_000`
  - low: otherwise
- Thresholds live in `agent/knowledge/reconciliation-thresholds.md` and are loaded by the library at boot (pattern mirrors existing `variance-thresholds.md`).

## 6. Agent integration

### 6.1 Tools — `lib/agent/tools/reconciliation.ts`

Factory `createReconciliationTools(userId)` exporting:

| Tool | Args | Purpose |
|---|---|---|
| `search_ledger_entries` | `{ side, reference?, account?, counterparty?, status?, limit? }` | Query GL or sub-ledger. Pagination capped at 50. |
| `list_match_runs` | `{ limit? }` | Recent runs with stats. Most recent first. |
| `run_matching` | `{ strategyConfig?, glDataSourceId?, subDataSourceId? }` | Create a new `MatchRun`. Persists links + breaks, flips entry `matchStatus`, runs ageing + severity pass, auto-escalates. |
| `list_breaks` | `{ side?, ageBucket?, severity?, status?, limit? }` | Default: open breaks, sorted severity desc + age desc + baseAmount desc. |
| `age_breaks` | `{}` | Recompute `ageDays`/`ageBucket`/`severity` on all open breaks as of today. |
| `escalate_break` | `{ breakId }` | Force-create an `Action` row for a break. Auto-escalation handles >60d+high; this covers user-directed escalation. |
| `propose_adjustment` | `{ breakId, debitAccount, creditAccount, amount, description }` | Create `AdjustmentProposal`. `status = pending`. Derives `baseAmount` via FX. |
| `approve_adjustment` | `{ proposalId, confirm? }` | Without `confirm: true`: returns preview. With `confirm: true`: flips to `approved`, posts `JournalAdjustment`, flips break to `adjusted`. |
| `reconciliation_summary` | `{}` | Match rate, break counts by bucket/severity, top 5 breaks by $, unresolved count, oldest open break age. |

All tools return `{ text, details }` — same shape as existing `createFinancialTools`. Registered in `lib/agent/index.ts` so the agent can call them from any session.

### 6.2 Skill — `agent/skills/financial-reconciliation/SKILL.md`

```markdown
---
name: financial-reconciliation
description: Match GL vs sub-ledger, investigate breaks, propose adjustments
confidence: 1
usage_count: 0
success_count: 0
failure_count: 0
negative_examples: []
---

# Financial Reconciliation

## When to Use
- User says "reconcile", "reconciliation", "break", "unmatched", "match rate", "GL vs sub-ledger"
- User asks why reconciliation numbers look off
- User has just uploaded GL + sub-ledger data sources

## Process

1. **Orient** — Call `reconciliation_summary`. Know match rate, break count, oldest unmatched, top breaks by $.
2. **Investigate drivers** — Call `list_breaks` filtered to `severity: high`. For the top 3–5 by `baseAmount`, call `search_ledger_entries` on the `reference` to understand context from the other side.
3. **Classify** — Group breaks by probable cause:
   - **Timing** (appears on one side only, recent date) → suggest `age_breaks` and revisit.
   - **Amount mismatch** (partial match outside tolerance) → `propose_adjustment` with the delta.
   - **FX variance** (same reference, different baseAmount) → note rate used at posting.
   - **Old unresolved** (>60d) → `escalate_break`.
4. **Act** — Execute the proposals the user approves. Never call `approve_adjustment` with `confirm: true` without explicit user approval in the current turn.
5. **Offer re-match** — If match rate <85%, offer `run_matching` with a different `strategyConfig`.
6. **Close the loop** — Summarise: adjusted, escalated, remaining.

## Posting Safety
NEVER call `approve_adjustment` with `confirm: true` unless the user explicitly approved that specific proposal in the current turn. Always show a preview first.
```

### 6.3 Workflow — `agent/workflows/financial-reconciliation.yaml`

Stages: `orient → investigate → classify → act → report`. Mirrors the shape of the existing `monthly-close.yaml`. Used when the user asks "walk me through reconciliation".

### 6.4 Knowledge — `agent/knowledge/reconciliation-thresholds.md`

Default ageing buckets, severity rules, default match tolerances (`amount: 1.00`, `daysPlus: 2`, `daysMinus: 2`, `fuzzy.threshold: 0.85`). Referenced by both skill and library.

## 7. Upload flow + live widgets

### 7.1 Upload flow

- Two new `DataSource.type` values: `"gl"` and `"sub_ledger"`.
- New parsers: `lib/upload/parsers/gl-parser.ts`, `lib/upload/parsers/sub-ledger-parser.ts`. Both call `fx.convert()` per row to populate `baseAmount`.
- `/api/upload` on successful parse: insert rows, flip `DataSource.status = "ready"`, then check whether the user has at least one ready GL source AND one ready sub-ledger source. If yes, synchronously run `runMatchRun` with `triggeredBy: "upload"` and default strategy config. On completion, run ageing + severity and auto-escalate qualifying breaks.

### 7.2 Sample CSVs — `public/samples/`

- **`sample-gl.csv`** — 200 rows: 160 clean matches + 5 amount-mismatch (tolerance) + 5 date-shift (tolerance) + 5 memo-mismatch (fuzzy) + 10 GL-only + 10 where sub side has a match that won't appear + 5 FX-denominated (EUR/GBP).
- **`sample-sub-ledger.csv`** — 200 rows mirroring the above.
- **`sample-fx-rates.csv`** — USD/EUR/GBP spot rates for the last 90 days. Seeded into `FXRate` at demo load.

### 7.3 Seed helper + demo route

- `lib/seed/reconciliation.ts` loads the three CSVs into a user's account.
- `/api/seed-demo` accepts a new `reconciliation` option that invokes this seeder.

### 7.4 Live widget wiring

- Convert `app/(shell)/financial-reconciliation/page.tsx` to an `async` server component.
- Remove `RECON_METRICS`/`RECON_EXCEPTIONS` imports from `lib/config/journey-sample-data.ts`.
- Server helper `lib/reconciliation/stats.ts` exports `getReconciliationStats(userId)` and `getTopBreaks(userId, limit)`.
- Page renders:
  - **4 metric cards** via `MetricCard`: match rate %, open breaks (count + $), oldest break (days), GL-only vs sub-only donut (reuses `DonutChart` from `components/shared/`).
  - **Top Exceptions table** populated from `getTopBreaks`. Columns: Ref, Amount, Type, Age, Counterparty, Severity badge, "Ask AI" button that deep-links to `/agent-console?q=investigate%20break%20<id>` (pattern established by the actions feed).
  - **Empty state** if no match runs: "Upload GL + sub-ledger CSVs to start reconciling" + "Load sample data" button calling `/api/seed-demo` with `reconciliation`.
- Chat nudges updated to: `["Why is match rate below 90%?", "Show me breaks over $10K", "Propose adjustments for timing differences"]`.

The `getReconciliationStats` server helper is the template every future journey will use to replace its `journey-sample-data.ts` import. Same shape, same call site.

### 7.5 Auto-escalation → Actions feed

- In `runMatchRun` persistence, after breaks are inserted, any break with `severity = "high"` AND `ageDays > 60` gets an `Action` row created (`type = "reconciliation_break"`, `severity = "high"`, `headline = "Unresolved break: <ref>"`, `detail` includes amount + counterparty + age).
- The existing `ActionsRequired` + `action-modal` UI already renders these — no new UI work for the actions side.
- `Break.actionId` is set so we don't double-escalate on subsequent runs.

## 8. Testing strategy — TDD throughout

Three test rings, written in this order.

### 8.1 Engine unit tests — `lib/reconciliation/__tests__/`

- `fx.test.ts` — identity (USD→USD), EUR→USD, asOf lookup picks nearest earlier rate, throws when no rate found.
- `exact.test.ts` — 10×10 fixture, 8 matching refs: 8 links + 2 GL-only + 2 sub-only.
- `tolerance.test.ts` — amount-only, date-only, both; `partial: true` flag on non-zero delta.
- `fuzzy.test.ts` — memo variants ("Acme Corp payment 123" vs "ACME PMT #123"); threshold boundary.
- `match-engine.test.ts` — strategy ordering, one-to-one invariant, stats correctness.
- `ageing.test.ts` — bucket boundaries (day 30, 31, 60, 61), severity cross-product.

### 8.2 Prisma adapter — `lib/reconciliation/__tests__/persist.test.ts`

Round-trip a `MatchRun` through Prisma against the test DB. Confirm `Break.entryId` polymorphism honoured by the adapter. Verify indexes via query plan spot-check.

### 8.3 Tool + API integration

- `run_matching` on empty DB returns friendly message, not error.
- `propose_adjustment` → `approve_adjustment` posts `JournalAdjustment` and flips break to `adjusted` in one transaction.
- `approve_adjustment` without `confirm: true` returns preview only, no DB write.
- POST CSV pair to `/api/upload`, verify `MatchRun` + `Break` rows exist and qualifying breaks have `actionId` set.

## 9. Verification before completion

Before claiming done:

- `npx prisma validate && npx prisma migrate status`
- Test runner (`pnpm vitest run lib/reconciliation` or `npm run test` — pick based on `package.json`)
- Manual browser walkthrough:
  1. Load sample data via seed button.
  2. Page lights up: metric cards + top breaks table populated.
  3. Ask each of the three nudges in chat; verify real tool calls in the response.
  4. Approve one adjustment; confirm break flips to `adjusted` and disappears from open list.
  5. Confirm at least one break auto-escalated to the Actions feed.

## 10. Implementation phases

| Phase | Deliverable |
|---|---|
| 1 | Prisma schema + migration; `FXRate` seed data |
| 2 | Pure match engine library (TDD, no Prisma) |
| 3 | Prisma adapter + `saveMatchRun` persistence |
| 4 | Sample CSVs + `/api/seed-demo` reconciliation option |
| 5 | CSV parsers + `/api/upload` integration + auto-match hook |
| 6 | Agent tools + registration + skill file + workflow YAML + knowledge file |
| 7 | Live widget wiring: server helper + page conversion + donut + top breaks table |
| 8 | Auto-escalation → Actions feed integration |
| 9 | Adjustment writeback flow + approval safety rails |
| 10 | Verification pass, manual QA, commit |

Ballpark 10–15 focused sessions. The plan produced by `writing-plans` will decompose each phase into atomic steps.

## 11. Out of scope

Flagged explicitly to prevent scope creep:

- Applying the umbrella pattern to **Regulatory Capital, IFRS 9 ECL, Daily Liquidity, Regulatory Returns** — each gets its own spec after the pilot.
- Rewiring **Monthly Close's** top widgets to live state — noted as follow-up, not in this spec.
- Multi-user collaboration on a single break.
- Export of reconciliation package to PDF.
- Streaming match progress via SSE (synchronous in-request is adequate at demo scale).

## 12. Open questions

None at spec sign-off. All major architectural decisions (fidelity, matching trigger, engine shape, FX strategy, writeback approach, escalation) resolved during brainstorming.
