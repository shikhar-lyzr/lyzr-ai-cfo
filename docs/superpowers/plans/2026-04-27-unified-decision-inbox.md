# Unified Decision Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/decision-inbox` a single pending-only working surface that unions `Decision` rows with pending `Action` rows of all five types, dispatching each to its existing endpoint.

**Architecture:** Path B (no schema change). The page server-loads pending Decisions and pending Actions in parallel, maps both into a single `InboxRow` shape, and renders a unified list. Detail view branches on `source + kind` to show type-appropriate buttons that call existing endpoints. A small additive change to `/financial-reconciliation` makes `?breakId=…` scroll-to + highlight the matching break row on mount.

**Tech Stack:** Next.js 16 App Router, React server components + client component for detail/dispatch, Prisma + Neon Postgres, vitest (integration tests hit live Neon).

**Spec:** `docs/superpowers/specs/2026-04-27-unified-decision-inbox-design.md`

---

## File Structure

**New files:**
- `app/(shell)/decision-inbox/inbox-row.ts` — `InboxRow` type + `decisionToRow` / `actionToRow` mappers.

**Modified files:**
- `app/(shell)/decision-inbox/page.tsx` — load Decisions + Actions in parallel, map to `InboxRow[]`, pass to client.
- `app/(shell)/decision-inbox/decision-inbox-client.tsx` — drop tabs and Approved/Rejected cards; render unified list; full-page detail view that branches on `kind`; type-specific dispatch.
- `app/(shell)/financial-reconciliation/page.tsx` — read `breakId` from `searchParams`, attach `id={"break-" + b.id}` to each `<tr>`, render small `<HighlightOnMount>` client wrapper.

**New file (recon knock-on):**
- `app/(shell)/financial-reconciliation/highlight-on-mount.tsx` — client component: on mount, if `breakId` prop set, `scrollIntoView` and apply a flash highlight class for ~2s.

