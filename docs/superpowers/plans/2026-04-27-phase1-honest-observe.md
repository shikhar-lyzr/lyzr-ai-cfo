# Phase 1 — Make Observe Honest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Decision Inbox and Audit Trail to real Prisma data, introduce the `Decision`/`DecisionEvent` models, and add audit columns to `JournalAdjustment` so the Observe surface honestly reflects state at Lyzr.

**Architecture:** Two new Prisma models (`Decision`, `DecisionEvent`) wrapping the existing `AdjustmentProposal`. Five-source audit timeline (typed `ActionEvent` + `DecisionEvent` joined with derived rows from `DataSource`/`Document`/`MatchRun.completedAt`). All routes session-cookie gated. UI rewrites for `/decision-inbox` and `/audit-trail` to consume the new APIs; `<SampleDataBadge />` removed from those two pages once real.

**Tech Stack:** Next.js 16 App Router · Prisma 6 (Postgres / Neon) · React 19 · TypeScript · Vitest 4 (jsdom env, integration tests in `tests/integration/`).

**Spec:** [docs/superpowers/specs/2026-04-27-phase1-honest-observe-design.md](../specs/2026-04-27-phase1-honest-observe-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `prisma/migrations/<timestamp>_phase1_decisions_audit/migration.sql` | Adds `Decision`, `DecisionEvent` tables; adds `reason` column to `AdjustmentProposal`; adds `approvedBy/approvedAt/reason` columns to `JournalAdjustment`. |
| `lib/decisions/transitions.ts` | Pure state-machine helper: `legalTransition(from, outcome) → toStatus \| null`. |
| `lib/decisions/service.ts` | Server-side helpers: `listDecisions`, `getDecision`, `decideOnProposal` (transactional). One file because they share Prisma queries. |
| `__tests__/lib/decisions/transitions.test.ts` | Unit tests for the state machine. |
| `app/api/decisions/route.ts` | `GET /api/decisions` (list, status filter). |
| `app/api/decisions/[id]/route.ts` | `GET /api/decisions/[id]` (single, hydrated). |
| `app/api/decisions/[id]/decide/route.ts` | `POST /api/decisions/[id]/decide` (approve/reject/needs_info). |
| `lib/audit-trail/types.ts` | Exports `AuditTimelineRow` and `AuditSource` types. |
| `lib/audit-trail/sources.ts` | Five normalizer functions, one per source: `fromActionEvent`, `fromDecisionEvent`, `fromDataSource`, `fromDocument`, `fromMatchRun`. Each returns `AuditTimelineRow[]`. |
| `lib/audit-trail/query.ts` | `queryAuditTrail({ userId, sources, from, to, limit, cursor })` — calls each normalizer in parallel via `safely()` and merges. Returns `{ rows, errors }`. |
| `lib/audit-trail/csv.ts` | `toCsv(rows, { warnings? })` — produces UTF-8 CSV string with header row and optional `# warnings: …` comment line. |
| `__tests__/lib/audit-trail/normalize.test.ts` | Unit tests for each normalizer (synthetic inputs, no DB). |
| `__tests__/lib/audit-trail/csv.test.ts` | Unit tests for CSV serialization. |
| `app/api/audit-trail/route.ts` | `GET /api/audit-trail` — calls `queryAuditTrail`, returns JSON. |
| `app/api/audit-trail/export.csv/route.ts` | `GET /api/audit-trail/export.csv` — same query, CSV streamed. |
| `tests/integration/decisions-propose-and-approve.test.ts` | Integration: seed break, propose, decide(approve). Asserts atomic creation and audit columns. |
| `tests/integration/decisions-reject.test.ts` | Integration: seed, propose, decide(reject). Asserts no JournalAdjustment, both rows rejected. |
| `tests/integration/audit-trail-merge.test.ts` | Integration: seed one row per source, query merged, assert order + filters. |
| `tests/integration/audit-trail-export.test.ts` | Integration: same seeding, hit CSV endpoint, parse + assert columns. |

### Modified files

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `Decision`, `DecisionEvent`. Add `reason` to `AdjustmentProposal`. Add `approvedBy`, `approvedAt`, `reason` to `JournalAdjustment`. Wire `User.decisions` relation. |
| `lib/agent/tools/reconciliation.ts` | `proposeAdjustment` wraps proposal + `Decision` creation in one `prisma.$transaction`. `approveAdjustment` accepts an optional `reason` arg, populates new audit columns and `Decision.status` in its existing transaction. |
| `app/(shell)/decision-inbox/page.tsx` | Replace `SAMPLE_DECISIONS` import + render with a server component that fetches via `lib/decisions/service.ts`. Approve / Reject / Needs-Info buttons become real (route to `/api/decisions/[id]/decide`). Remove `<SampleDataBadge />`. |
| `app/(shell)/audit-trail/page.tsx` | Replace `SAMPLE_AUDIT_EVENTS` with a server component that calls `queryAuditTrail`. Wire all four filter dropdowns (event source / actor type — drop journey filter; time range). Make Export button real (links to CSV endpoint with current query). Remove `<SampleDataBadge />`. |
| `tests/integration/cleanup.ts` | Add `deleteMany` calls for `Decision` (cascades to `DecisionEvent`) before `User.delete`. |
| `lib/config/sample-observe-data.ts` | Delete `SAMPLE_DECISIONS` export and `DecisionItem` type (still used by Compliance? grep first; keep types if so). |

---

## Task-by-Task

Tasks are ordered for safe per-task commits. Each commit leaves the build green.

---

### Task 1: Schema migration (Decision, DecisionEvent, audit columns)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase1_decisions_audit/migration.sql` (Prisma generates)

- [ ] **Step 1: Add `Decision` and `DecisionEvent` models, plus column additions, to `prisma/schema.prisma`**

Append to `prisma/schema.prisma` after `JournalAdjustment`:

```prisma
model Decision {
  id            String    @id @default(cuid())
  userId        String
  type          String
  proposalRef   String?
  refModel      String?
  headline      String
  detail        String?
  status        String    @default("pending")
  decidedBy     String?
  decidedAt     DateTime?
  reason        String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  events        DecisionEvent[]

  @@index([userId, status])
  @@index([userId, createdAt])
}

model DecisionEvent {
  id          String   @id @default(cuid())
  decisionId  String
  fromStatus  String
  toStatus    String
  actorId     String
  reason      String?
  createdAt   DateTime @default(now())

  decision    Decision @relation(fields: [decisionId], references: [id], onDelete: Cascade)

  @@index([decisionId, createdAt])
}
```

In the `User` model, add the relation in the relations block:

```prisma
  decisions          Decision[]
```

In the `AdjustmentProposal` model, add after `approvedAt`:

```prisma
  reason          String?
```

In the `JournalAdjustment` model, add after `lines`:

```prisma
  approvedBy  String?
  approvedAt  DateTime?
  reason      String?
```

- [ ] **Step 2: Create the migration**

Run:
```bash
npx prisma migrate dev --name phase1_decisions_audit
```

Expected: a new directory under `prisma/migrations/` containing `migration.sql`, and `npx prisma generate` runs implicitly producing the updated client.

- [ ] **Step 3: Verify the generated SQL matches expectations**

Open the new `prisma/migrations/*phase1_decisions_audit/migration.sql`. Verify it contains:
- `CREATE TABLE "Decision"` with all listed columns and indexes
- `CREATE TABLE "DecisionEvent"`
- `ALTER TABLE "AdjustmentProposal" ADD COLUMN "reason"`
- `ALTER TABLE "JournalAdjustment" ADD COLUMN "approvedBy"`, `"approvedAt"`, `"reason"`

If any are missing, the schema edit was wrong — fix and re-run `migrate dev`.

- [ ] **Step 4: Run typecheck to confirm Prisma client regenerated cleanly**

Run:
```bash
npx tsc --noEmit
```

Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): Decision/DecisionEvent models + audit columns

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Decision state-machine helper (TDD)

