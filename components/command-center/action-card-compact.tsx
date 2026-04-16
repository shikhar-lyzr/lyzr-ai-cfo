"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import type { Action } from "@/lib/types";

interface CompactProps {
  action: Action;
  onSelect: (id: string) => void;
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

export function ActionCardCompact({ action, onSelect }: CompactProps) {
  return (
    <button
      onClick={() => onSelect(action.id)}
      className="w-full h-13 flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 transition-colors rounded-md text-left"
      aria-label={`Open action ${action.headline}`}
    >
      <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
        {action.type === "ar_followup" ? "AR" : action.type.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-foreground truncate">{action.headline}</div>
          <PriorityBadge priority={action.severity === "critical" ? "critical" : action.severity === "warning" ? "high" : "medium"} />
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
          <span className="truncate">{action.detail}</span>
          <span>·</span>
          <span>{timeAgo(new Date(action.createdAt))}</span>
        </div>
      </div>

      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  );
}
