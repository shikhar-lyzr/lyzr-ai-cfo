# Unified Decision Inbox

**Date:** 2026-04-27
**Status:** Spec — pending implementation plan

## Problem

`/decision-inbox` today shows only `Decision` rows. It misses pending `Action` rows
(variance, anomaly, recommendation, ar_followup, reconciliation_break) — which the
user already sees in the Command Center action feed. There is no single place to
answer "what's waiting on me."

## Decision: Path B (inbox is a view, not a new schema)

The inbox becomes a presentational view that **unions `Decision` + pending `Action`
rows** at read time. No schema change. Each row dispatches to its existing
mutation endpoint when actioned. We deliberately do *not* promote variance/AR into
the `Decision` model — that's Path A and is premature until dogfooding tells us
whether `Action` and `Decision` should remain distinct concepts.

## Page Structure

`/decision-inbox` becomes a single-purpose **pending-only** working surface:

- One header metric card: **Pending count** (sum of pending Decisions + pending Actions).
- No tabs. No Approved/Rejected metric cards. Resolved items move out of view; the
  user goes to **Audit Trail** to see history.
- One list, sorted by `createdAt` desc, mixing both row types.
- Empty state: "Nothing waiting on you. The agent will queue items here when it
  needs your call." — links to Audit Trail.

This is a deliberate narrowing from today's three-tab layout. Rationale: the
inbox's job is "what needs my attention right now"; outcomes belong in the audit
view that already shows the five-source timeline.

## Row Model

A unified row type at the view layer:

```ts
type InboxRow = {
  source: "decision" | "action";
  id: string;             // Decision.id or Action.id
  kind:
    | "post_journal"      // Decision (recon-break adjustment)
    | "variance"          // Action
    | "anomaly"           // Action
    | "recommendation"    // Action
    | "ar_followup"       // Action
    | "reconciliation_break"; // Action
  headline: string;
  detail: string | null;
  createdAt: Date;
  // Source-specific payload, used only by the detail view + handlers
  decision?: DecisionRow;
  action?: ActionRow;
};
```

The list page renders rows uniformly. The detail/side panel branches on `source +
kind` to render the right buttons and call the right endpoint.

## Per-Type Buttons and Dispatch

Locked in Q2 = (b). Each row type has its own button set and its own endpoint —
the inbox does **not** unify these.

| Row source / kind            | Buttons                          | Dispatch                                                                 |
|-----------------------------|----------------------------------|--------------------------------------------------------------------------|
| Decision (any type)         | Approve / Reject / Needs Info    | `POST /api/decisions/{id}/decide` with `{outcome, reason?}` (existing)   |
| Action — variance           | Approve / Dismiss                | `PATCH /api/actions/{id}` with `{status: "approved" \| "dismissed"}`     |
| Action — anomaly            | Acknowledge / Dismiss            | `PATCH /api/actions/{id}` with `{status: "approved" \| "dismissed"}` *   |
| Action — recommendation     | Acknowledge / Dismiss            | `PATCH /api/actions/{id}` with `{status: "approved" \| "dismissed"}` *   |
| Action — reconciliation_break | Investigate / Dismiss          | Investigate → navigate to `/financial-reconciliation?breakId={id}` (Action stays `pending`, no mutation); Dismiss → `PATCH /api/actions/{id}` with `{status: "dismissed"}` |
| Action — ar_followup        | Mark Sent / Snooze / Escalate    | `POST /api/actions/{id}/ar` with `{op: "mark_sent" \| "snooze" \| "escalate", days?}` |

\* "Acknowledge" maps to `status: "approved"` because that's the existing schema
value for "user has seen and accepted." We're not adding a new status — the label
in UI is just more accurate to the semantics.

The reconciliation_break dispatch implies a small dependent change on
`/financial-reconciliation` (see Knock-on below).

## Knock-on: `/financial-reconciliation?breakId=…`

Q3 = (b) routed Investigate to the reconciliation page with a `breakId` query
param. The reconciliation page must, on mount, scroll to and visually highlight
the matching break row when this param is present. If the param is absent or the
break isn't on the current period, the page renders normally and ignores it (no
error toast — silent fallback).

This is a small additive change to the existing reconciliation page; it is in
scope for this spec.

## Data Loading

The `/decision-inbox` page server component runs two queries in parallel:

```ts
const [pendingDecisions, pendingActions] = await Promise.all([
  listDecisions(session.userId, "pending"),
  prisma.action.findMany({
    where: { userId: session.userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { dataSource: { select: { name: true } } },
  }),
]);
```

Both are mapped to `InboxRow[]`, concatenated, and re-sorted by `createdAt` desc.
No new service module — the existing `listDecisions` + a direct Prisma query is
enough for one page.

## Detail View

When the user opens a row, render a **full-page detail view that replaces the
list** — same pattern as today's Decision detail (back button, headline, body,
button row at the bottom). The detail content branches:

- **Decision rows:** unchanged from today — headline, detail, optional
  `AdjustmentProposal` block, reason textarea, three buttons.
- **Action rows:** headline, detail, `driver` text, source name, type-appropriate
  buttons. For `ar_followup`, also fetch and show the draft email body via
  `GET /api/actions/{id}/ar` (existing endpoint, lazy-generates draft).

After any successful mutation, call `router.refresh()` so the row drops out of
the list (it's no longer pending).

## What Stays Out of Scope

- **Path A** — promoting variance/AR into Decision rows. Eventual end state, not
  now.
- **Phase 2 reconciliation break-detail page** — independent project.
- **Phase 3 AR + Customer model** — independent project.
- **Bulk actions** (multi-select approve) — premature; revisit after dogfood.
- **Realtime updates** (websocket / SSE) — page is server-rendered and refreshes
  on action; that's enough.

## Testing

Component-level (vitest):

- `InboxRow` rendering for each `kind` shows the right buttons.
- Dispatch table: each button click calls the correct endpoint with the correct
  payload. Mock fetch.

Integration (vitest, hits live Neon):

- Page load returns combined pending list including both Decision and Action rows.
- Approving a variance Action via inbox marks it `status="approved"` and writes an
  `ActionEvent`.
- Snoozing an AR Action via inbox writes `Invoice.snoozedUntil` and marks
  Action `dismissed`.
- "Investigate" on a reconciliation_break row navigates to
  `/financial-reconciliation?breakId=…` and the page scrolls to that break.
- After action, the row no longer appears on the inbox page.

Out-of-scope for tests: AR draft email body content (covered by existing AR tests).

## File Touch List

New / modified files (estimated):

- `app/(shell)/decision-inbox/page.tsx` — load both queries, build `InboxRow[]`.
- `app/(shell)/decision-inbox/decision-inbox-client.tsx` — drop tabs, drop
  Approved/Rejected cards, render unified row, branch detail view, branch
  dispatch.
- `app/(shell)/decision-inbox/inbox-row.ts` (new) — type definition + mappers from
  Decision/Action to `InboxRow`.
- `app/(shell)/financial-reconciliation/…` (existing; touched) — read `breakId`
  from query params, scroll-to + highlight on mount.

No schema migration. No new API route.

## Risks / Open Questions

- **Action status semantics drift.** "Acknowledge" mapping to `approved` is a UI
  rename. If we later add a real `acknowledged` status, we'll have to backfill.
  Accepted risk — keeps schema untouched for now.
- **Reconciliation page deep-link** assumes the break is on the currently
  displayed period. If not, silent fallback. We may revisit if users complain.