**Files:**
- Create: `lib/decisions/transitions.ts`
- Test: `__tests__/lib/decisions/transitions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/decisions/transitions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { legalTransition, type DecisionOutcome, type DecisionStatus } from "@/lib/decisions/transitions";

describe("legalTransition", () => {
  it("pending + approve → approved", () => {
    expect(legalTransition("pending", "approve")).toBe("approved");
  });
  it("pending + reject → rejected", () => {
    expect(legalTransition("pending", "reject")).toBe("rejected");
  });
  it("pending + needs_info → needs_info", () => {
    expect(legalTransition("pending", "needs_info")).toBe("needs_info");
  });
  it("needs_info + approve → approved", () => {
    expect(legalTransition("needs_info", "approve")).toBe("approved");
  });
  it("needs_info + reject → rejected", () => {
    expect(legalTransition("needs_info", "reject")).toBe("rejected");
  });
  it("approved + approve → null (terminal)", () => {
    expect(legalTransition("approved", "approve")).toBeNull();
  });
  it("rejected + approve → null (terminal)", () => {
    expect(legalTransition("rejected", "approve")).toBeNull();
  });
  it("rejects unknown current status", () => {
    expect(legalTransition("garbage" as DecisionStatus, "approve")).toBeNull();
  });
  it("rejects unknown outcome", () => {
    expect(legalTransition("pending", "garbage" as DecisionOutcome)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/decisions/transitions.test.ts`
Expected: FAIL with "Cannot find module '@/lib/decisions/transitions'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/decisions/transitions.ts`:

```ts
export type DecisionStatus = "pending" | "approved" | "rejected" | "needs_info";
export type DecisionOutcome = "approve" | "reject" | "needs_info";

const TABLE: Record<DecisionStatus, Partial<Record<DecisionOutcome, DecisionStatus>>> = {
  pending:    { approve: "approved", reject: "rejected", needs_info: "needs_info" },
  needs_info: { approve: "approved", reject: "rejected" },
  approved:   {},
  rejected:   {},
};

export function legalTransition(
  current: DecisionStatus,
  outcome: DecisionOutcome,
): DecisionStatus | null {
  return TABLE[current]?.[outcome] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/decisions/transitions.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/decisions/transitions.ts __tests__/lib/decisions/transitions.test.ts
git commit -m "feat(decisions): state-machine helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Decision service layer

**Files:**
- Create: `lib/decisions/service.ts`

- [ ] **Step 1: Write the file**

Create `lib/decisions/service.ts`:

```ts
import { prisma } from "@/lib/db";
import { legalTransition, type DecisionOutcome, type DecisionStatus } from "./transitions";

