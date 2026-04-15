"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Clock, AlertTriangle, MessageSquare, X, HelpCircle } from "lucide-react";
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

interface ARActionCardProps {
  action: Action;
  onAction: (id: string, op: "mark_sent" | "snooze" | "escalate" | "dismiss") => void;
}

export function ARActionCard({ action, onAction }: ARActionCardProps) {
  const router = useRouter();
  const [showDraft, setShowDraft] = useState(false);
  const [draftBody, setDraftBody] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const handleCopyAndSend = async () => {
    // Load draft if not already loaded
    if (!draftBody) {
      setLoadingDraft(true);
      try {
        const res = await fetch(`/api/actions/${action.id}/ar`);
        if (res.ok) {
          const data = await res.json();
          setDraftBody(data.draftBody);
          // Copy to clipboard
          navigator.clipboard.writeText(data.draftBody);
        }
      } catch (err) {
        console.error("Failed to fetch draft:", err);
      } finally {
        setLoadingDraft(false);
      }
    } else {
      // Already loaded, just copy
      navigator.clipboard.writeText(draftBody);
    }

    // Mark as sent
    onAction(action.id, "mark_sent");
  };

  const handleViewDraft = async () => {
    if (!draftBody && !loadingDraft) {
      setLoadingDraft(true);
      try {
        const res = await fetch(`/api/actions/${action.id}/ar`);
        if (res.ok) {
          const data = await res.json();
          setDraftBody(data.draftBody);
        }
      } catch (err) {
        console.error("Failed to fetch draft:", err);
      } finally {
        setLoadingDraft(false);
      }
    }
    setShowDraft(!showDraft);
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-foreground truncate">{action.headline}</h4>
              <PriorityBadge priority={severityToPriority(action.severity)} />
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wider">AR Follow-up</span>
              <span>·</span>
              <span>{timeAgo(action.createdAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{action.detail}</p>
          </div>
          <button
            onClick={() => onAction(action.id, "dismiss")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* AR Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopyAndSend}
            disabled={loadingDraft}
            className="text-xs px-3 py-1.5 rounded-[var(--radius)] bg-success text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
          >
            <Copy size={12} />
            Copy & Mark Sent
          </button>
          <button
            onClick={() => onAction(action.id, "snooze")}
            className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-border text-foreground font-medium hover:bg-secondary/50 transition-colors flex items-center gap-1.5"
          >
            <Clock size={12} />
            Snooze 7d
          </button>
          <button
            onClick={() => onAction(action.id, "escalate")}
            className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-warning text-warning font-medium hover:bg-warning/5 transition-colors flex items-center gap-1.5"
          >
            <AlertTriangle size={12} />
            Escalate
          </button>
          <button
            onClick={handleViewDraft}
            className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-primary text-primary font-medium hover:bg-primary/5 transition-colors flex items-center gap-1.5"
          >
            <MessageSquare size={12} />
            {showDraft ? "Hide Draft" : "View Draft"}
          </button>
        </div>

        {/* Draft Email Display */}
        {showDraft && (
          <div className="p-3 mt-2 rounded-[var(--radius)] bg-card border border-border">
            {loadingDraft ? (
              <p className="text-xs text-muted-foreground">Loading draft...</p>
            ) : draftBody ? (
              <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">
                {draftBody}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">No draft available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
