"use client";

import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import { ARActionCard } from "@/components/command-center/ar-action-card";
import { SectionHeader } from "@/components/shared/section-header";
import { PriorityBadge } from "@/components/shared/priority-badge";
import type { Action } from "@/lib/types";

type FilterStatus = "all" | "pending" | "flagged" | "approved" | "dismissed";
type FilterType = "all" | "variance" | "anomaly" | "recommendation" | "ar_followup";
type FilterSeverity = "all" | "critical" | "warning" | "info";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityToPriority(severity: string): "critical" | "high" | "medium" | "low" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "medium";
}

function RegularActionCard({ action, onAction }: { action: Action; onAction: (id: string, status: string) => void }) {
  return (
    <div className="p-4 border-b border-border last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-medium text-primary">●</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">{action.headline}</h4>
            <PriorityBadge priority={severityToPriority(action.severity)} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wider">{action.type}</span>
            <span>·</span>
            <span>{timeAgo(action.createdAt)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{action.detail}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => onAction(action.id, "approved")}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Approve
            </button>
            <button
              onClick={() => onAction(action.id, "flagged")}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-warning text-warning font-medium hover:bg-warning/5 transition-colors"
            >
              Flag
            </button>
            <button
              onClick={() => onAction(action.id, "dismissed")}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-muted text-muted-foreground font-medium hover:bg-secondary/50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActionFeed() {
  const [actions, setActions] = useState<Action[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) return;
        const { userId } = await authRes.json();

        const params = new URLSearchParams();
        params.append("userId", userId);
        if (filterStatus !== "all") params.append("status", filterStatus);
        if (filterType !== "all") params.append("type", filterType);
        if (filterSeverity !== "all") params.append("severity", filterSeverity);

        const res = await fetch(`/api/actions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setActions(
            (Array.isArray(data) ? data : []).map((a: Action) => ({
              ...a,
              createdAt: new Date(a.createdAt),
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [filterStatus, filterType, filterSeverity]);

  const handleAction = async (id: string, status: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    // AR operations
    if (action.type === "ar_followup") {
      let op: "mark_sent" | "snooze" | "escalate" = "mark_sent";
      if (status === "snooze") op = "snooze";
      else if (status === "escalate") op = "escalate";

      await fetch(`/api/actions/${id}/ar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, days: 7 }),
      });
    } else {
      // Regular action
      await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }

    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const criticalCount = actions.filter((a) => a.severity === "critical").length;
  const warningCount = actions.filter((a) => a.severity === "warning").length;
  const arCount = actions.filter((a) => a.type === "ar_followup").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 bg-card border border-border rounded-[var(--radius)]">
          <div className="text-xs text-muted-foreground uppercase">Total</div>
          <div className="text-2xl font-semibold mt-1">{actions.length}</div>
        </div>
        <div className="p-3 bg-card border border-destructive/20 rounded-[var(--radius)]">
          <div className="text-xs text-muted-foreground uppercase">Critical</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">{criticalCount}</div>
        </div>
        <div className="p-3 bg-card border border-warning/20 rounded-[var(--radius)]">
          <div className="text-xs text-muted-foreground uppercase">Warning</div>
          <div className="text-2xl font-semibold mt-1 text-warning">{warningCount}</div>
        </div>
        <div className="p-3 bg-card border border-info/20 rounded-[var(--radius)]">
          <div className="text-xs text-muted-foreground uppercase">AR Items</div>
          <div className="text-2xl font-semibold mt-1 text-info">{arCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase">Filters</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1.5">
            {(["all", "pending", "flagged", "approved", "dismissed"] as FilterStatus[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filterStatus === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["all", "critical", "warning", "info"] as FilterSeverity[]).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev as FilterSeverity)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filterSeverity === sev
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div className="bg-card border border-border rounded-[var(--radius)]">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading actions...</div>
        ) : actions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No actions found</div>
        ) : (
          <>
            {actions.map((action) => {
              if (action.type === "ar_followup") {
                return (
                  <ARActionCard
                    key={action.id}
                    action={action}
                    onAction={(id, op) => handleAction(id, op)}
                  />
                );
              }
              return (
                <RegularActionCard
                  key={action.id}
                  action={action}
                  onAction={handleAction}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