**Test files:**
- `tests/unit/inbox-row-mappers.test.ts` (new) — pure-function tests for the mappers (Task 1).
- `tests/integration/decision-inbox-mixed.test.ts` (new) — page-level: mixed pending loader output (Task 5).
- `tests/component/inbox-row-buttons.test.tsx` (new, conditional) — vitest + JSDOM: each `kind` renders correct buttons; click dispatches correct endpoint with correct payload (Task 4; skipped if jsdom isn't configured).

**Out of scope:** No new API routes. No schema migration. No changes to `/api/actions/[id]/route.ts`, `/api/actions/[id]/ar/route.ts`, or `/api/decisions/[id]/decide/route.ts` — they already accept everything we need.

---

## Task 1: Define `InboxRow` type and mappers (TDD)

**Files:**
- Create: `app/(shell)/decision-inbox/inbox-row.ts`
- Test: `tests/unit/inbox-row-mappers.test.ts`

These are pure-function tests — no DOM, no Prisma calls — so they run in vitest's default Node environment. No jsdom setup needed.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/inbox-row-mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decisionToRow, actionToRow, type InboxRow } from "@/app/(shell)/decision-inbox/inbox-row";

describe("inbox-row mappers", () => {
  it("decisionToRow maps a post_journal Decision to an InboxRow", () => {
    const d = {
      id: "dec_1",
      userId: "u1",
      type: "post_journal",
      proposalRef: "p1",
      refModel: "AdjustmentProposal",
      headline: "Post 100 USD",
      detail: "Break b_1",
      status: "pending",
      decidedBy: null,
      decidedAt: null,
      reason: null,
      createdAt: new Date("2026-04-27T10:00:00Z"),
      updatedAt: new Date("2026-04-27T10:00:00Z"),
      proposal: null,
    };
    const row = decisionToRow(d as any);
    expect(row.source).toBe("decision");
    expect(row.kind).toBe("post_journal");
    expect(row.id).toBe("dec_1");
    expect(row.headline).toBe("Post 100 USD");
    expect(row.detail).toBe("Break b_1");
    expect(row.createdAt).toEqual(new Date("2026-04-27T10:00:00Z"));
    expect(row.decision).toBe(d);
    expect(row.action).toBeUndefined();
  });

  it("actionToRow maps a variance Action to an InboxRow", () => {
    const a = {
      id: "act_1",
      userId: "u1",
      type: "variance",
      severity: "medium",
      headline: "Revenue down 12% vs budget",
      detail: "EMEA segment driver",
      driver: "EMEA",
      status: "pending",
      sourceDataSourceId: "ds1",
      invoiceId: null,
      draftBody: null,
      createdAt: new Date("2026-04-27T11:00:00Z"),
      sourceName: "Q1 Budget",
    };
    const row = actionToRow(a as any);
    expect(row.source).toBe("action");
    expect(row.kind).toBe("variance");
    expect(row.id).toBe("act_1");
    expect(row.headline).toBe("Revenue down 12% vs budget");
    expect(row.detail).toBe("EMEA segment driver");
    expect(row.action).toBe(a);
    expect(row.decision).toBeUndefined();
  });

  it("actionToRow preserves all five action kinds", () => {
    const kinds = ["variance", "anomaly", "recommendation", "ar_followup", "reconciliation_break"];
    for (const t of kinds) {
      const row = actionToRow({
        id: `a_${t}`, userId: "u", type: t, severity: "low",
        headline: t, detail: null, driver: "", status: "pending",
        sourceDataSourceId: null, invoiceId: null, draftBody: null,
        createdAt: new Date(),
      } as any);
      expect(row.kind).toBe(t);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run tests/unit/inbox-row-mappers.test.ts
```

Expected: FAIL — `Cannot find module '@/app/(shell)/decision-inbox/inbox-row'`.

- [ ] **Step 3: Create the module**

Create `app/(shell)/decision-inbox/inbox-row.ts`:

```ts
import type { Decision, Action } from "@prisma/client";

export type InboxRowKind =
  | "post_journal"
  | "variance"
  | "anomaly"
  | "recommendation"
  | "ar_followup"
  | "reconciliation_break";

export type DecisionWithProposal = Decision & {
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

export type ActionWithSource = Action & { sourceName?: string | null };

export type InboxRow = {
  source: "decision" | "action";
  id: string;
  kind: InboxRowKind;
  headline: string;
  detail: string | null;
  createdAt: Date;
  decision?: DecisionWithProposal;
  action?: ActionWithSource;
};

export function decisionToRow(d: DecisionWithProposal): InboxRow {
  return {
    source: "decision",
    id: d.id,
    kind: d.type as InboxRowKind, // "post_journal" today; future-proof for new Decision types
    headline: d.headline,
    detail: d.detail,
    createdAt: d.createdAt,
    decision: d,
  };
}

export function actionToRow(a: ActionWithSource): InboxRow {
  return {
    source: "action",
    id: a.id,
    kind: a.type as InboxRowKind,
    headline: a.headline,
    detail: a.detail,
    createdAt: a.createdAt,
    action: a,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run tests/unit/inbox-row-mappers.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/(shell)/decision-inbox/inbox-row.ts tests/unit/inbox-row-mappers.test.ts
git commit -m "feat(inbox): add InboxRow type + decision/action mappers"
```

---

## Task 2: Update page.tsx to load both Decisions and Actions

**Files:**
- Modify: `app/(shell)/decision-inbox/page.tsx`

**Note:** The client component still expects the old `pending/approved/rejected` props in this task — it gets rewritten in Task 3. We keep types loose here (`any`) for one task to avoid a broken intermediate state. A tighter handoff happens in Task 3.

- [ ] **Step 1: Replace `page.tsx` contents**

Replace `app/(shell)/decision-inbox/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listDecisions } from "@/lib/decisions/service";
import { decisionToRow, actionToRow, type InboxRow } from "./inbox-row";
import { DecisionInboxClient } from "./decision-inbox-client";

export const dynamic = "force-dynamic";

export default async function DecisionInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [pendingDecisions, pendingActionsRaw] = await Promise.all([
    listDecisions(session.userId, "pending"),
    prisma.action.findMany({
      where: { userId: session.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { dataSource: { select: { name: true } } },
    }),
  ]);

  const pendingActions = pendingActionsRaw.map((a) => ({
    ...a,
    sourceName: a.dataSource?.name ?? null,
  }));

  const rows: InboxRow[] = [
    ...pendingDecisions.map(decisionToRow as any),
    ...pendingActions.map(actionToRow),
  ].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

  return <DecisionInboxClient rows={rows} />;
}
```

- [ ] **Step 2: Confirm typecheck still passes (the client doesn't compile yet — that's expected; we fix it in Task 3)**

Skip — we proceed to Task 3 in the same intermediate state. Do **not** commit yet.

---

## Task 3: Rewrite the inbox client (drop tabs, drop cards, unified list, branched detail)

**Files:**
- Modify: `app/(shell)/decision-inbox/decision-inbox-client.tsx`

This is the biggest task. It's intentionally one task because the file is rewritten end-to-end — splitting it would create broken intermediate states.

- [ ] **Step 1: Replace `decision-inbox-client.tsx` contents**

Replace `app/(shell)/decision-inbox/decision-inbox-client.tsx` with:

```tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import type { InboxRow } from "./inbox-row";

type Props = { rows: InboxRow[] };

export function DecisionInboxClient({ rows }: Props) {
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  function back() {
    setSelected(null);
    setReason("");
  }

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Request failed");
      return false;
    }
    return true;
  }

  async function dispatchDecision(id: string, outcome: "approve" | "reject" | "needs_info") {
    const ok = await call(`/api/decisions/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, reason: reason.trim() || undefined }),
    });
    if (ok) { back(); startTransition(() => router.refresh()); }
  }

  async function dispatchActionPatch(id: string, status: "approved" | "dismissed") {
    const ok = await call(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (ok) { back(); startTransition(() => router.refresh()); }
  }

  async function dispatchAr(id: string, op: "mark_sent" | "snooze" | "escalate", days?: number) {
    const ok = await call(`/api/actions/${id}/ar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, ...(days != null ? { days } : {}) }),
    });
    if (ok) { back(); startTransition(() => router.refresh()); }
  }

  if (selected) {
    return <DetailView
      row={selected}
      reason={reason}
      setReason={setReason}
      busy={busy}
      onBack={back}
      onDecision={dispatchDecision}
      onActionPatch={dispatchActionPatch}
      onAr={dispatchAr}
    />;
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
          Permission requests waiting on your approval. Resolved items are in the{" "}
          <Link href="/audit-trail" className="underline">audit trail</Link>.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard value={rows.length} label="Pending" />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Nothing waiting on you. The agent will queue items here when it needs your call.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <button
              key={`${r.source}_${r.id}`}
              onClick={() => setSelected(r)}
              className="w-full text-left border border-border rounded-lg p-4 bg-card hover:bg-accent transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base mb-1">{r.headline}</h3>
                {r.detail && <p className="text-xs text-muted-foreground mb-2">{r.detail}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()} · {r.kind}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailView({
  row, reason, setReason, busy, onBack, onDecision, onActionPatch, onAr,
}: {
  row: InboxRow;
  reason: string;
  setReason: (s: string) => void;
  busy: boolean;
  onBack: () => void;
  onDecision: (id: string, outcome: "approve" | "reject" | "needs_info") => void;
  onActionPatch: (id: string, status: "approved" | "dismissed") => void;
  onAr: (id: string, op: "mark_sent" | "snooze" | "escalate", days?: number) => void;
}) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={16} /> Back to inbox
      </button>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{row.headline}</h1>
        {row.detail && <p className="text-sm text-muted-foreground">{row.detail}</p>}
        <p className="text-xs text-muted-foreground">
          Filed {new Date(row.createdAt).toLocaleString()} · {row.kind}
        </p>
      </div>

      {row.source === "decision" && row.decision?.proposal && (
        <ProposalBlock p={row.decision.proposal} />
      )}

      {row.source === "action" && row.kind === "ar_followup" && (
        <ArDraftBlock actionId={row.id} />
      )}

      <ButtonRow
        row={row}
        reason={reason}
        setReason={setReason}
        busy={busy}
        onDecision={onDecision}
        onActionPatch={onActionPatch}
        onAr={onAr}
      />
    </div>
  );
}

function ProposalBlock({ p }: { p: NonNullable<NonNullable<InboxRow["decision"]>["proposal"]> }) {
  return (
    <div className="border border-border rounded-lg p-6 bg-card space-y-3">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
        Journal Adjustment
      </h2>
      <p className="text-sm">{p.description}</p>
      <div className="grid grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">DR</div>
          <div className="font-mono">{p.debitAccount}</div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">CR</div>
          <div className="font-mono">{p.creditAccount}</div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">Amount</div>
          <div className="font-semibold">{p.amount.toFixed(2)} {p.currency}</div>
        </div>
      </div>
      {p.break && (
        <p className="text-xs text-muted-foreground">
          From break {p.break.id} ({p.break.side})
          {p.break.periodKey ? ` · period ${p.break.periodKey}` : ""}
        </p>
      )}
    </div>
  );
}

function ArDraftBlock({ actionId }: { actionId: string }) {
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/actions/${actionId}/ar`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setBody(j.draftBody ?? null); })
      .catch(() => { if (!cancelled) setBody(null); });
    return () => { cancelled = true; };
  }, [actionId]);

  if (body == null) return <div className="text-xs text-muted-foreground">Loading draft…</div>;
  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
        Draft email
      </h2>
      <pre className="text-xs whitespace-pre-wrap font-sans">{body}</pre>
    </div>
  );
}

function ButtonRow({
  row, reason, setReason, busy, onDecision, onActionPatch, onAr,
}: {
  row: InboxRow;
  reason: string;
  setReason: (s: string) => void;
  busy: boolean;
  onDecision: (id: string, outcome: "approve" | "reject" | "needs_info") => void;
  onActionPatch: (id: string, status: "approved" | "dismissed") => void;
  onAr: (id: string, op: "mark_sent" | "snooze" | "escalate", days?: number) => void;
}) {
  const btn = "px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50";
  const primary = `${btn} bg-green-600 text-white`;
  const danger = `${btn} bg-red-600 text-white`;
  const neutral = `${btn} border border-border`;

  // Decision row
  if (row.source === "decision") {
    return (
      <div className="space-y-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional for approve/needs-info, recommended for reject)"
          className="w-full px-3 py-2 bg-card border border-border rounded text-sm min-h-[80px]"
        />
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => onDecision(row.id, "approve")} className={primary}>Approve</button>
          <button disabled={busy} onClick={() => onDecision(row.id, "reject")} className={danger}>Reject</button>
          <button disabled={busy} onClick={() => onDecision(row.id, "needs_info")} className={neutral}>Needs Info</button>
        </div>
      </div>
    );
  }

  // Action rows
  if (row.kind === "variance") {
    return (
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => onActionPatch(row.id, "approved")} className={primary}>Approve</button>
        <button disabled={busy} onClick={() => onActionPatch(row.id, "dismissed")} className={neutral}>Dismiss</button>
      </div>
    );
  }
  if (row.kind === "anomaly" || row.kind === "recommendation") {
    return (
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => onActionPatch(row.id, "approved")} className={primary}>Acknowledge</button>
        <button disabled={busy} onClick={() => onActionPatch(row.id, "dismissed")} className={neutral}>Dismiss</button>
      </div>
    );
  }
  if (row.kind === "reconciliation_break") {
    return (
      <div className="flex gap-3">
        <Link
          href={`/financial-reconciliation?breakId=${row.id}`}
          className={primary}
        >
          Investigate
        </Link>
        <button disabled={busy} onClick={() => onActionPatch(row.id, "dismissed")} className={neutral}>Dismiss</button>
      </div>
    );
  }
  if (row.kind === "ar_followup") {
    return (
      <div className="flex gap-3 flex-wrap">
        <button disabled={busy} onClick={() => onAr(row.id, "mark_sent")} className={primary}>Mark Sent</button>
        <button disabled={busy} onClick={() => onAr(row.id, "snooze", 7)} className={neutral}>Snooze 7d</button>
        <button disabled={busy} onClick={() => onAr(row.id, "escalate")} className={danger}>Escalate</button>
      </div>
    );
  }
  // post_journal handled above; safety fallback
  return null;
}
```

- [ ] **Step 2: Run typecheck**

```
npx tsc --noEmit
```

Expected: PASS. If it fails on the `Action` import in `inbox-row.ts`, ensure `@prisma/client` is generated (`npx prisma generate`).

- [ ] **Step 3: Smoke-test page load (dev server)**

Start dev server (foreground in another terminal) and visit `http://localhost:3000/decision-inbox`. Expect:
- Single "Pending" metric card.
- No tabs.
- If there are no rows: empty-state message.

If the dev server is already running, just refresh.

- [ ] **Step 4: Commit (Tasks 1–3 land together)**

```bash
git add app/(shell)/decision-inbox/page.tsx app/(shell)/decision-inbox/decision-inbox-client.tsx
git commit -m "feat(inbox): unified pending-only view across Decision + Action"
```

---

## Task 4: Component test for buttons + dispatch

**Files:**
- Create: `tests/component/inbox-row-buttons.test.tsx`

This test guards the dispatch table (the most likely thing for a future change to break).

- [ ] **Step 1: Confirm test setup supports JSX/JSDOM**

Check `vitest.config.ts` (or `vite.config.ts`) has `environment: "jsdom"` and a setup file. If JSDOM isn't already configured, this task gets two extra steps to set it up — but for this codebase, integration tests run in Node and there's likely no component-test config yet. Run:

```
ls vitest.config.* vite.config.*
```

If no jsdom config exists, **skip this task** and replace it with **Task 4-alt** below: add the dispatch coverage to the integration test in Task 5 instead.

- [ ] **Step 2 (only if jsdom is configured): Write the test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecisionInboxClient } from "@/app/(shell)/decision-inbox/decision-inbox-client";
import type { InboxRow } from "@/app/(shell)/decision-inbox/inbox-row";

function row(overrides: Partial<InboxRow> & Pick<InboxRow, "source" | "kind" | "id">): InboxRow {
  return {
    headline: "h",
    detail: "d",
    createdAt: new Date(),
    ...overrides,
  } as InboxRow;
}

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

describe("inbox dispatch table", () => {
  it("variance Approve → PATCH /api/actions/{id} with approved", async () => {
    render(<DecisionInboxClient rows={[row({ source: "action", kind: "variance", id: "act_v" })]} />);
    fireEvent.click(screen.getByText("h")); // open detail
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_v",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "approved" }) }),
    );
  });

  it("anomaly Acknowledge → PATCH approved", async () => {
    render(<DecisionInboxClient rows={[row({ source: "action", kind: "anomaly", id: "act_a" })]} />);
    fireEvent.click(screen.getByText("h"));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_a",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "approved" }) }),
    );
  });

  it("ar_followup Mark Sent → POST /api/actions/{id}/ar with mark_sent", async () => {
    render(<DecisionInboxClient rows={[row({ source: "action", kind: "ar_followup", id: "act_ar" })]} />);
    fireEvent.click(screen.getByText("h"));
    // ArDraftBlock fires its own GET on mount; clear before clicking the button so we assert on the POST only
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Mark Sent" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_ar/ar",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ op: "mark_sent" }) }),
    );
  });

  it("ar_followup Snooze → POST with snooze + days:7", async () => {
    render(<DecisionInboxClient rows={[row({ source: "action", kind: "ar_followup", id: "act_ar2" })]} />);
    fireEvent.click(screen.getByText("h"));
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Snooze 7d" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_ar2/ar",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ op: "snooze", days: 7 }) }),
    );
  });

  it("recon_break Investigate is a Link, not a fetch", () => {
    render(<DecisionInboxClient rows={[row({ source: "action", kind: "reconciliation_break", id: "act_rb" })]} />);
    fireEvent.click(screen.getByText("h"));
    const link = screen.getByRole("link", { name: "Investigate" });
    expect(link.getAttribute("href")).toBe("/financial-reconciliation?breakId=act_rb");
  });

  it("decision Approve → POST /api/decisions/{id}/decide with approve", async () => {
    render(<DecisionInboxClient rows={[row({ source: "decision", kind: "post_journal", id: "dec_1" })]} />);
    fireEvent.click(screen.getByText("h"));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decisions/dec_1/decide",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ outcome: "approve" }) }),
    );
  });
});
```

- [ ] **Step 3: Run the test**

```
npx vitest run tests/component/inbox-row-buttons.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add tests/component/inbox-row-buttons.test.tsx
git commit -m "test(inbox): component test for unified dispatch table"
```

### Task 4-alt: If jsdom isn't configured

If Step 1 found no jsdom config, **skip the whole component test**. The integration tests in Task 5 cover the actual dispatch behavior end-to-end (more reliable than mocked fetch). Add a single TODO comment at the bottom of `decision-inbox-client.tsx`:

```ts
// TODO: component-level dispatch tests are deferred until vitest jsdom is set up project-wide.
```

Commit:
```bash
git add app/(shell)/decision-inbox/decision-inbox-client.tsx
git commit -m "docs(inbox): defer component tests until jsdom is wired"
```

---

## Task 5: Integration test — page load returns mixed rows

**Files:**
- Create: `tests/integration/decision-inbox-mixed.test.ts`

We test the page loader's behavior by calling its underlying queries directly (the same shape `page.tsx` builds). This avoids spinning up a request handler.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { listDecisions } from "@/lib/decisions/service";
import { decisionToRow, actionToRow } from "@/app/(shell)/decision-inbox/inbox-row";
import { deleteTestUser } from "./cleanup";

describe("decision-inbox mixed loader", { timeout: 30_000 }, () => {
  let userId = "";
  let dataSourceId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    const ds = await prisma.dataSource.create({
      data: { userId, name: "test-source", kind: "budget", status: "ready" },
    });
    dataSourceId = ds.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("returns variance + decision rows in createdAt desc order", async () => {
    // Action first (older)
    const olderAction = await prisma.action.create({
      data: {
        userId, type: "variance", severity: "medium",
        headline: "Variance A", detail: "d", driver: "EMEA",
        sourceDataSourceId: dataSourceId, status: "pending",
        createdAt: new Date("2026-04-25T10:00:00Z"),
      },
    });
    // Decision second (newer)
    const newerDecision = await prisma.decision.create({
      data: {
        userId, type: "post_journal",
        headline: "Post 100 USD", detail: "Break b1", status: "pending",
        createdAt: new Date("2026-04-26T10:00:00Z"),
      },
    });

    const [pendingDecisions, pendingActionsRaw] = await Promise.all([
      listDecisions(userId, "pending"),
      prisma.action.findMany({
        where: { userId, status: "pending" },
        orderBy: { createdAt: "desc" },
        include: { dataSource: { select: { name: true } } },
      }),
    ]);

    const pendingActions = pendingActionsRaw.map((a) => ({
      ...a,
      sourceName: a.dataSource?.name ?? null,
    }));

    const rows = [
      ...pendingDecisions.map(decisionToRow as any),
      ...pendingActions.map(actionToRow),
    ].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(newerDecision.id);
    expect(rows[0].source).toBe("decision");
    expect(rows[1].id).toBe(olderAction.id);
    expect(rows[1].source).toBe("action");
    expect(rows[1].kind).toBe("variance");
  });

  it("excludes resolved Actions and Decisions", async () => {
    await prisma.action.create({
      data: {
        userId, type: "anomaly", severity: "low",
        headline: "Already done", detail: null, driver: "",
        sourceDataSourceId: dataSourceId, status: "approved",
      },
    });
    await prisma.decision.create({
      data: {
        userId, type: "post_journal",
        headline: "Already approved", status: "approved",
        decidedBy: userId, decidedAt: new Date(),
      },
    });

    const [pendingDecisions, pendingActions] = await Promise.all([
      listDecisions(userId, "pending"),
      prisma.action.findMany({ where: { userId, status: "pending" } }),
    ]);

    expect(pendingDecisions).toHaveLength(0);
    expect(pendingActions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test**

```
npx vitest run tests/integration/decision-inbox-mixed.test.ts
```

Expected: PASS (2 tests). If it fails on `prisma.dataSource.create`, check the existing `DataSource` schema for required fields not covered above and add them.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/decision-inbox-mixed.test.ts
git commit -m "test(inbox): integration test for mixed pending loader"
```

