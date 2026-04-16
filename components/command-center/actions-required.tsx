"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/shared/section-header";
import { ARActionCard } from "./ar-action-card";
import { VarianceActionCard } from "./variance-action-card";
import { ActionModal } from "./action-modal";
import {
  FilterBar,
  type TypeFilter,
  type SeverityFilter,
  type StatusFilter,
} from "./filter-bar";
import type { Action, Severity } from "@/lib/types";

const severityOrder: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

interface ActionsRequiredProps {
  limit?: number;
  showViewAll?: boolean;
  showFilters?: boolean;
  title?: string;
}

export function ActionsRequired({
  limit = 5,
  showViewAll = true,
  showFilters = false,
  title = "Actions Required",
}: ActionsRequiredProps) {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    showFilters ? "all" : "pending"
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams({ userId });
    if (!showFilters) params.set("status", "pending");
    params.set("limit", String(limit));
    fetch(`/api/actions?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setActions(
            data.map((a: Action) => ({
              ...a,
              createdAt: new Date(a.createdAt),
            }))
          );
        }
      });
  }, [userId, limit, showFilters]);

  const filtered = useMemo(() => {
    const list = actions
      .filter((a) => typeFilter === "all" || a.type === typeFilter)
      .filter((a) => severityFilter === "all" || a.severity === severityFilter)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .sort((a, b) => {
        const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    return showFilters ? list : list.slice(0, limit);
  }, [actions, typeFilter, severityFilter, statusFilter, showFilters, limit]);

  const handleAction = async (id: string, status: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    if (action.type === "ar_followup") {
      let op: "mark_sent" | "snooze" | "escalate" | "dismiss" = "dismiss";
      if (status === "mark_sent") op = "mark_sent";
      else if (status === "snooze") op = "snooze";
      else if (status === "escalate") op = "escalate";
      else if (status === "dismiss" || status === "dismissed") op = "dismiss";

      if (op !== "dismiss") {
        await fetch(`/api/actions/${id}/ar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, days: 7 }),
        });
      } else {
        await fetch(`/api/actions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "dismissed" }),
        });
      }
    } else {
      await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }

    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const compact = !showFilters;
  const totalPending = actions.length;

  return (
    <div>
      <SectionHeader title={title} count={compact ? totalPending : filtered.length} />
      <div className="mt-3 bg-card border border-border rounded-[var(--radius)] overflow-hidden flex flex-col">
        {showFilters && (
          <FilterBar
            activeType={typeFilter}
            activeSeverity={severityFilter}
            activeStatus={statusFilter}
            onTypeChange={setTypeFilter}
            onSeverityChange={setSeverityFilter}
            onStatusChange={setStatusFilter}
          />
        )}
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {actions.length === 0 ? "No pending actions" : "No actions match the current filters"}
          </div>
        ) : (
          <div className={compact ? "max-h-[360px] overflow-y-auto" : ""}>
            {filtered.map((action) => {
              if (action.type === "ar_followup") {
                return (
                  <ARActionCard
                    key={action.id}
                    action={action}
                    onAction={(id, op) => handleAction(id, op)}
                    onOpen={() => setSelectedAction(action)}
                  />
                );
              }
              return (
                <VarianceActionCard
                  key={action.id}
                  action={action}
                  onAction={handleAction}
                  onOpen={() => setSelectedAction(action)}
                />
              );
            })}
          </div>
        )}
        {showViewAll && totalPending > 0 && (
          <button
            onClick={() => router.push("/actions")}
            className="w-full py-2.5 text-xs font-medium text-primary hover:underline border-t border-border bg-card sticky bottom-0"
          >
            View all {totalPending} action{totalPending !== 1 ? "s" : ""}
          </button>
        )}
      </div>
      {selectedAction && (
        <ActionModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onAction={async (id, op) => {
            await handleAction(id, op);
            setSelectedAction(null);
          }}
        />
      )}
    </div>
  );
}
