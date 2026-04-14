"use client";

import { ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import type { Action } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import { ActionModal } from "@/components/feed/action-modal";

interface ActionCardProps {
  action: Action;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onFlag?: (id: string) => void;
  onApprove?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onArOp?: (id: string, op: "mark_sent" | "snooze" | "escalate") => void;
}

const severityDotColor: Record<string, string> = {
  critical: "bg-danger",
  warning: "bg-warning",
  info: "bg-success",
};

const statusLabels: Record<string, string> = {
  flagged: "Flagged",
  dismissed: "Dismissed",
  approved: "Approved",
};

export function ActionCard({
  action,
  isSelected,
  onSelect,
  onClose,
  onFlag,
  onApprove,
  onAskAI,
  onDismiss,
  onArOp,
}: ActionCardProps) {
  return (
    <>
      <div
        onClick={() => onSelect(action.id)}
        className={clsx(
          "flex items-center gap-3 bg-bg-card rounded-card border shadow-card px-3 h-[52px] cursor-pointer transition-all group",
          isSelected
            ? "border-accent-primary"
            : "border-border hover:border-accent-primary/40"
        )}
      >
        {/* Severity dot */}
        <div
          className={clsx(
            "w-2.5 h-2.5 rounded-full shrink-0",
            severityDotColor[action.severity] ?? "bg-border"
          )}
        />

        {/* Headline */}
        <p className="text-sm text-text-primary truncate flex-1">{action.headline}</p>

        {/* Status chip (non-pending only) */}
        {action.status !== "pending" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border/20 text-text-secondary border border-border shrink-0">
            {statusLabels[action.status] ?? action.status}
          </span>
        )}

        {/* Source */}
        <span className="text-xs text-text-secondary hidden sm:block truncate max-w-[100px]">
          {action.sourceName}
        </span>

        {/* Time */}
        <span className="text-xs text-text-secondary shrink-0">
          {relativeTime(action.createdAt)}
        </span>

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-text-primary shrink-0" />
      </div>

      {/* Slide-over modal */}
      {isSelected && (
        <ActionModal
          action={action}
          onClose={onClose}
          onFlag={onFlag}
          onApprove={onApprove}
          onAskAI={onAskAI}
          onDismiss={onDismiss}
          onArOp={onArOp}
        />
      )}
    </>
  );
}