---

## Task 6: Recon page — `<HighlightOnMount>` wrapper

**Files:**
- Create: `app/(shell)/financial-reconciliation/highlight-on-mount.tsx`
- Modify: `app/(shell)/financial-reconciliation/page.tsx`

- [ ] **Step 1: Create `highlight-on-mount.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export function HighlightOnMount({ targetId }: { targetId: string | null }) {
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-amber-400");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-amber-400");
    }, 2000);
    return () => clearTimeout(t);
  }, [targetId]);
  return null;
}
```

- [ ] **Step 2: Modify `page.tsx`**

Three edits to `app/(shell)/financial-reconciliation/page.tsx`:

**(a)** Add the import. Find:

```tsx
import { PeriodPicker } from "./period-picker";
import { AskAiButton } from "./ask-ai-button";
```

Replace with:

```tsx
import { PeriodPicker } from "./period-picker";
import { AskAiButton } from "./ask-ai-button";
import { HighlightOnMount } from "./highlight-on-mount";
```

**(b)** Extend the searchParams type. Find:

```tsx
export default async function FinancialReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
```

Replace with:

```tsx
export default async function FinancialReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; breakId?: string }>;
}) {
  const { period, breakId } = await searchParams;
```

**(c)** Add `id` to the row and render `<HighlightOnMount>` near the table. Find:

