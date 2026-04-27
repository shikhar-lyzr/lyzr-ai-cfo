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
  return null;
}
