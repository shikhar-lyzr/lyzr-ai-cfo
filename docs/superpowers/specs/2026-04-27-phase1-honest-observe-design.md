# Phase 1 — Make Observe Honest

**Date:** 2026-04-27
**Author:** Shikhar Agrawal (with Claude)
**Status:** Spec — pending review

## Context

The audit at the start of this cycle found that three of the five Observe-surface pages (Decision Inbox, Audit Trail, Agent Runs) are driven entirely by `lib/config/sample-observe-data.ts`. A fourth (Compliance) is hybrid — it tries `/api/agent/context` and falls back to hardcoded sample rules. Only Documents is wired to real data.

Reconciliation has a related gap: `JournalAdjustment` is posted with no record of *who* approved or *why*. That's not a demo issue — it's an actual SOX-style audit failure once the tool is dogfooded inside Lyzr.

This spec covers Phase 1 of a three-phase plan to close those gaps. Phase 2 (reconciliation break-detail UI + REST endpoints) and Phase 3 (AR / Collections workspace + Customer model) are out of scope here and will be brainstormed separately after Phase 1 merges.

## Goals

1. Decision Inbox shows real items the user can act on, persistently.
2. Audit Trail reflects what actually happened in the database.
3. `JournalAdjustment` records who approved each posting and why.
4. The pages we're not wiring up in Phase 1 are unambiguously labeled as samples.

## Non-Goals

- Wiring Agent Runs to real gitclaw telemetry (badge only; later phase).
- Real regulatory frameworks / validation schedule on the Compliance page (cosmetic; later).
- PDF export, email distribution, or scheduled reports.
- Backfilling historical actions into the Decision Inbox — Phase 1 starts the inbox empty until the agent files something.
- A `SystemEvent` table or any new audit-instrumentation in upload / chat / document paths.

## Architecture overview

Phase 1 introduces one new concept (`Decision`) and reuses existing rows everywhere else.

```
┌── Browser ────────────────────────────────────────────────────────┐
│ Decision Inbox            Audit Trail            Agent Runs       │
│ /decision-inbox           /audit-trail           /agent-runs      │
│   GET /api/decisions        GET /api/audit-trail   (sample badge) │
│   POST /api/decisions/[id]/decide                                 │
│   GET  /api/audit-trail/export.csv                                │
└──────────────┬────────────────────┬────────────────┬──────────────┘
               │                    │                │
               ▼                    ▼                ▼
┌── Prisma (Postgres / Neon) ───────────────────────────────────────┐
│ Decision  (NEW)    │  AdjustmentProposal (existing)               │
│ DecisionEvent (NEW)│  JournalAdjustment (+approvedBy/At/reason)   │
│ ActionEvent (existing — read-only here)                           │
│ DataSource / Document / MatchRun (read-only — derived timeline)   │
└───────────────────────────────────────────────────────────────────┘
```

The Audit Trail does **not** introduce a new event source. It joins two typed-event tables (`ActionEvent`, `DecisionEvent`) with derived rows from `DataSource.createdAt`, `Document.createdAt`, and `MatchRun.completedAt` (nullable — only completed runs appear). Five sources total in the timeline.

## Data model

### New: `Decision`

A user-facing envelope around an irreversible operation that the agent has proposed. In Phase 1, only `type = "post_journal"` is used, sourced from reconciliation adjustments. The model is generic so AR / draft-email decisions in later phases reuse the same shape.

```prisma
model Decision {
  id            String    @id @default(cuid())
  userId        String
  type          String    // "post_journal" (Phase 1); future: "send_email", "accept_match", …
  proposalRef   String?   // FK target depends on type — for "post_journal", references AdjustmentProposal.id
  refModel      String?   // "AdjustmentProposal" (Phase 1); future: "Invoice", "Action", …
  headline      String
  detail        String?
  status        String    @default("pending") // pending | approved | rejected | needs_info
  decidedBy     String?   // userId of the human who decided
  decidedAt     DateTime?
  reason        String?   // free-text rationale captured at decision time
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  events        DecisionEvent[]

  @@index([userId, status])
  @@index([userId, createdAt])
}
```

`proposalRef` + `refModel` is a deliberate weak-FK polymorphic pointer — Prisma can't enforce it at the DB level, but the API layer always sets both and never queries one without the other. That's the same shape `Action.invoiceId?` uses today (a typed nullable FK to a single model). When AR decisions land in Phase 3, we'll add a second nullable FK column rather than overloading `proposalRef`.

### New: `DecisionEvent`

One row per state transition on a `Decision`. Mirror of `ActionEvent`.

```prisma
model DecisionEvent {
  id          String   @id @default(cuid())
  decisionId  String
  fromStatus  String
  toStatus    String
  actorId     String   // userId; "agent" reserved for future agent-driven transitions
  reason      String?
  createdAt   DateTime @default(now())

  decision    Decision @relation(fields: [decisionId], references: [id], onDelete: Cascade)

  @@index([decisionId, createdAt])
}
```

### Modified: `JournalAdjustment` and `AdjustmentProposal`

