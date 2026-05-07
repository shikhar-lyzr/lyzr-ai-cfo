---
name: Unified Decision Inbox brainstorm — spec written
description: All four questions locked 2026-04-27; spec at docs/superpowers/specs/2026-04-27-unified-decision-inbox-design.md (commit 745cb5b); next step is writing-plans skill once user reviews
type: project
originSessionId: 465f934f-6788-4251-9641-526cb10e5f76
---
Brainstorm complete. Path B (inbox is a view, no schema change) chosen. Spec
committed in 745cb5b.

**Final answers:**

- Q1 = (a) Include all five Action types + Decision rows.
- Q2 = (b) Type-specific buttons (variance: Approve/Dismiss; AR: Mark Sent/Snooze/Escalate; anomaly + recommendation: Acknowledge/Dismiss; recon-break: Investigate/Dismiss; Decision: Approve/Reject/Needs Info).
- Q3 = (b) Investigate routes to `/financial-reconciliation?breakId=…`; reconciliation page must scroll-to + highlight on mount (knock-on, in-scope).
- Q4 = (c) Single Pending metric card. No Approved/Rejected cards.
- Q5 (raised this session) = (c1) Drop tabs entirely. Inbox is pending-only. Outcomes live in Audit Trail.

**How to apply (next session):**

User is reviewing the spec. When they approve, invoke `superpowers:writing-plans`
to produce the implementation plan. Do NOT invoke any other skill in between.

If user requests spec changes: edit the file, re-run spec self-review, re-ask
for approval.

**Reconciliation_break dispatch nuance to preserve in plan:** Investigate
navigates away but does NOT mutate the Action — it stays `pending` until the
user comes back and Dismisses or until the underlying break is resolved
through normal recon flow. Spec Per-Type table line for recon_break makes this
explicit; don't let the plan auto-dismiss on click-through.

**File touch list from spec:**
- `app/(shell)/decision-inbox/page.tsx`
- `app/(shell)/decision-inbox/decision-inbox-client.tsx`
- `app/(shell)/decision-inbox/inbox-row.ts` (new)
- `app/(shell)/financial-reconciliation/…` (breakId deep-link)

No schema migration. No new API route.
