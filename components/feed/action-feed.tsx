"use client";

import { useState } from "react";
import type { Action, ActionType, Severity, ActionStatus } from "@/lib/types";
import { ActionCard } from "@/components/feed/action-card";
import { FilterBar } from "@/components/feed/filter-bar";

interface ActionFeedProps {
  actions: Action[];
  onFlag?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const severityOrder: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function ActionFeed({ actions, onFlag, onAskAI, onDismiss }: ActionFeedProps) {
  const [typeFilter, setTypeFilter] = useState<ActionType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "all">("all");

  const filtered = actions
    .filter((a) => typeFilter === "all" || a.type === typeFilter)
    .filter((a) => severityFilter === "all" || a.severity === severityFilter)
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-bg-card">
        <h2 className="text-lg font-semibold text-text-primary">Actions</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <FilterBar
        activeType={typeFilter}
        activeSeverity={severityFilter}
        activeStatus={statusFilter}
        onTypeChange={setTypeFilter}
        onSeverityChange={setSeverityFilter}
        onStatusChange={setStatusFilter}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            No actions match the current filters.
          </div>
        ) : (
          filtered.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onFlag={onFlag}
              onAskAI={onAskAI}
              onDismiss={onDismiss}
            />
          ))
        )}
      </div>
    </div>
  );
}