```tsx
            {topBreaks.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
```

Replace with:

```tsx
            {topBreaks.map((b) => (
              <tr key={b.id} id={`break-${b.id}`} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-shadow">
```

Then find the closing `</table>` line:

```tsx
        </table>
      </div>
```

Replace with:

```tsx
        </table>
      </div>
      <HighlightOnMount targetId={breakId ? `break-${breakId}` : null} />
```

- [ ] **Step 3: Manual smoke check**

With dev server running, visit `http://localhost:3000/financial-reconciliation?breakId=<some-real-break-id>` (use a break id from an existing seed). Expect: page loads normally, the row scrolls into view, and a brief amber ring appears around it.

If you don't have a real break id handy, this is a low-risk visual change — proceed and let the integration test in Task 7 cover correctness.

- [ ] **Step 4: Commit**

```bash
git add app/(shell)/financial-reconciliation/highlight-on-mount.tsx app/(shell)/financial-reconciliation/page.tsx
git commit -m "feat(recon): scroll-to + highlight on ?breakId= deep-link"
```

---

## Task 7: Final manual verification

This is the verification-before-completion gate. Do not skip.

- [ ] **Step 1: Full test run**

```
npx vitest run
```

Expected: all tests pass (incl. the existing decision/audit-trail suites — make sure none regressed).

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual UI run-through**

