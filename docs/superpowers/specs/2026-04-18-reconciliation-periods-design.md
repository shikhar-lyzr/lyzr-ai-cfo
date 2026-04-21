# Reconciliation periods — design

Date: 2026-04-18
Author: brainstormed with Shikhar

## Problem

The current reconciliation pilot treats every upload as additive across all time. `loadLedgerEntries` pulls every GL and sub-ledger entry for the user across all data sources, so a second upload silently reconciles against the first. In the observed case: two GL+sub upload pairs produced a 400/400 "perfect match" run that masked 200 real open breaks from the prior run. The journey-aware chat, which is scoped to the latest run, correctly told the user "all breaks resolved" — but the UI rendered stale breaks from the earlier run, and the user saw a contradiction.

Root cause: no concept of a reconciliation period. Every upload contributes to one infinite pool; the "latest run" covers that pool; the page has no way to ask "what does April look like?" separately from "what does March look like?"

Three related UX issues also surfaced in the same session:

- FX data sources are absent from the Reconciliation tab of `/data-sources` (tab filter checks `metadata.shape === "reconciliation"`, which FX rows don't set).
- Google Sheet linking is not offered on the Reconciliation tab.
- The "Ask AI" link on each break row opens the separate `/agent-console` chat instead of scoping the question into the in-journey chat panel we just shipped.

## Goal

Ship a production-shape reconciliation model built around **calendar-month periods**, plus the three UX fixes above, so the product handles multi-period real-world usage cleanly.

## Non-goals

The following are real production-reconciliation concerns but are **deferred** to future specs:

- Period locking/closing workflow (the `ReconPeriod.status` column is reserved for it; MVP only writes `open`).
- Period reopening and associated audit trail.
- Multi-user actor tracking beyond `userId`.
- Soft-delete of archived data sources.

## Architecture

A `ReconPeriod` table becomes the anchor for all reconciliation state. Every GL entry, sub-ledger entry, and match run gets a `periodKey` (string, `YYYY-MM`) derived from the entry's `entryDate`. Matching runs only within a single period — no cross-period matching is possible. FX rates stay period-agnostic (they are date-keyed lookup data).

The UI gains a period picker in the `/financial-reconciliation` header. The selected period flows into the URL (`?period=2026-04`), the chat panel (via `periodKey` in the `/api/chat` body), and the journey-context builder (which scopes its stats + top-breaks to that period). Everything the user sees — page metrics, top breaks, agent answers — comes from the same period.

The clean cutover is destructive for reconciliation-only tables (GL/sub/MatchRun/Break/MatchLink/FXRate) and preserves `DataSource` rows. Users re-upload to repopulate.

## Data model

### New table: `ReconPeriod`

| Column      | Type     | Notes                                        |
|-------------|----------|----------------------------------------------|
| `id`        | cuid     | primary key                                  |
| `userId`    | string   | FK to `User.id`, indexed                     |
| `periodKey` | string   | `YYYY-MM` format (e.g. `"2026-04"`)          |
| `status`    | string   | `open` \| `closed`. MVP writes only `open`.  |
| `createdAt` | datetime | default now()                                |

Unique constraint: `(userId, periodKey)`.

### Column additions

- `GLEntry.periodKey` (string, indexed). Set at ingest from `entryDate` (`toYYYYMM(entryDate)`).
- `SubLedgerEntry.periodKey` (string, indexed). Same derivation.
- `MatchRun.periodKey` (string, indexed). Every run is scoped to one period.

### Unchanged

- `FXRate` — rates are period-agnostic; a USD→EUR rate on 2026-04-03 is the same whether you're reconciling April or May.
- `Break` — inherits period through its `MatchRun`; no direct column needed.
- `DataSource` — rows are not scoped to a period (one CSV can span months).

### Matching scope

`loadLedgerEntries(userId, periodKey)` filters by `periodKey` on both GL and sub-ledger queries. The match engine sees only that period's rows. Cross-period matching is not possible — which fixes the phantom-match bug at the root.

### Period creation

On GL or sub-ledger ingest, per row:

1. `periodKey = toYYYYMM(entryDate)`.
2. `upsert ReconPeriod(userId, periodKey, status: "open")`.
3. Stamp the row with `periodKey`.

An ingest can produce multiple periods if the file spans months. No period-inference fallback: rows without a valid `entryDate` are rejected by the existing parsers.

### Run trigger after ingest

After an ingest completes, for each distinct period the upload touched:

- If that period now has **both** at least one GL row and one sub-ledger row, enqueue a match run scoped to that period.
- Otherwise leave it; the UI shows "waiting for the other side."

An ingest spanning March + April can trigger 0, 1, or 2 runs depending on which periods are now complete.

### Clean cutover

One-time destructive migration on deploy:

- `DELETE` from `MatchRun`, `Break`, `MatchLink`, `GLEntry`, `SubLedgerEntry`, `FXRate`.
- Drop-and-recreate (or add columns + backfill with empty strings that the next ingest will overwrite) for the new `periodKey` columns.
- Create `ReconPeriod` table.
- `DataSource` rows are retained.

A one-time info banner on `/data-sources` explains the state: "Reconciliation data has been reset for the new period model — re-upload your GL and sub-ledger CSVs to repopulate."

## API surface

### Changed: `POST /api/upload`

- On `gl` or `sub_ledger` ingest, compute `periodKey` per row, upsert `ReconPeriod`, stamp rows, return `{ kind, dataSource, periodsTouched: string[] }`.
- After ingest, trigger one match run per period in `periodsTouched` that now has both sides.
- `fx` ingest is unchanged (period-agnostic).

### Changed: `POST /api/data-sources/link-sheet`

- Body `shape` widens to `"variance" | "ar" | "gl" | "sub_ledger" | "fx"`.
- After fetching the Sheet's CSV export, branch on `effectiveShape`: gl/sub_ledger/fx call the same `ingestGl` / `ingestSubLedger` / `ingestFxRates` functions used by `/api/upload`, inheriting the period logic automatically.
- `detectCsvShape` already handles all five shapes; no change there.

### New: `GET /api/reconciliation/periods`

Returns the user's reconciliation periods with summary aggregates, newest first:

```json
[
  {
    "periodKey": "2026-04",
    "status": "open",
    "lastRunAt": "2026-04-18T10:15:00Z",
    "matchRate": 0.93,
    "openBreakCount": 12,
    "openBreakValue": 48000,
    "hasGl": true,
    "hasSub": true
  }
]
```

Drives the period-picker dropdown.

### Changed: `POST /api/chat`

- Body gains optional `periodKey: string`.
- Forwarded to `chatWithAgent` as `opts.periodKey`.
- Journey-context builder reads it; reconciliation builder scopes stats + top breaks to that period.
- Unknown or missing `periodKey` on the reconciliation journey → default to the newest period with data (same default as the UI).
- Invalid `periodKey` (e.g. `"2025-13"`) → same fallback; never 500.

### Changed: reconciliation agent tools (`lib/agent/tools/reconciliation.ts`)

Tools currently find "the latest match run" globally. They change to find the latest run within a period that is threaded through tool context (from the same `periodKey` the chat call carries). The agent sees the same period the user is viewing.

## UI surface

### `/financial-reconciliation`

- Header gains a period picker (right-aligned dropdown, next to the title). Populated from `GET /api/reconciliation/periods`. Default selection: newest period with data.
- Selection stored in URL: `?period=2026-04`.
- Page reads `period` from the search param (via Suspense-wrapped client component, following the pattern established by `/data-sources`).
- Switching the picker re-renders the metrics card row, donut, and Top Exceptions table scoped to the selected period.
- Empty states:
  - No periods at all → existing "Upload GL + sub-ledger CSVs" prompt.
  - Selected period has GL but no sub-ledger → "This period has GL but no sub-ledger yet."
  - Selected period has sub-ledger but no GL → "This period has sub-ledger but no GL yet."
  - Selected period has both, match rate 100%, zero breaks → "All breaks resolved for this period."

### Journey chat panel

- Reads `period` from the URL; adds `periodKey` to every `/api/chat` POST body.
- No visible UI change — wiring only, in the `useChatStream` hook call from `JourneyChatPanel`.

### "Ask AI" link on break rows

- Changes from `<Link href="/agent-console?q=...">` to an in-page handler that:
  1. Opens the journey chat panel if collapsed.
  2. Prefills the input with `investigate break <id>`.
  3. Auto-sends.
- The chat already has `journeyId` + `periodKey` in scope, so the agent gets full context without redirecting the user.
- Implementation: the journey page shell exposes `openChat(prefill: string)`; the break-row component calls it.

### `/data-sources` page, Reconciliation tab

- Filter fix: include any source whose `type` is `gl`, `sub_ledger`, or `fx`. (Today's filter checks `metadata.shape === "reconciliation"`, which FX rows don't set — which is why FX appears to "disappear" after GL/sub uploads.)
- Show the `LinkSheetArea` on the Reconciliation tab (currently hidden). Pass a nominal `shape="gl"`; `detectCsvShape` overrides as needed, matching the CSV upload flow.
- After a successful recon upload or link, the success toast names the period(s) touched: `"GL uploaded — 180 rows ingested into 2026-03, 20 rows into 2026-04. Running match for 2026-04…"`.

## Error handling and edge cases

1. **Entries with no `entryDate`** — rejected by existing parsers; no period-inference fallback.
2. **Mixed-period upload** — rows split naturally by `periodKey`; multiple `ReconPeriod` rows created; match runs trigger only for periods that now have both sides.
3. **Re-upload into an existing period** — new rows added; existing `@@unique` constraints on GL/sub prevent exact duplicates; a new match run for that period becomes the "latest" for display. Prior runs stay in history.
4. **Period with only one side** — no match run triggers; UI shows "Waiting for the other side," distinguishable from "run completed with 100% match."
5. **Missing FX rate for a date** — existing lookup logic handles this; no change.
6. **Chat with `periodKey` that has no run yet** — builder returns the same empty-state string as the UI ("This period has GL but no sub-ledger yet" etc.).
7. **Chat with invalid `periodKey`** — falls through to the newest-period-with-data default; never 500.
8. **Legacy data after cutover** — destructive migration on recon tables only; `DataSource` rows preserved; one-time info banner on `/data-sources` explains the reset.

## Testing

### Unit

- `periodKeyFromDate(date: Date): string` helper — month boundaries (Jan 1, Dec 31), year rollover, leap day, UTC vs local (canonical: UTC).
- `getReconciliationStats(userId, periodKey)` — period-scoped numbers; `{ hasData: false }` for unknown period.
- `getTopBreaks(userId, periodKey)` — only returns breaks whose run belongs to the period.
- `buildReconciliationContext(userId, periodKey)` — header format, all empty states, 100%-resolved state, top-5 list.
- Journey-context registry — passes `periodKey` through to the builder.

### Integration (DB-backed, Vitest, 30s timeouts per test)

- Ingest a mixed-period GL → rows stamped with correct `periodKey`, `ReconPeriod` rows upserted.
- Upload GL only → no run triggered. Upload sub-ledger for same period → run triggers; stats reflect the new state.
- Upload second GL into same period → second match run exists; `getReconciliationStats` picks the newer one.
- Cross-period isolation: period A data invisible in period B stats even when references overlap across months.

### Route

- `GET /api/reconciliation/periods` returns ordered list with correct aggregates.
- `POST /api/chat` with `periodKey` threads through; a mocked `chatWithAgent` sees the period in its context argument.
- `POST /api/data-sources/link-sheet` accepts recon shapes and delegates to the correct ingest function.

### End-to-end (manual, via curl + browser)

- Upload a two-period GL + matching sub-ledger → two periods appear in the picker; switching rescopes page + chat.
- "Ask AI" on a break row opens the journey chat panel with prefill; agent answers using the selected period's context.
- Link a Google Sheet for each recon shape (GL, sub_ledger, FX) → ingests and creates periods correctly.

## Files changed

**New:**
- `prisma/migrations/<timestamp>_recon_periods/migration.sql` — destructive migration + new table/columns.
- `lib/reconciliation/period.ts` — `periodKeyFromDate`, period upsert helper.
- `app/api/reconciliation/periods/route.ts` — list endpoint.
- Test files for all new modules.

**Modified:**
- `prisma/schema.prisma` — `ReconPeriod` table, `periodKey` columns on GL/Sub/MatchRun.
- `lib/reconciliation/persist.ts` — period-aware `loadLedgerEntries`, period-aware ingest for GL/sub, multi-period run dispatch.
- `lib/reconciliation/stats.ts` — `getReconciliationStats(userId, periodKey)`, `getTopBreaks(userId, periodKey, limit)`.
- `lib/agent/journey-context/financial-reconciliation.ts` — takes `periodKey`, passes through to stats helpers.
- `lib/agent/journey-context/index.ts` — registry signature gains `periodKey`.
- `lib/agent/index.ts` — `chatWithAgent` opts gains `periodKey`; `buildContext` passes it through.
- `lib/agent/tools/reconciliation.ts` — tools scope to period from tool context.
- `app/api/chat/route.ts` — read `periodKey` from body, thread to agent.
- `app/api/upload/route.ts` — return `periodsTouched`; trigger multi-period runs.
- `app/api/data-sources/link-sheet/route.ts` — accept recon shapes; delegate to ingest functions.
- `app/(shell)/financial-reconciliation/page.tsx` — period picker, URL state, empty-state branches.
- `app/(shell)/data-sources/page.tsx` — reconciliation tab filter; show `LinkSheetArea`; period-aware success copy.
- `components/reconciliation/break-row.tsx` (or wherever "Ask AI" currently lives) — in-page handler.
- `components/journey/journey-chat-panel.tsx` (or equivalent) — expose `openChat(prefill)`, accept `periodKey`.
- `hooks/use-chat-stream.ts` — include `periodKey` in the request body.

## Risks

- **Migration destroys data.** Acceptable because all current data is pre-production demo data. Guard: the migration file is named explicitly and documented in this spec.
- **`periodKey` derivation assumes UTC.** A Dec 31 23:30 UTC-5 entry is "January" locally but "December" in UTC. Canonical choice: UTC, consistent with how the rest of the app stores dates. Documented in `periodKeyFromDate`.
- **Large multi-period uploads.** A 12-month GL file triggers 12 upserts and potentially up to 12 match runs. Acceptable; runs are idempotent and sequential in the current persist layer. Flag for future optimization, not a blocker.
- **Tool context plumbing.** `lib/agent/tools/reconciliation.ts` needs a way to receive the current `periodKey`. If the agent SDK's tool-context API doesn't support passing custom values, we fall back to threading `userId` + `periodKey` through a module-level `AsyncLocalStorage` scoped to each `chatWithAgent` call. Decide at implementation time.
