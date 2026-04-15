"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { ARActionCard } from "./ar-action-card";
import type { Action } from "@/lib/types";

function severityToPriority(severity: string): "critical" | "high" | "medium" | "low" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "medium";
}

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

function ActionCard({ action, onAction }: { action: Action; onAction: (id: string, status: string) => void }) {
  return (
    <div className="p-4 border-b border-border last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bell size={16} className="text-primary" />
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
              onClick={() => onAction(action.id, "dismissed")}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-destructive text-destructive font-medium hover:bg-destructive/5 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActionsRequiredProps {
  limit?: number;
  showViewAll?: boolean;
}

export function ActionsRequired({ limit = 5, showViewAll = true }: ActionsRequiredProps) {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.userId) return;
        return fetch(`/api/actions?userId=${data.userId}&status=pending&limit=${limit}`);
      })
      .then((r) => r?.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setActions(data.map((a: Action) => ({
            ...a,
            createdAt: new Date(a.createdAt),
          })));
        }
      });
  }, []);

  const handleAction = async (id: string, status: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    // AR operations
    if (action.type === "ar_followup") {
      let op: "mark_sent" | "snooze" | "escalate" | "dismiss" = "dismiss";
      if (status === "mark_sent") op = "mark_sent";
      else if (status === "snooze") op = "snooze";
      else if (status === "escalate") op = "escalate";
      else if (status === "dismiss") op = "dismiss";

      if (op !== "dismiss") {
        await fetch(`/api/actions/${id}/ar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, days: 7 }),
        });
      } else {
        // Mark as dismissed
        await fetch(`/api/actions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "dismissed" }),
        });
      }
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

  return (
    <div>
      <SectionHeader title="Actions Required" count={actions.length} />
      <div className="mt-3 bg-card border border-border rounded-[var(--radius)]">
        {actions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No pending actions
          </div>
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
                <ActionCard key={action.id} action={action} onAction={handleAction} />
              );
            })}
            {showViewAll && actions.length >= limit && (
              <button
                onClick={() => router.push("/actions")}
                className="w-full py-2.5 text-xs font-medium text-primary hover:underline"
              >
                View all actions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