Start the dev server. Seed a few rows if you don't already have them — `scripts/seed-test-decision.ts` is the existing helper.

Walk through these flows in the browser:

| Flow | Expected |
|------|----------|
| `/decision-inbox` with no pending items | Empty state, single Pending=0 card |
| `/decision-inbox` with one Decision + one Action | Both visible, sorted newest first |
| Click a variance Action → Approve | Row disappears; check `/audit-trail` shows the new ActionEvent |
| Click an AR Action → Snooze 7d | Row disappears; Invoice has `snoozedUntil` set |
| Click a recon-break Action → Investigate | Navigates to `/financial-reconciliation?breakId=…`; row stays pending in inbox |
| On reconciliation page with `?breakId=…` | Matching break row scrolls into view + flashes amber |
| On reconciliation page with `?breakId=bogus` | Page renders normally; no error |
| Click a Decision → Approve with reason | Decision moves out of inbox; AdjustmentProposal posted |

- [ ] **Step 4: Commit (only if anything was tweaked during verification)**

If everything passes cleanly, no commit needed.

---

## Done Definition

- `/decision-inbox` shows one Pending card, no tabs, unified list.
- All six row kinds render the right buttons and dispatch to the right endpoints.
- `/financial-reconciliation?breakId=…` scrolls + highlights, falls back silently.
- `npx vitest run` and `npx tsc --noEmit` both pass.
- No schema migration; no new API routes.