export async function listDecisions(
  userId: string,
  status: DecisionStatus = "pending",
  limit = 50,
) {
  const decisions = await prisma.decision.findMany({
    where: { userId, status },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  // Hydrate AdjustmentProposal for type=post_journal rows in one batch
  const proposalIds = decisions
    .filter((d) => d.type === "post_journal" && d.proposalRef)
    .map((d) => d.proposalRef as string);
  const proposals = proposalIds.length === 0
    ? []
    : await prisma.adjustmentProposal.findMany({
        where: { id: { in: proposalIds } },
        include: { break: true },
      });
  const byId = new Map(proposals.map((p) => [p.id, p]));

  return decisions.map((d) => ({
    ...d,
    proposal: d.proposalRef ? byId.get(d.proposalRef) ?? null : null,
  }));
}

export async function getDecision(userId: string, id: string) {
  const d = await prisma.decision.findFirst({ where: { id, userId } });
  if (!d) return null;
  let proposal = null;
  if (d.type === "post_journal" && d.proposalRef) {
    proposal = await prisma.adjustmentProposal.findUnique({
      where: { id: d.proposalRef },
      include: { break: true },
    });
  }
  return { ...d, proposal };
}

export type DecideArgs = {
  userId: string;
  decisionId: string;
  outcome: DecisionOutcome;
  reason?: string;
};

export type DecideResult =
  | { ok: true; decision: { id: string; status: DecisionStatus } }
  | { ok: false; code: "not_found" | "illegal_transition" | "post_failed"; message: string };

export async function decideOnProposal(args: DecideArgs): Promise<DecideResult> {
  const { userId, decisionId, outcome, reason } = args;

  const dec = await prisma.decision.findFirst({ where: { id: decisionId, userId } });
  if (!dec) return { ok: false, code: "not_found", message: `Decision ${decisionId} not found.` };

  const next = legalTransition(dec.status as DecisionStatus, outcome);
  if (!next) {
    return {
      ok: false,
      code: "illegal_transition",
      message: `Cannot ${outcome} a decision in status ${dec.status}.`,
    };
  }

  // needs_info: just transition the Decision; no proposal/journal mutation
  if (next === "needs_info") {
    await prisma.$transaction([
      prisma.decision.update({
        where: { id: dec.id },
        data: { status: next, decidedBy: null, decidedAt: null, reason: reason ?? null },
      }),
      prisma.decisionEvent.create({
        data: {
          decisionId: dec.id,
          fromStatus: dec.status,
          toStatus: next,
          actorId: userId,
          reason: reason ?? null,
        },
      }),
    ]);
    return { ok: true, decision: { id: dec.id, status: next } };
  }

  if (next === "rejected") {
    await prisma.$transaction([
      prisma.decision.update({
        where: { id: dec.id },
        data: { status: next, decidedBy: userId, decidedAt: new Date(), reason: reason ?? null },
      }),
      prisma.decisionEvent.create({
        data: {
          decisionId: dec.id,
          fromStatus: dec.status,
          toStatus: next,
          actorId: userId,
          reason: reason ?? null,
        },
      }),
      ...(dec.proposalRef
        ? [
            prisma.adjustmentProposal.update({
              where: { id: dec.proposalRef },
              data: { status: "rejected", reason: reason ?? null },
            }),
          ]
        : []),
    ]);
    return { ok: true, decision: { id: dec.id, status: next } };
  }

  // approved: post the journal in one transaction with all the audit columns
  if (!dec.proposalRef) {
    return { ok: false, code: "post_failed", message: "Decision has no proposalRef to post." };
  }
  const proposalId = dec.proposalRef;

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.adjustmentProposal.updateMany({
        where: { id: proposalId, status: "pending" },
        data: {
          status: "posted",
          approvedBy: userId,
          approvedAt: new Date(),
          reason: reason ?? null,
        },
      });
      if (claim.count === 0) throw new Error("ALREADY_POSTED");

      const proposal = await tx.adjustmentProposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new Error("PROPOSAL_VANISHED");

      const journal = await tx.journalAdjustment.create({
        data: {
          userId,
          proposalId: proposal.id,
          entryDate: new Date(),
          lines: [
            { account: proposal.debitAccount, dr: proposal.amount, cr: 0, baseAmount: proposal.baseAmount },
            { account: proposal.creditAccount, dr: 0, cr: proposal.amount, baseAmount: proposal.baseAmount },
          ],
          approvedBy: userId,
          approvedAt: new Date(),
          reason: reason ?? null,
        },
      });

      await tx.adjustmentProposal.update({
        where: { id: proposal.id },
        data: { postedJournalId: journal.id },
      });
      await tx.break.update({
        where: { id: proposal.breakId },
        data: { status: "adjusted" },
      });
      await tx.decision.update({
        where: { id: dec.id },
        data: { status: "approved", decidedBy: userId, decidedAt: new Date(), reason: reason ?? null },
      });
      await tx.decisionEvent.create({
        data: {
          decisionId: dec.id,
          fromStatus: dec.status,
          toStatus: "approved",
          actorId: userId,
          reason: reason ?? null,
        },
      });
    }, { timeout: 30_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "post_failed", message: msg };
  }

  return { ok: true, decision: { id: dec.id, status: "approved" } };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/decisions/service.ts
git commit -m "feat(decisions): service layer (list, get, decide)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update integration test cleanup helper

**Files:**
- Modify: `tests/integration/cleanup.ts`

- [ ] **Step 1: Add Decision deletion**

Edit `tests/integration/cleanup.ts`. After the line `await prisma.matchRun.deleteMany({ where: { userId } });` and before `// Documents, journals, …`, insert:

```ts
  // Decisions cascade to DecisionEvent
  await prisma.decision.deleteMany({ where: { userId } });
```

The full updated function should read:

```ts
export async function deleteTestUser(userId: string): Promise<void> {
  // Action-side: ActionEvent references Action; ChatMessage references Action
  await prisma.actionEvent.deleteMany({ where: { userId } });
  await prisma.chatMessage.deleteMany({ where: { userId } });
  await prisma.action.deleteMany({ where: { userId } });

  // MatchRun cascades to MatchLink and Break
  await prisma.matchRun.deleteMany({ where: { userId } });

  // Decisions cascade to DecisionEvent
  await prisma.decision.deleteMany({ where: { userId } });

  // Documents, journals, recon periods (Restrict)
  await prisma.document.deleteMany({ where: { userId } });
  await prisma.journalAdjustment.deleteMany({ where: { userId } });
  await prisma.reconPeriod.deleteMany({ where: { userId } });

  // DataSource cascades to FinancialRecord/Invoice/GLEntry/SubLedgerEntry
  await prisma.dataSource.deleteMany({ where: { userId } });

  await prisma.user.delete({ where: { id: userId } });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/cleanup.ts
git commit -m "test(integration): clean up Decision rows in deleteTestUser

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wrap proposeAdjustment in atomic transaction

**Files:**
- Modify: `lib/agent/tools/reconciliation.ts:320-366`

- [ ] **Step 1: Replace the `proposeAdjustment` body**

Open `lib/agent/tools/reconciliation.ts`. Find the `proposeAdjustment` tool (around line 320). Replace the inner async function body from `const b = await prisma.break.findFirst(...)` through the existing `return { text: ... };` with:

```ts
    async (args) => {
      const b = await prisma.break.findFirst({
        where: { id: args.breakId, matchRun: { userId } },
      });
      if (!b) return { text: `Break ${args.breakId} not found.`, details: {} };

      const existing = await prisma.adjustmentProposal.findFirst({
        where: { breakId: b.id, status: "pending" },
      });
      if (existing) {
        return {
          text: `A pending proposal already exists for break ${b.id} (proposal ${existing.id}). Approve or reject it first.`,
          details: { existingProposalId: existing.id },
        };
      }

      const { prop, dec } = await prisma.$transaction(async (tx) => {
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

      return {
        text: `Proposal ${prop.id} pending review (decision ${dec.id}). User must approve via Decision Inbox before posting.`,
        details: { proposalId: prop.id, decisionId: dec.id, proposal: prop },
      };
    }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run existing reconciliation tests if any pass already**

Run: `npx vitest run __tests__/lib/reconciliation 2>/dev/null || echo "no existing recon tests"`
If any existed, they should still pass. If none, that's fine — Task 9 covers the integration test.

- [ ] **Step 4: Commit**

```bash
git add lib/agent/tools/reconciliation.ts
git commit -m "feat(reconciliation): proposeAdjustment creates Decision atomically

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Replace approveAdjustment with the service-layer call

**Files:**
- Modify: `lib/agent/tools/reconciliation.ts` (the `approveAdjustment` tool, around lines 368–441)

The existing `approveAdjustment` does its own transaction. After Phase 1, the canonical decide-path is `decideOnProposal` in the service. The agent tool keeps existing for backwards compatibility with the chat flow but delegates.

- [ ] **Step 1: Add the import at the top of the file**

In `lib/agent/tools/reconciliation.ts`, add to the import block at the top:

```ts
import { decideOnProposal } from "@/lib/decisions/service";
```

- [ ] **Step 2: Replace the `approveAdjustment` body**

Replace the inner async function of `approveAdjustment` (everything between `async (args) => {` and the closing `}` of that arrow function — roughly lines 379–440) with:

```ts
    async (args) => {
      const p = await prisma.adjustmentProposal.findFirst({
        where: { id: args.proposalId, break: { matchRun: { userId } } },
      });
      if (!p) return { text: `Proposal ${args.proposalId} not found.`, details: {} };
      if (p.status !== "pending") return { text: `Proposal already ${p.status}.`, details: { status: p.status } };

      if (!args.confirm) {
        return {
          text:
            `PREVIEW — not posted. DR ${p.debitAccount} / CR ${p.creditAccount} for ${p.amount} ${p.currency}. ` +
            `Description: "${p.description}". Call again with confirm:true to post.`,
          details: { proposal: p, preview: true },
        };
      }

      // Look up the linked Decision so we route through the service layer.
      const dec = await prisma.decision.findFirst({
        where: { userId, type: "post_journal", proposalRef: p.id, status: { in: ["pending", "needs_info"] } },
        orderBy: { createdAt: "desc" },
      });
      if (!dec) {
        return {
          text: `Proposal ${p.id} has no pending Decision. The user must approve via the Decision Inbox.`,
          details: { proposalId: p.id },
        };
      }

      const result = await decideOnProposal({
        userId,
        decisionId: dec.id,
        outcome: "approve",
        reason: "Approved via agent confirm:true",
      });

      if (!result.ok) {
        return { text: `Approval failed: ${result.message}`, details: { code: result.code } };
      }
      return {
        text: `Posted journal for proposal ${p.id}. Break flipped to adjusted.`,
        details: { decisionId: dec.id, proposalId: p.id },
      };
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/agent/tools/reconciliation.ts
git commit -m "refactor(reconciliation): approveAdjustment delegates to decision service

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Decisions API routes

**Files:**
- Create: `app/api/decisions/route.ts`
- Create: `app/api/decisions/[id]/route.ts`
- Create: `app/api/decisions/[id]/decide/route.ts`

- [ ] **Step 1: Create `app/api/decisions/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDecisions } from "@/lib/decisions/service";
import type { DecisionStatus } from "@/lib/decisions/transitions";

const STATUSES = new Set<DecisionStatus>(["pending", "approved", "rejected", "needs_info"]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
  if (!STATUSES.has(statusParam as DecisionStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

  const decisions = await listDecisions(session.userId, statusParam as DecisionStatus, limit);
  return NextResponse.json({ decisions });
}
```

- [ ] **Step 2: Create `app/api/decisions/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDecision } from "@/lib/decisions/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const decision = await getDecision(session.userId, id);
  if (!decision) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  return NextResponse.json({ decision });
}
```

- [ ] **Step 3: Create `app/api/decisions/[id]/decide/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decideOnProposal } from "@/lib/decisions/service";
import type { DecisionOutcome } from "@/lib/decisions/transitions";

const OUTCOMES = new Set<DecisionOutcome>(["approve", "reject", "needs_info"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { outcome, reason } = body as { outcome?: string; reason?: string };

  if (!outcome || !OUTCOMES.has(outcome as DecisionOutcome)) {
    return NextResponse.json({ error: "outcome must be approve | reject | needs_info" }, { status: 400 });
  }

  const result = await decideOnProposal({
    userId: session.userId,
    decisionId: id,
    outcome: outcome as DecisionOutcome,
    reason,
  });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "illegal_transition" ? 409 : 422;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/decisions/
git commit -m "feat(api): /api/decisions list, get, decide routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Integration test — propose + approve

**Files:**
- Create: `tests/integration/decisions-propose-and-approve.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { decideOnProposal } from "@/lib/decisions/service";
import { deleteTestUser } from "./cleanup";

describe("decisions propose-and-approve flow", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("propose creates AdjustmentProposal + Decision atomically; approve posts journal with audit columns", async () => {
    // Seed: a MatchRun + Break to satisfy proposeAdjustment guards
    const run = await prisma.matchRun.create({
      data: {
        userId,
        periodKey: "2026-04",
        triggeredBy: "test",
        strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 0, partial: 0, unmatched: 1,
        completedAt: new Date(),
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id,
        side: "gl_only",
        entryId: "fake_gl",
        amount: 0.42,
        baseAmount: 0.42,
        txnCurrency: "USD",
        ageDays: 3,
        ageBucket: "0-30d",
        severity: "low",
        severityRank: 1,
        status: "open",
      },
    });

    // Simulate proposeAdjustment's transaction directly (the agent tool wraps it)
    const { prop, dec } = await prisma.$transaction(async (tx) => {
      const prop = await tx.adjustmentProposal.create({
        data: {
          breakId: brk.id,
          proposedBy: "agent",
          description: "FX rounding 2026-04",
          debitAccount: "5400-cash",
          creditAccount: "7900-fx-gl",
          amount: 0.42,
          baseAmount: 0.42,
          currency: "USD",
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
          headline: "Post 0.42 USD — FX rounding",
          detail: `Break ${brk.id} (gl_only)`,
          status: "pending",
        },
      });
      return { prop, dec };
    });

    expect(prop.status).toBe("pending");
    expect(dec.status).toBe("pending");
    expect(dec.proposalRef).toBe(prop.id);

    // Approve through the service layer
    const result = await decideOnProposal({
      userId,
      decisionId: dec.id,
      outcome: "approve",
      reason: "rounding adjustment confirmed",
    });
    expect(result.ok).toBe(true);

    // Verify all the post-conditions
    const decAfter = await prisma.decision.findUnique({ where: { id: dec.id } });
    expect(decAfter?.status).toBe("approved");
    expect(decAfter?.decidedBy).toBe(userId);
    expect(decAfter?.reason).toBe("rounding adjustment confirmed");

    const propAfter = await prisma.adjustmentProposal.findUnique({ where: { id: prop.id } });
    expect(propAfter?.status).toBe("posted");
    expect(propAfter?.approvedBy).toBe(userId);
    expect(propAfter?.reason).toBe("rounding adjustment confirmed");
    expect(propAfter?.postedJournalId).toBeTruthy();

    const journal = await prisma.journalAdjustment.findUnique({
      where: { id: propAfter!.postedJournalId! },
    });
    expect(journal?.approvedBy).toBe(userId);
    expect(journal?.reason).toBe("rounding adjustment confirmed");

    const brkAfter = await prisma.break.findUnique({ where: { id: brk.id } });
    expect(brkAfter?.status).toBe("adjusted");

    const events = await prisma.decisionEvent.findMany({ where: { decisionId: dec.id } });
    expect(events).toHaveLength(1);
    expect(events[0].toStatus).toBe("approved");
    expect(events[0].actorId).toBe(userId);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/integration/decisions-propose-and-approve.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/decisions-propose-and-approve.test.ts
git commit -m "test(integration): decisions propose-and-approve happy path

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Integration test — reject

**Files:**
- Create: `tests/integration/decisions-reject.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { decideOnProposal } from "@/lib/decisions/service";
import { deleteTestUser } from "./cleanup";

describe("decisions reject flow", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("reject leaves break open; no JournalAdjustment is written", async () => {
    const run = await prisma.matchRun.create({
      data: {
        userId, periodKey: "2026-04", triggeredBy: "test", strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 0, partial: 0, unmatched: 1,
        completedAt: new Date(),
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id, side: "gl_only", entryId: "x", amount: 1, baseAmount: 1,
        txnCurrency: "USD", ageDays: 1, ageBucket: "0-30d", severity: "low", severityRank: 1, status: "open",
      },
    });
    const prop = await prisma.adjustmentProposal.create({
      data: {
        breakId: brk.id, proposedBy: "agent", description: "test", debitAccount: "x", creditAccount: "y",
        amount: 1, baseAmount: 1, currency: "USD", journalDate: new Date(), status: "pending",
      },
    });
    const dec = await prisma.decision.create({
      data: {
        userId, type: "post_journal", proposalRef: prop.id, refModel: "AdjustmentProposal",
        headline: "h", detail: "d", status: "pending",
      },
    });

    const result = await decideOnProposal({
      userId, decisionId: dec.id, outcome: "reject", reason: "wrong account",
    });
    expect(result.ok).toBe(true);

    const decAfter = await prisma.decision.findUnique({ where: { id: dec.id } });
    expect(decAfter?.status).toBe("rejected");
    expect(decAfter?.reason).toBe("wrong account");

    const propAfter = await prisma.adjustmentProposal.findUnique({ where: { id: prop.id } });
    expect(propAfter?.status).toBe("rejected");
    expect(propAfter?.reason).toBe("wrong account");
    expect(propAfter?.postedJournalId).toBeNull();

    const brkAfter = await prisma.break.findUnique({ where: { id: brk.id } });
    expect(brkAfter?.status).toBe("open");

    const journals = await prisma.journalAdjustment.findMany({ where: { userId } });
    expect(journals).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/integration/decisions-reject.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/decisions-reject.test.ts
git commit -m "test(integration): decisions reject leaves break open

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Audit-trail types and source normalizers

**Files:**
- Create: `lib/audit-trail/types.ts`
- Create: `lib/audit-trail/sources.ts`
- Create: `__tests__/lib/audit-trail/normalize.test.ts`

- [ ] **Step 1: Write `lib/audit-trail/types.ts`**

```ts
export type AuditSource = "action" | "decision" | "data_source" | "document" | "match_run";

export type AuditTimelineRow = {
  id: string;                          // composite: `${source}:${nativeId}`
  source: AuditSource;
  timestamp: string;                   // ISO
  actorId: string | null;
  summary: string;
  refType: string | null;
  refId: string | null;
  metadata: Record<string, unknown>;
};
```

- [ ] **Step 2: Write `lib/audit-trail/sources.ts`**

```ts
import type {
  ActionEvent, DecisionEvent, DataSource, Document, MatchRun,
} from "@prisma/client";
import type { AuditTimelineRow } from "./types";

export function fromActionEvent(e: ActionEvent & { action?: { headline?: string | null } | null }): AuditTimelineRow {
  return {
    id: `action:${e.id}`,
    source: "action",
    timestamp: e.createdAt.toISOString(),
    actorId: e.userId,
    summary: `Action ${e.fromStatus} → ${e.toStatus}${e.action?.headline ? ` (${e.action.headline})` : ""}`,
    refType: "Action",
    refId: e.actionId,
    metadata: { fromStatus: e.fromStatus, toStatus: e.toStatus },
  };
}

export function fromDecisionEvent(e: DecisionEvent & { decision?: { headline?: string | null } | null }): AuditTimelineRow {
  return {
    id: `decision:${e.id}`,
    source: "decision",
    timestamp: e.createdAt.toISOString(),
    actorId: e.actorId,
    summary: `Decision ${e.fromStatus} → ${e.toStatus}${e.decision?.headline ? ` (${e.decision.headline})` : ""}`,
    refType: "Decision",
    refId: e.decisionId,
    metadata: { fromStatus: e.fromStatus, toStatus: e.toStatus, reason: e.reason ?? null },
  };
}

export function fromDataSource(d: DataSource): AuditTimelineRow {
  return {
    id: `data_source:${d.id}`,
    source: "data_source",
    timestamp: d.createdAt.toISOString(),
    actorId: d.userId,
    summary: `Uploaded ${d.name} (${d.type}, ${d.recordCount} rows, status=${d.status})`,
    refType: "DataSource",
    refId: d.id,
    metadata: { type: d.type, status: d.status, recordCount: d.recordCount },
  };
}

export function fromDocument(d: Document): AuditTimelineRow {
  return {
    id: `document:${d.id}`,
    source: "document",
    timestamp: d.createdAt.toISOString(),
    actorId: d.userId,
    summary: `Generated ${d.type}: ${d.title}${d.period ? ` (period ${d.period})` : ""}`,
    refType: "Document",
    refId: d.id,
    metadata: { type: d.type, period: d.period ?? null },
  };
}

export function fromMatchRun(m: MatchRun): AuditTimelineRow {
  // Caller filters out runs where completedAt is null; we still guard.
  const ts = (m.completedAt ?? m.startedAt).toISOString();
  return {
    id: `match_run:${m.id}`,
    source: "match_run",
    timestamp: ts,
    actorId: m.userId,
    summary: `Match run for ${m.periodKey} — ${m.matched}/${m.totalGL + m.totalSub} matched, ${m.unmatched + m.partial} unmatched`,
    refType: "MatchRun",
    refId: m.id,
    metadata: {
      periodKey: m.periodKey,
      matched: m.matched, partial: m.partial, unmatched: m.unmatched,
      totalGL: m.totalGL, totalSub: m.totalSub,
    },
  };
}
```

- [ ] **Step 3: Write the unit test**

Create `__tests__/lib/audit-trail/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  fromActionEvent, fromDecisionEvent, fromDataSource, fromDocument, fromMatchRun,
} from "@/lib/audit-trail/sources";

const ts = new Date("2026-04-15T10:30:00Z");

describe("audit-trail normalizers", () => {
  it("ActionEvent → row", () => {
    const row = fromActionEvent({
      id: "ae1", actionId: "a1", userId: "u1",
      fromStatus: "pending", toStatus: "approved", createdAt: ts,
      action: { headline: "Variance review" },
    } as never);
    expect(row).toEqual({
      id: "action:ae1",
      source: "action",
      timestamp: "2026-04-15T10:30:00.000Z",
      actorId: "u1",
      summary: "Action pending → approved (Variance review)",
      refType: "Action",
      refId: "a1",
      metadata: { fromStatus: "pending", toStatus: "approved" },
    });
  });

  it("DecisionEvent → row carries reason", () => {
    const row = fromDecisionEvent({
      id: "de1", decisionId: "d1", actorId: "u1",
      fromStatus: "pending", toStatus: "approved", reason: "ok", createdAt: ts,
      decision: { headline: "Post 0.42 USD" },
    } as never);
    expect(row.source).toBe("decision");
    expect(row.summary).toContain("(Post 0.42 USD)");
    expect(row.metadata).toMatchObject({ reason: "ok" });
  });

  it("DataSource → row uses name + type + recordCount", () => {
    const row = fromDataSource({
      id: "ds1", userId: "u1", name: "ar.csv", type: "ar",
      status: "ready", recordCount: 8, metadata: null, contentHash: null, createdAt: ts,
    });
    expect(row.summary).toContain("ar.csv");
    expect(row.summary).toContain("8 rows");
    expect(row.metadata).toMatchObject({ type: "ar", recordCount: 8 });
  });

  it("Document → includes period when present", () => {
    const row = fromDocument({
      id: "doc1", userId: "u1", type: "close_package", title: "April Close", body: "",
      dataSourceId: null, period: "2026-04", createdAt: ts, updatedAt: ts,
    });
    expect(row.summary).toContain("close_package");
    expect(row.summary).toContain("(period 2026-04)");
  });

  it("MatchRun → uses completedAt when set", () => {
    const completedAt = new Date("2026-04-16T10:00:00Z");
    const row = fromMatchRun({
      id: "mr1", userId: "u1", periodKey: "2026-04", triggeredBy: "agent",
      strategyConfig: {}, totalGL: 100, totalSub: 90, matched: 85, partial: 0, unmatched: 5,
      startedAt: ts, completedAt,
    });
    expect(row.timestamp).toBe(completedAt.toISOString());
    expect(row.summary).toContain("85/190 matched");
  });

  it("MatchRun → falls back to startedAt when completedAt null", () => {
    const row = fromMatchRun({
      id: "mr2", userId: "u1", periodKey: "2026-04", triggeredBy: "agent",
      strategyConfig: {}, totalGL: 0, totalSub: 0, matched: 0, partial: 0, unmatched: 0,
      startedAt: ts, completedAt: null,
    });
    expect(row.timestamp).toBe(ts.toISOString());
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run __tests__/lib/audit-trail/normalize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/audit-trail/types.ts lib/audit-trail/sources.ts __tests__/lib/audit-trail/normalize.test.ts
git commit -m "feat(audit-trail): types + per-source normalizers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Audit-trail query layer

**Files:**
- Create: `lib/audit-trail/query.ts`

- [ ] **Step 1: Write `lib/audit-trail/query.ts`**

```ts
import { prisma } from "@/lib/db";
import {
  fromActionEvent, fromDecisionEvent, fromDataSource, fromDocument, fromMatchRun,
} from "./sources";
import type { AuditSource, AuditTimelineRow } from "./types";

export type AuditQueryArgs = {
  userId: string;
  sources?: AuditSource[];          // default: all five
  from?: Date;
  to?: Date;
  limit?: number;                   // default 200, max 1000
};

export type AuditQueryResult = {
  rows: AuditTimelineRow[];
  errors: Partial<Record<AuditSource, string>>;
};

const ALL: AuditSource[] = ["action", "decision", "data_source", "document", "match_run"];

async function safe<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function queryAuditTrail(args: AuditQueryArgs): Promise<AuditQueryResult> {
  const { userId, from, to, limit = 200 } = args;
  const sources = args.sources && args.sources.length > 0 ? args.sources : ALL;
  const cap = Math.min(limit, 1000);
  const errors: Partial<Record<AuditSource, string>> = {};

  const dateFilter = (col: string) => {
    const f: Record<string, unknown> = {};
    if (from) f.gte = from;
    if (to) f.lte = to;
    return Object.keys(f).length === 0 ? {} : { [col]: f };
  };

  const tasks: Array<Promise<AuditTimelineRow[]>> = [];

  if (sources.includes("action")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.actionEvent.findMany({
        where: { userId, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
        include: { action: { select: { headline: true } } },
      }));
      if (!r.ok) { errors.action = r.error; return []; }
      return r.value.map(fromActionEvent);
    })());
  }
  if (sources.includes("decision")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.decisionEvent.findMany({
        where: { decision: { userId }, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
        include: { decision: { select: { headline: true } } },
      }));
      if (!r.ok) { errors.decision = r.error; return []; }
      return r.value.map(fromDecisionEvent);
    })());
  }
  if (sources.includes("data_source")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.dataSource.findMany({
        where: { userId, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
      }));
      if (!r.ok) { errors.data_source = r.error; return []; }
      return r.value.map(fromDataSource);
    })());
  }
  if (sources.includes("document")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.document.findMany({
        where: { userId, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
      }));
      if (!r.ok) { errors.document = r.error; return []; }
      return r.value.map(fromDocument);
    })());
  }
  if (sources.includes("match_run")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.matchRun.findMany({
        where: { userId, completedAt: { not: null }, ...dateFilter("completedAt") },
        orderBy: { completedAt: "desc" },
        take: cap,
      }));
      if (!r.ok) { errors.match_run = r.error; return []; }
      return r.value.map(fromMatchRun);
    })());
  }

  const groups = await Promise.all(tasks);
  const merged = groups.flat();
  merged.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));

  return { rows: merged.slice(0, cap), errors };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/audit-trail/query.ts
git commit -m "feat(audit-trail): merged five-source query with per-source error isolation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Audit-trail CSV serializer (TDD)

**Files:**
- Create: `lib/audit-trail/csv.ts`
- Test: `__tests__/lib/audit-trail/csv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/audit-trail/csv";
import type { AuditTimelineRow } from "@/lib/audit-trail/types";

const row = (id: string, source: AuditTimelineRow["source"], summary: string): AuditTimelineRow => ({
  id, source,
  timestamp: "2026-04-15T10:30:00.000Z",
  actorId: "u1",
  summary,
  refType: "X",
  refId: "ref",
  metadata: {},
});

describe("toCsv", () => {
  it("emits header then a row per input", () => {
    const out = toCsv([row("a", "action", "hello")]);
    const lines = out.trim().split("\n");
    expect(lines[0]).toBe("timestamp,source,actorId,summary,refType,refId");
    expect(lines[1]).toBe("2026-04-15T10:30:00.000Z,action,u1,hello,X,ref");
  });

  it("quotes summaries containing commas, quotes, or newlines", () => {
    const out = toCsv([row("a", "action", `with, "quote" and\nnewline`)]);
    const dataLine = out.split("\n")[1];
    expect(dataLine).toContain('"with, ""quote"" and\nnewline"');
  });

  it("blank actorId becomes empty cell", () => {
    const r = { ...row("a", "data_source", "x"), actorId: null };
    const out = toCsv([r]);
    expect(out.split("\n")[1]).toBe("2026-04-15T10:30:00.000Z,data_source,,x,X,ref");
  });

  it("prepends warnings comment lines when given", () => {
    const out = toCsv([row("a", "action", "x")], { warnings: ["match_run failed: timeout"] });
    expect(out.split("\n")[0]).toBe("# warnings: match_run failed: timeout");
    expect(out.split("\n")[1]).toBe("timestamp,source,actorId,summary,refType,refId");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/audit-trail/csv.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

Create `lib/audit-trail/csv.ts`:

```ts
import type { AuditTimelineRow } from "./types";

const HEADER = ["timestamp", "source", "actorId", "summary", "refType", "refId"] as const;

function escape(v: string | null | undefined): string {
  if (v == null) return "";
  if (/[,"\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function toCsv(
  rows: AuditTimelineRow[],
  opts: { warnings?: string[] } = {},
): string {
  const out: string[] = [];
  if (opts.warnings && opts.warnings.length > 0) {
    out.push(`# warnings: ${opts.warnings.join("; ")}`);
  }
  out.push(HEADER.join(","));
  for (const r of rows) {
    out.push([
      escape(r.timestamp),
      escape(r.source),
      escape(r.actorId),
      escape(r.summary),
      escape(r.refType),
      escape(r.refId),
    ].join(","));
  }
  return out.join("\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/audit-trail/csv.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/audit-trail/csv.ts __tests__/lib/audit-trail/csv.test.ts
git commit -m "feat(audit-trail): CSV serializer with quoting and warnings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Audit-trail API routes

**Files:**
- Create: `app/api/audit-trail/route.ts`
- Create: `app/api/audit-trail/export.csv/route.ts`

- [ ] **Step 1: Write `app/api/audit-trail/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import type { AuditSource } from "@/lib/audit-trail/types";

const VALID: AuditSource[] = ["action", "decision", "data_source", "document", "match_run"];

function parseSources(req: NextRequest): AuditSource[] | undefined {
  const params = req.nextUrl.searchParams.getAll("source");
  if (params.length === 0) return undefined;
  const filtered = params.filter((s): s is AuditSource => VALID.includes(s as AuditSource));
  return filtered.length === 0 ? undefined : filtered;
}

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 200, 1000) : 200;

  const result = await queryAuditTrail({
    userId: session.userId,
    sources: parseSources(request),
    from: parseDate(request.nextUrl.searchParams.get("from")),
    to: parseDate(request.nextUrl.searchParams.get("to")),
    limit,
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Write `app/api/audit-trail/export.csv/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { toCsv } from "@/lib/audit-trail/csv";
import type { AuditSource } from "@/lib/audit-trail/types";

const VALID: AuditSource[] = ["action", "decision", "data_source", "document", "match_run"];

function parseSources(req: NextRequest): AuditSource[] | undefined {
  const params = req.nextUrl.searchParams.getAll("source");
  if (params.length === 0) return undefined;
  const filtered = params.filter((s): s is AuditSource => VALID.includes(s as AuditSource));
  return filtered.length === 0 ? undefined : filtered;
}

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await queryAuditTrail({
    userId: session.userId,
    sources: parseSources(request),
    from: parseDate(request.nextUrl.searchParams.get("from")),
    to: parseDate(request.nextUrl.searchParams.get("to")),
    limit: 1000,
  });

  const warnings = Object.entries(result.errors).map(([s, m]) => `${s} failed: ${m}`);
  const csv = toCsv(result.rows, { warnings });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/audit-trail/
git commit -m "feat(api): /api/audit-trail JSON + CSV export

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Integration test — audit trail merge

**Files:**
- Create: `tests/integration/audit-trail-merge.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { deleteTestUser } from "./cleanup";

describe("audit trail five-source merge", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("returns one row per source when each is seeded; respects source filter", async () => {
    // 1) DataSource
    const ds = await prisma.dataSource.create({
      data: { userId, type: "ar", name: "ar.csv", status: "ready", recordCount: 5 },
    });
    // 2) Action + ActionEvent
    const action = await prisma.action.create({
      data: { userId, type: "ar_followup", severity: "medium", headline: "Late invoice",
              detail: "...", driver: "ar", status: "pending" },
    });
    await prisma.actionEvent.create({
      data: { actionId: action.id, userId, fromStatus: "pending", toStatus: "approved" },
    });
    // 3) Document
    await prisma.document.create({
      data: { userId, type: "ar_summary", title: "AR Summary", body: "..." },
    });
    // 4) MatchRun (completed)
    await prisma.matchRun.create({
      data: {
        userId, periodKey: "2026-04", triggeredBy: "test", strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 1, partial: 0, unmatched: 0,
        completedAt: new Date(),
      },
    });
    // 5) Decision + DecisionEvent
    const dec = await prisma.decision.create({
      data: { userId, type: "post_journal", headline: "h", status: "pending" },
    });
    await prisma.decisionEvent.create({
      data: { decisionId: dec.id, fromStatus: "pending", toStatus: "approved", actorId: userId },
    });

    const all = await queryAuditTrail({ userId });
    expect(all.errors).toEqual({});
    const sources = new Set(all.rows.map((r) => r.source));
    expect(sources).toEqual(new Set(["data_source", "action", "document", "match_run", "decision"]));

    const onlyDecisions = await queryAuditTrail({ userId, sources: ["decision"] });
    expect(onlyDecisions.rows.every((r) => r.source === "decision")).toBe(true);
    expect(onlyDecisions.rows).toHaveLength(1);

    // Order is timestamp descending
    const ts = all.rows.map((r) => r.timestamp);
    const sorted = [...ts].sort().reverse();
    expect(ts).toEqual(sorted);

    // The unused dataSource id is referenced via ds, suppressing TS unused-var warnings
    expect(ds.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/integration/audit-trail-merge.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/audit-trail-merge.test.ts
git commit -m "test(integration): audit-trail five-source merge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Integration test — audit trail CSV export

**Files:**
- Create: `tests/integration/audit-trail-export.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { toCsv } from "@/lib/audit-trail/csv";
import { deleteTestUser } from "./cleanup";

describe("audit trail CSV export", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("CSV contains expected header and one row per timeline entry", async () => {
    await prisma.dataSource.create({
      data: { userId, type: "ar", name: "ar.csv", status: "ready", recordCount: 5 },
    });
    await prisma.document.create({
      data: { userId, type: "ar_summary", title: "AR Summary, with comma", body: "..." },
    });

    const result = await queryAuditTrail({ userId });
    const csv = toCsv(result.rows);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("timestamp,source,actorId,summary,refType,refId");
    expect(lines).toHaveLength(1 + result.rows.length);

    // Title with comma must be quoted
    const docLine = lines.find((l) => l.includes("ar_summary"));
    expect(docLine).toContain('"');
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/integration/audit-trail-export.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/audit-trail-export.test.ts
git commit -m "test(integration): audit-trail CSV export

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Decision Inbox UI rewrite

**Files:**
- Modify: `app/(shell)/decision-inbox/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file content**

This is a full rewrite — the previous file imported `SAMPLE_DECISIONS` and rendered fake compliance checks. The new version is a server component that fetches from `listDecisions` and a client component for the action buttons.

Replace `app/(shell)/decision-inbox/page.tsx` entirely with:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listDecisions } from "@/lib/decisions/service";
import { DecisionInboxClient } from "./decision-inbox-client";

export const dynamic = "force-dynamic";

export default async function DecisionInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [pending, approved, rejected] = await Promise.all([
    listDecisions(session.userId, "pending"),
    listDecisions(session.userId, "approved"),
    listDecisions(session.userId, "rejected"),
  ]);

  return (
    <DecisionInboxClient
      pending={pending}
      approved={approved}
      rejected={rejected}
    />
  );
}
```

- [ ] **Step 2: Create the client component**

Create `app/(shell)/decision-inbox/decision-inbox-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";

type DecisionRow = {
  id: string;
  type: string;
  headline: string;
  detail: string | null;
  status: string;
  decidedBy: string | null;
  decidedAt: Date | string | null;
  reason: string | null;
  createdAt: Date | string;
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

type Props = {
  pending: DecisionRow[];
  approved: DecisionRow[];
  rejected: DecisionRow[];
};

type Tab = "pending" | "approved" | "rejected";

export function DecisionInboxClient({ pending, approved, rejected }: Props) {
  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<DecisionRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const list = tab === "pending" ? pending : tab === "approved" ? approved : rejected;

  async function decide(id: string, outcome: "approve" | "reject" | "needs_info") {
    const res = await fetch(`/api/decisions/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, reason: reason.trim() || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Failed to record decision");
      return;
    }
    setSelected(null);
    setReason("");
    startTransition(() => router.refresh());
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setReason(""); }}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} /> Back to inbox
        </button>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{selected.headline}</h1>
          {selected.detail && <p className="text-sm text-muted-foreground">{selected.detail}</p>}
          <p className="text-xs text-muted-foreground">
            Filed {new Date(selected.createdAt).toLocaleString()} · status: {selected.status}
          </p>
        </div>

        {selected.proposal && (
          <div className="border border-border rounded-lg p-6 bg-card space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Journal Adjustment
            </h2>
            <p className="text-sm">{selected.proposal.description}</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">DR</div>
                <div className="font-mono">{selected.proposal.debitAccount}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">CR</div>
                <div className="font-mono">{selected.proposal.creditAccount}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">Amount</div>
                <div className="font-semibold">{selected.proposal.amount.toFixed(2)} {selected.proposal.currency}</div>
              </div>
            </div>
            {selected.proposal.break && (
              <p className="text-xs text-muted-foreground">
                From break {selected.proposal.break.id} ({selected.proposal.break.side})
                {selected.proposal.break.periodKey ? ` · period ${selected.proposal.break.periodKey}` : ""}
              </p>
            )}
          </div>
        )}

        {selected.status === "pending" || selected.status === "needs_info" ? (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional for approve/needs-info, recommended for reject)"
              className="w-full px-3 py-2 bg-card border border-border rounded text-sm min-h-[80px]"
            />
            <div className="flex gap-3">
              <button
                disabled={busy}
                onClick={() => decide(selected.id, "approve")}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={busy}
                onClick={() => decide(selected.id, "reject")}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium text-sm disabled:opacity-50"
              >
                Reject
              </button>
              <button
                disabled={busy}
                onClick={() => decide(selected.id, "needs_info")}
                className="px-4 py-2 rounded-lg border border-border font-medium text-sm disabled:opacity-50"
              >
                Needs Info
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Decided by {selected.decidedBy ?? "—"} at {selected.decidedAt ? new Date(selected.decidedAt).toLocaleString() : "—"}.
            {selected.reason && <p className="mt-1">Reason: {selected.reason}</p>}
          </div>
        )}
      </div>
    );
  }

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
          Permission requests waiting on your approval
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard value={pending.length} label="Pending" />
        <MetricCard value={approved.length} label="Approved" />
        <MetricCard value={rejected.length} label="Rejected" />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-8">
          {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} ({t === "pending" ? pending.length : t === "approved" ? approved.length : rejected.length})
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {tab === "pending"
            ? "No decisions waiting. The agent will queue one here when it proposes a reconciliation adjustment that needs your approval."
            : `No ${tab} decisions yet.`}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="w-full text-left border border-border rounded-lg p-4 bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-1">{d.headline}</h3>
                  {d.detail && <p className="text-xs text-muted-foreground mb-2">{d.detail}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()} · {d.type}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify dev server boots**

Run (in a separate terminal):
```bash
npm run dev
```
Then navigate to `/decision-inbox`. Expected: page renders empty-state ("No decisions waiting…") if no `Decision` rows seeded. No errors in browser console or terminal.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/\(shell\)/decision-inbox/
git commit -m "feat(decision-inbox): real Decision rows + working approve/reject

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Audit Trail UI rewrite

**Files:**
- Modify: `app/(shell)/audit-trail/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file content**

Replace `app/(shell)/audit-trail/page.tsx` entirely with:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { AuditTrailClient } from "./audit-trail-client";

export const dynamic = "force-dynamic";

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[]; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const sourcesParam = Array.isArray(sp.source) ? sp.source : sp.source ? [sp.source] : [];
  const valid = ["action", "decision", "data_source", "document", "match_run"] as const;
  const sources = sourcesParam.filter((s): s is typeof valid[number] => (valid as readonly string[]).includes(s));

  const result = await queryAuditTrail({
    userId: session.userId,
    sources: sources.length > 0 ? sources : undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    limit: 200,
  });

  return (
    <AuditTrailClient
      rows={result.rows}
      errors={result.errors}
      activeSources={sources}
      activeFrom={sp.from ?? ""}
      activeTo={sp.to ?? ""}
    />
  );
}
```

- [ ] **Step 2: Create the client component**

Create `app/(shell)/audit-trail/audit-trail-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bot, FileText, Upload, FileSignature, GitMerge } from "lucide-react";
import type { AuditTimelineRow, AuditSource } from "@/lib/audit-trail/types";

type Props = {
  rows: AuditTimelineRow[];
  errors: Partial<Record<AuditSource, string>>;
  activeSources: AuditSource[];
  activeFrom: string;
  activeTo: string;
};

const ICONS: Record<AuditSource, React.ComponentType<{ size?: number; className?: string }>> = {
  action: Bot,
  decision: FileSignature,
  data_source: Upload,
  document: FileText,
  match_run: GitMerge,
};

const SOURCE_LABELS: Record<AuditSource, string> = {
  action: "Action events",
  decision: "Decisions",
  data_source: "Uploads",
  document: "Documents",
  match_run: "Match runs",
};

export function AuditTrailClient({ rows, errors, activeSources, activeFrom, activeTo }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setQuery(updates: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      next.delete(k);
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((vv) => next.append(k, vv));
      else if (v !== "") next.set(k, v);
    }
    router.push(`/audit-trail?${next.toString()}`);
  }

  function toggleSource(source: AuditSource) {
    const has = activeSources.includes(source);
    const next = has ? activeSources.filter((s) => s !== source) : [...activeSources, source];
    setQuery({ source: next });
  }

  const exportHref = (() => {
    const next = new URLSearchParams();
    activeSources.forEach((s) => next.append("source", s));
    if (activeFrom) next.set("from", activeFrom);
    if (activeTo) next.set("to", activeTo);
    return `/api/audit-trail/export.csv?${next.toString()}`;
  })();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
          Audit Trail
        </h1>
        <p className="text-sm text-muted-foreground">
          Every state change recorded across the system
        </p>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded p-3 text-xs">
          Some sources failed to load: {Object.entries(errors).map(([s, m]) => `${s}: ${m}`).join("; ")}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SOURCE_LABELS) as AuditSource[]).map((s) => {
            const active = activeSources.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            );
          })}
          <input
            type="date"
            value={activeFrom}
            onChange={(e) => setQuery({ from: e.target.value || null })}
            className="px-3 py-1.5 bg-card border border-border rounded text-xs"
          />
          <input
            type="date"
            value={activeTo}
            onChange={(e) => setQuery({ to: e.target.value || null })}
            className="px-3 py-1.5 bg-card border border-border rounded text-xs"
          />
        </div>
        <a
          href={exportHref}
          className="px-4 py-2 bg-card border border-border rounded text-sm font-medium hover:bg-accent"
        >
          Export CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No audit events match the current filters.
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-6">
            {rows.map((row) => {
              const Icon = ICONS[row.source];
              return (
                <div key={row.id} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border">
                      <Icon size={18} className="text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 bg-card border border-border rounded-[var(--radius)] p-4 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-foreground">{row.actorId ?? "system"}</p>
                      <p className="text-xs text-muted-foreground text-right">
                        {new Date(row.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-foreground">{row.summary}</p>
                    <div className="pt-2 flex gap-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {SOURCE_LABELS[row.source]}
                      </span>
                      {row.refType && row.refId && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium font-mono text-muted-foreground">
                          {row.refType}:{row.refId.slice(-8)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify dev server boots and the page renders real data**

Run `npm run dev`. Navigate to `/audit-trail`. Expected: real timeline (or empty-state if no rows). Toggle a source pill — the URL updates and the list filters. Click "Export CSV" — file downloads and contains the rows.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/\(shell\)/audit-trail/
git commit -m "feat(audit-trail): real five-source timeline + filters + CSV export

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Remove the now-unused SAMPLE_DECISIONS

**Files:**
- Modify: `lib/config/sample-observe-data.ts`

- [ ] **Step 1: Check whether `DecisionItem` or `SAMPLE_DECISIONS` is referenced anywhere else**

Run: `npx grep -r "SAMPLE_DECISIONS\|DecisionItem" --include="*.ts" --include="*.tsx"` (or use the Grep tool with pattern `SAMPLE_DECISIONS|DecisionItem`).
Expected: zero matches outside `lib/config/sample-observe-data.ts` itself (the Decision Inbox rewrite removed its import in Task 16).

If anything still references them, the rewrite was incomplete — go back and fix it before continuing.

- [ ] **Step 2: Delete the symbols**

Open `lib/config/sample-observe-data.ts` and delete:
- The `DecisionVerdict`, `DecisionPriority`, `DecisionStatus` type aliases
- The `ComplianceCheck` interface
- The `DecisionItem` interface
- The `SAMPLE_DECISIONS` array

If the file becomes empty, leave a single-line comment marking it intentional rather than deleting the file (other sample data lives here per the README).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS. This is the integration checkpoint for the whole feature.

- [ ] **Step 5: Commit**

```bash
git add lib/config/sample-observe-data.ts
git commit -m "chore(sample): drop SAMPLE_DECISIONS — superseded by real Decision rows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Manual smoke test against the dev branch

**Files:**
- None (manual verification)

- [ ] **Step 1: Start dev server and exercise the flow end-to-end**

```bash
npm run dev
```

In a browser:

1. Log in at `/login`.
2. Visit `/decision-inbox` — empty state shows.
3. Open the agent console at `/agent-console`. Ask it to "find a sample reconciliation break and propose an adjustment for it" (you may need to upload sample GL/sub-ledger CSVs first per the README's Sample Data section).
4. Once the agent calls `propose_adjustment`, return to `/decision-inbox`. The new decision should appear in the Pending tab.
5. Click the row → click Approve → enter a reason → confirm.
6. Visit `/audit-trail`. The decision approval and the resulting journal posting should be visible. Toggle source pills to verify filtering. Click Export CSV.

- [ ] **Step 2: Confirm `<SampleDataBadge />` is gone**

Inspect the rendered DOM on `/decision-inbox` and `/audit-trail` — no `Sample data` badge. Visit `/agent-runs` and `/compliance` — badges still present (correct, those stay sample).

- [ ] **Step 3: Final commit (if anything was tweaked during smoke)**

If anything had to be patched, commit it with a brief message and re-run `npx vitest run`.

---

## Self-review (filled in after writing)

**Spec coverage check (each spec section):**

- *Goals 1 (Decision Inbox real)* — Tasks 1, 3, 7, 16. ✓
- *Goals 2 (Audit Trail real)* — Tasks 10, 11, 13, 17. ✓
- *Goals 3 (JournalAdjustment audit)* — Tasks 1 (schema), 3 (writes), 8 (verifies). ✓
- *Goals 4 (sample badges on Agent Runs + Compliance)* — Already in code; spec confirmed; no task needed. Tasks 16, 17 remove the badges from Decision Inbox + Audit Trail. ✓
- *Decision/DecisionEvent models* — Task 1. ✓
- *AdjustmentProposal.reason column* — Task 1. ✓
- *Atomic creation flow* — Task 5. ✓
- *Approval transaction (writes audit, updates Decision, Break, Proposal)* — Task 3 service, Task 6 agent-tool delegation. ✓
- *API routes (5 total)* — Tasks 7 (decisions ×3), 13 (audit-trail ×2). ✓
- *Five-source timeline* — Tasks 10 (normalizers), 11 (query). ✓
- *CSV export* — Task 12. ✓
- *Per-source error isolation* — Task 11 implementation; Task 17 UI banner. ✓
- *Tests: unit transitions, normalize, csv* — Tasks 2, 10, 12. ✓
- *Tests: integration propose-and-approve, reject, merge, export* — Tasks 8, 9, 14, 15. ✓
- *Cleanup helper update* — Task 4. ✓
- *Migration* — Task 1. ✓

**Placeholder scan:** None. Every code step shows the full code; every command has expected output.

**Type consistency check:**
- `DecisionStatus` defined in `lib/decisions/transitions.ts` (Task 2), used in `service.ts` (Task 3), API routes (Task 7) ✓
- `DecisionOutcome` defined Task 2, used Task 3 service, Task 7 routes, Task 6 agent ✓
- `AuditSource` defined Task 10, used Tasks 11, 13, 17 ✓
- `AuditTimelineRow` defined Task 10, used Tasks 11, 12, 17 ✓
- `decideOnProposal` signature: `(args: DecideArgs) → Promise<DecideResult>` consistent across Tasks 3, 6, 7 ✓
- `legalTransition(current, outcome)` signature consistent Tasks 2, 3 ✓
- `queryAuditTrail(args)` returns `{ rows, errors }` consistent Tasks 11, 13, 17 ✓
- `toCsv(rows, opts)` signature consistent Tasks 12, 13 ✓
- `listDecisions(userId, status?, limit?)` consistent Tasks 3, 7 ✓
- All Prisma column names match the schema in Task 1 ✓
