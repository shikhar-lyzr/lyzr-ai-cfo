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
