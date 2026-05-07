---
name: Phase 1 — Make Observe Honest — merged
description: 2026-04-27 — Decision Inbox + Audit Trail wired to real data; Decision/DecisionEvent models; JournalAdjustment audit columns
type: project
originSessionId: 94b023d6-a34f-4093-ad5a-d92f03f76b66
---
Phase 1 of the three-phase "make the whole thing credible" plan merged to main 2026-04-27 (commit `041ce17`, plus polish + seed-script commits).

**What changed:**
- New `Decision` + `DecisionEvent` Prisma models. `proposeAdjustment` (recon agent tool) now creates AdjustmentProposal + Decision atomically.
- Audit columns added: `JournalAdjustment.{approvedBy, approvedAt, reason}`, `AdjustmentProposal.reason`.
- Decision Inbox (`/decision-inbox`) reads real `Decision` rows. Approve/Reject/Needs-Info buttons work via `POST /api/decisions/[id]/decide`. SampleDataBadge removed.
- Audit Trail (`/audit-trail`) reads merged five-source timeline (ActionEvent + DecisionEvent + DataSource.createdAt + Document.createdAt + MatchRun.completedAt). Per-source error isolation. Source-pill filters + date range + CSV export. SampleDataBadge removed.
- Migration `phase1_decisions_audit` applied to live Neon dev branch.
- 362/362 tests passing post-merge (was 338 pre-feature).

**What's next (deferred, in priority order):**
- Phase 2: Reconciliation break-detail page + REST endpoints for propose/approve. Needed for non-chat resolution.
- Phase 3: AR / Collections workspace + Customer model + payment application. Largest scope.

**Why:** Dogfooding Lyzr AI CFO at Lyzr — Phase 1 was the credibility floor (no fake `AE-1247` rows, no audit-less journal posts).

**How to apply:** Phase 2 brainstorm should start with the audit's reconciliation findings (no break-detail UI, agent-only resolution, no audit trail on JournalAdjustment) — Phase 1 fixed the audit-trail piece, but break-detail UI + REST resolution endpoints remain. Seed test decisions via `npx tsx scripts/seed-test-decision.ts <userId>` from inside the project root.

**Known follow-ups (from final review, deferred):**
- Audit-trail per-source `take: limit` skews timeline windows when one source dominates (cosmetic at low volume).
- `approveAdjustment` agent-tool preview path doesn't consult linked Decision (defensive, not a current bug).

**Open separate bug:** Agent at `/agent-console` ignored a direct `propose_adjustment` request and returned a generic deflection ("I've reviewed your financial data..."). Unrelated to Phase 1; investigate separately. Likely DUTIES.md / RULES.md not steering toward `propose_adjustment` for break-detail prompts.
