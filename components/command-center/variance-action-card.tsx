"use client";

import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Lightbulb, AlertCircle, MessageSquare, X } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import type { Action } from "@/lib/types";

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

function typeIcon(type: string) {
  if (type === "variance") return TrendingUp;
  if (type === "anomaly") return AlertCircle;
  if (type === "recommendation") return Lightbulb;
  return TrendingDown;
}

function typeLabel(type: string) {
  if (type === "variance") return "Variance";
  if (type === "anomaly") return "Anomaly";
  if (type === "recommendation") return "Recommendation";
  return type;
}

interface Props {
  action: Action;
  onAction: (id: string, status: string) => void;
  onOpen?: () => void;
}

export function VarianceActionCard({ action, onAction, onOpen }: Props) {
  const router = useRouter();
  const Icon = typeIcon(action.type);

  const handleAskAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = `Tell me more about: ${action.headline}\n\n${action.detail}`;
    router.push(`/agent-console?message=${encodeURIComponent(msg)}`);
  };

  return (
    <div
      onClick={() => onOpen?.()}
      className="p-4 border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary/20 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">{action.headline}</h4>
            <PriorityBadge priority={severityToPriority(action.severity)} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wider">{typeLabel(action.type)}</span>
            {action.driver && (
              <>
                <span>·</span>
                <span className="truncate">{action.driver}</span>
              </>
            )}
            <span>·</span>
            <span>{timeAgo(action.createdAt)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{action.detail}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); onAction(action.id, "approved"); }}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Approve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction(action.id, "flagged"); }}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-border text-foreground font-medium hover:bg-secondary/50 transition-colors"
            >
              Flag
            </button>
            <button
              onClick={handleAskAI}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-primary text-primary font-medium hover:bg-primary/5 transition-colors flex items-center gap-1.5"
            >
              <MessageSquare size={12} />
              Ask AI
            </button>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAction(action.id, "dismissed"); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
