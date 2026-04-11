"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle, Flag, MessageSquare, X, Copy, Clock, ArrowUpCircle, History } from "lucide-react";
import { clsx } from "clsx";
import type { Action } from "@/lib/types";
import { relativeTime, severityColor } from "@/lib/utils";

interface ActionCardProps {
  action: Action;
  onFlag?: (id: string) => void;
  onApprove?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onArOp?: (id: string, op: "mark_sent" | "snooze" | "escalate") => void;
}

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: CheckCircle,
};

const severityLabels = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export function ActionCard({ action, onFlag, onApprove, onAskAI, onDismiss, onArOp }: ActionCardProps) {
  const Icon = severityIcons[action.severity] ?? AlertCircle;
  const isAr = action.type === "ar_followup";
  const [expanded, setExpanded] = useState(false);
  const [draftBody, setDraftBody] = useState<string | null>(action.draftBody ?? null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; fromStatus: string; toStatus: string; createdAt: string }>>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    if (events.length === 0) {
      setLoadingEvents(true);
      try {
        const res = await fetch(`/api/actions/${action.id}/events`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
        }
      } catch {
        // silent
      } finally {
        setLoadingEvents(false);
      }
    }
    setShowHistory(true);
  };

  const toggleDraft = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    // Lazy-load draftBody if not cached
    if (!draftBody) {
      setLoadingDraft(true);
      try {
        const res = await fetch(`/api/actions/${action.id}/ar`);
        if (res.ok) {
          const data = await res.json();
          setDraftBody(data.draftBody);
        }
      } catch {
        // silent — user can retry
      } finally {
        setLoadingDraft(false);
      }
    }

    setExpanded(true);
  };

  const handleCopyAndSend = async () => {
    if (draftBody) {
      await navigator.clipboard.writeText(draftBody);
    }
    onArOp?.(action.id, "mark_sent");
  };

  return (
    <div className="bg-bg-card rounded-card border border-border shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
            severityColor(action.severity)
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {severityLabels[action.severity]}
        </span>
        <span className="text-xs text-text-secondary">
          {relativeTime(action.createdAt)}
        </span>
      </div>

      {/* Clickable body for AR cards */}
      <div
        className={isAr && action.status === "pending" ? "cursor-pointer" : ""}
        onClick={isAr && action.status === "pending" ? toggleDraft : undefined}
      >
        <h3 className="text-sm font-semibold text-text-primary mb-1">
          {action.headline}
        </h3>
        <p className="text-sm text-text-secondary mb-2">{action.detail}</p>
        <p className="text-xs text-text-secondary mb-3">{action.driver}</p>
      </div>

      <p className="text-xs text-text-secondary mb-3">
        Source:{" "}
        <span className="text-accent-primary font-medium">
          {action.sourceName}
        </span>
      </p>

      {/* Expanded draft body for AR cards */}
      {isAr && expanded && (
        <div className="mb-3 p-3 rounded-lg bg-bg-secondary border border-border overflow-x-auto">
          {loadingDraft ? (
            <p className="text-xs text-text-secondary">Loading draft...</p>
          ) : draftBody ? (
            <pre className="text-xs text-text-primary whitespace-pre-wrap font-mono leading-relaxed">
              {draftBody}
            </pre>
          ) : (
            <p className="text-xs text-text-secondary">Draft unavailable.</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        {action.status === "pending" && isAr && (
          <>
            <button
              onClick={handleCopyAndSend}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-success/30 text-success hover:bg-success/10 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy & Mark Sent
            </button>
            <button
              onClick={() => onArOp?.(action.id, "snooze")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Snooze 7d
            </button>
            <button
              onClick={() => onArOp?.(action.id, "escalate")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-warning/30 text-warning hover:bg-warning/10 transition-colors"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Escalate
            </button>
            <button
              onClick={() => onAskAI?.(action.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask AI
            </button>
            <button
              onClick={() => onDismiss?.(action.id)}
              className="ml-auto inline-flex items-center p-1.5 text-text-secondary hover:text-danger rounded-btn hover:bg-danger/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
        {action.status === "pending" && !isAr && (
          <>
            <button
              onClick={() => onApprove?.(action.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-success/30 text-success hover:bg-success/10 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              onClick={() => onFlag?.(action.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              Flag
            </button>
            <button
              onClick={() => onAskAI?.(action.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask AI
            </button>
            <button
              onClick={() => onDismiss?.(action.id)}
              className="ml-auto inline-flex items-center p-1.5 text-text-secondary hover:text-danger rounded-btn hover:bg-danger/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
        {action.status === "flagged" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning">
            <Flag className="w-3.5 h-3.5" />
            Flagged for Review
          </span>
        )}
        {action.status === "dismissed" && (
          <span className="text-xs text-text-secondary">Dismissed</span>
        )}
        {action.status === "approved" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle className="w-3.5 h-3.5" />
            {isAr ? "Sent" : "Approved"}
          </span>
        )}
      </div>

      {/* Audit trail */}
      {action.status !== "pending" && (
        <div className="mt-2 pt-2 border-t border-border">
          <button
            onClick={toggleHistory}
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <History className="w-3 h-3" />
            {showHistory ? "Hide history" : "History"}
          </button>
          {showHistory && (
            <ul className="mt-1.5 space-y-1">
              {loadingEvents ? (
                <li className="text-xs text-text-secondary">Loading...</li>
              ) : events.length === 0 ? (
                <li className="text-xs text-text-secondary">No history recorded.</li>
              ) : (
                events.map((e) => (
                  <li key={e.id} className="text-xs text-text-secondary">
                    <span className="font-medium">{e.fromStatus}</span>
                    {" → "}
                    <span className="font-medium">{e.toStatus}</span>
                    <span className="ml-2 opacity-60">
                      {relativeTime(new Date(e.createdAt))}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