`AdjustmentProposal` already has `approvedBy` and `approvedAt` columns (set by `approveAdjustment` today). What's missing is `reason` — the free-text rationale captured at decision time.

`JournalAdjustment` has none of the audit columns. Phase 1 adds three.

```prisma
model AdjustmentProposal {
  // … existing fields including approvedBy, approvedAt …
  reason      String?   // free-text rationale captured at decision time
}

model JournalAdjustment {
  // … existing fields …
  approvedBy  String?   // userId of approver — null only for legacy rows
  approvedAt  DateTime?
  reason      String?
}
```

All three new `JournalAdjustment` columns are nullable rather than required because (a) there may be existing dev rows, (b) making them required forces a backfill migration that has to invent data. The contract going forward is that every code path that creates a `JournalAdjustment` row must set all three. The only writer today is `approveAdjustment` in `lib/agent/tools/reconciliation.ts`; that's the call site Phase 1 modifies.

### Atomic creation flow

`proposeAdjustment` (in `lib/agent/tools/reconciliation.ts`) currently creates an `AdjustmentProposal` row. Phase 1 wraps that creation plus a paired `Decision` insert in `prisma.$transaction`:

```ts
const result = await prisma.$transaction(async (tx) => {
  const prop = await tx.adjustmentProposal.create({
    data: {
      breakId: b.id,
      proposedBy: "agent",
      description: args.description,
      debitAccount: args.debitAccount,
      creditAccount: args.creditAccount,
      amount: args.amount,
      baseAmount: args.amount,
      currency: b.txnCurrency,
      journalDate: new Date(),
      status: "pending",
    },
  });
  const dec = await tx.decision.create({
    data: {
      userId,
      type: "post_journal",
      proposalRef: prop.id,
      refModel: "AdjustmentProposal",
      headline: `Post ${prop.amount.toFixed(2)} ${prop.currency} — ${args.description}`,
      detail: `Break ${b.id} (${b.side})`,
      status: "pending",
    },
  });
  return { prop, dec };
});
```

Approval reverses through the `/api/decisions/[id]/decide` route, which routes through the existing `approveAdjustment` flow. In one transaction: create `JournalAdjustment` with `approvedBy`/`approvedAt`/`reason` populated, update `AdjustmentProposal.status = "posted"` plus its `reason`, update `Decision.status = "approved"` with `decidedBy`/`decidedAt`/`reason`, update `Break.status = "adjusted"`, write a `DecisionEvent`. Rejection: `Decision.status = "rejected"`, `AdjustmentProposal.status = "rejected"`, write a `DecisionEvent`, leave the break `open`. No `JournalAdjustment` is written on rejection.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/decisions` | GET | List `Decision` rows for the user. Query params: `?status=pending\|approved\|rejected\|needs_info` (default `pending`), `?limit`, `?cursor`. Returns rows hydrated with the linked `AdjustmentProposal` (lines, currency, narrative) for `type=post_journal`. |
| `/api/decisions/[id]` | GET | Single decision with full proposal hydration + linked break detail. |
| `/api/decisions/[id]/decide` | POST | Body: `{ outcome: "approve" \| "reject" \| "needs_info", reason?: string }`. Runs the transaction described above. Returns the updated decision. |
| `/api/audit-trail` | GET | Merged timeline. Query params: `?source=action\|decision\|data_source\|document\|match_run\|all` (multi-select via repeated param), `?from=YYYY-MM-DD`, `?to=YYYY-MM-DD`, `?limit`, `?cursor`. Returns a unified `AuditTimelineRow[]`. |
| `/api/audit-trail/export.csv` | GET | Same query params as `/api/audit-trail`, but streams CSV. No pagination — exports the full filtered set. |

All routes go through the same `getSession()` cookie gate already used by every other authenticated route. `userId` is extracted from session; queries scope on `userId`.

### `AuditTimelineRow` shape

```ts
type AuditTimelineRow = {
  id: string;                          // composite: `${source}:${nativeId}`
  source: "action" | "decision" | "data_source" | "document" | "match_run";
  timestamp: string;                   // ISO
  actorId: string | null;              // userId or "agent" or null for system-derived
  summary: string;                     // human-readable line
  refType: string | null;              // e.g. "Action", "Decision", "DataSource"
  refId: string | null;                // native id of the underlying row
  metadata: Record<string, unknown>;   // shape varies by source — never relied on for UI
};
```

The page renders `summary` + `timestamp` + `actorId`; `metadata` is for the row's drilldown panel, not list rendering.

### CSV export columns

`timestamp, source, actorId, summary, refType, refId`. Metadata is omitted from CSV — JSON in spreadsheets is hostile.

## UI changes

### `/decision-inbox`

Replace the `SAMPLE_DECISIONS` import + render with a fetch from `/api/decisions?status=pending`. Empty state: "No decisions waiting. The agent will queue one here when it proposes a reconciliation adjustment that needs your approval." Approve / Reject buttons become real (no more `disabled`); a third button opens a modal with a free-text reason for `needs_info` status.

The current visual layout (left-side row list, right-side detail panel with compliance checks) stays. The "compliance checks" panel for Phase 1 renders only what's available on the linked `AdjustmentProposal` — line totals, currency, narrative, the source `Break` summary. We do not invent fake checks.

### `/audit-trail`

Replace `SAMPLE_AUDIT_EVENTS` with a fetch from `/api/audit-trail`. The existing filter dropdowns (event type, time range) become functional — they push query params on change. The Export button calls `/api/audit-trail/export.csv` with the current filters and downloads the response.

Each row's icon is selected from `source` (Action → existing icon; Decision → gavel; DataSource → upload; Document → page; MatchRun → reconcile). Clicking a row opens a slide-over with the `metadata` JSON pretty-printed and a deep link to the source page (e.g. `/decision-inbox?select=dec_…`, `/data-sources?select=ds_…`).

### `/agent-runs` and `/compliance`

Both pages already render `<SampleDataBadge />` (verified in `app/(shell)/agent-runs/page.tsx` and `app/(shell)/compliance/page.tsx`). No changes required — they stay sample-driven through Phase 1.

### Removing badges from now-real pages

`<SampleDataBadge />` is currently rendered on `app/(shell)/decision-inbox/page.tsx` and `app/(shell)/audit-trail/page.tsx`. Once those pages are wired to real data they no longer need the badge — Phase 1 removes those two badge invocations as part of the page rewrites.

## Error handling

- `/api/decisions/[id]/decide` is wrapped in `prisma.$transaction`. If posting the journal fails (e.g. balance check), the whole transaction rolls back, decision stays `pending`, no `JournalAdjustment` is written. The route returns 422 with a reason.
- `/api/audit-trail` queries five sources independently and merges. A failure in any one source returns the rows from the others plus a per-source error in the response payload — same shape as `/api/close/readiness` already uses (`{ rows, errors: { source: message } }`). The UI shows a small banner if any source errored, but doesn't block the page.
- The CSV export endpoint uses the same per-source error isolation. If a source fails, the CSV is still produced from the rest, and a `# warnings:` comment line is prepended listing failed sources.

## Testing strategy

Following the existing pattern (`__tests__/` for unit, `tests/` for integration against live Neon).

**Unit tests** (no DB):

- `lib/audit-trail/normalize.test.ts` — input fixtures for each of the five sources, verify each maps to a correct `AuditTimelineRow`. The mapper is the part most likely to drift.
- `lib/decisions/transitions.test.ts` — state machine: legal `pending → approved`, `pending → rejected`, `pending → needs_info`; illegal `approved → pending`, etc.

**Integration tests** (live Neon, follow `tests/close-readiness-upload.test.ts` pattern):

- `tests/decisions/propose-and-approve.test.ts` — seed a `Break`, call `proposeAdjustment` (verify both `AdjustmentProposal` and `Decision` are created in one transaction; one of them failing rolls back the other), call `decide` with `approve` (verify `JournalAdjustment` has `approvedBy/At/reason`, `Decision.status = approved`, `DecisionEvent` row written, `AdjustmentProposal.status = approved`, `Break.status = adjusted`).
- `tests/decisions/reject.test.ts` — same setup, `decide` with `reject`. Verify no `JournalAdjustment` is written, decision/proposal both move to `rejected`, break stays `open`.
- `tests/audit-trail/merge.test.ts` — seed one row in each of the five sources, call `/api/audit-trail`, assert all five appear, assert ordering, assert filter by `source` narrows correctly.
- `tests/audit-trail/export.test.ts` — same seeding, call CSV endpoint, parse response, assert column set + row count.

The integration tests follow the existing convention of seeding inside the test, asserting outcomes, and not cleaning up between tests (each test uses unique userIds).

## Migration

One Prisma migration: `phase1_decisions_audit`. Adds `Decision`, `DecisionEvent`, three columns on `JournalAdjustment`. No data migration needed (new tables are empty; new columns are nullable). On Neon, `prisma migrate deploy` against the dev branch first, then production after merge.

## Rollout

- Single feature branch: `feature/phase1-honest-observe`.
- No feature flag — single-user dogfood, the cost of flagging exceeds the cost of a clean cutover.
- Merge order: schema migration commit, then implementation commits, then UI commits — so each commit is independently runnable.

## Open questions

None known. If the integration tests reveal that hydrating `AdjustmentProposal` lines into the Decision row payload is too expensive at list time, the list endpoint will switch to a thin shape (no proposal hydration) and `[id]` will be the hydrated endpoint. That's a backend-only change.

## Out of scope, explicitly

- Posting `JournalAdjustment` from anywhere other than `approveAdjustment` (e.g. directly from the agent without a Decision wrapper). Phase 1 makes the Decision the *only* gate.
- A `Decision`-level audit query (e.g. "show me all decisions for period 2026-04"). Phase 1's Audit Trail is timestamp-ordered; period scoping comes via the filter on linked `AdjustmentProposal.break.periodKey` in Phase 2 if needed.
- Rejecting a `Decision` does not currently re-open the `Break` for *re-proposal*. The break stays `open`, but the agent has to be re-prompted. Auto-reproposal is a Phase 2 concern.
