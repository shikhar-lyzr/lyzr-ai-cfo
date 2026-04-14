"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Flag,
  MessageSquare,
  Copy,
  Clock,
  ArrowUpCircle,
  History,
} from "lucide-react";
import { clsx } from "clsx";
import type { Action } from "@/lib/types";
import { relativeTime, severityColor } from "@/lib/utils";

interface ActionModalProps {
  action: Action;
  onClose: () => void;
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

export function ActionModal({
  action,
  onClose,
  onFlag,
  onApprove,
  onAskAI,
  onDismiss,
  onArOp,
}: ActionModalProps) {
  const [visible, setVisible] = useState(false);
  const [draftBody, setDraftBody] = useState<string | null>(action.draftBody ?? null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [events, setEvents] = useState<
    Array<{ id: string; fromStatus: string; toStatus: string; createdAt: string }>
  >([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const Icon = severityIcons[action.severity] ?? AlertCircle;
  const isAr = action.type === "ar_followup";

  // Slide-in animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-fetch AR draft on mount
  useEffect(() => {
    if (isAr && !draftBody && action.status === "pending") {
      setLoadingDraft(true);
      fetch(`/api/actions/${action.id}/ar`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.draftBody) setDraftBody(data.draftBody);
        })
        .catch(() => {})
        .finally(() => setLoadingDraft(false));
    }
  }, [isAr, draftBody, action.id, action.status]);

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

  const handleCopyAndSend = async () => {
    if (draftBody) {
      await navigator.clipboard.writeText(draftBody);
    }
    onArOp?.(action.id, "mark_sent");
    onClose();
  };

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          "fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-bg-card flex flex-col shadow-xl transition-transform duration-200",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
              severityColor(action.severity)
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {severityLabels[action.severity]}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-btn hover:bg-border/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              {action.headline}
            </h2>
            <p className="text-sm text-text-secondary">{action.detail}</p>
          </div>

          <p className="text-xs text-text-secondary">{action.driver}</p>

          <p className="text-xs text-text-secondary">
            Source:{" "}
            <span className="text-accent-primary font-medium">
              {action.sourceName}
            </span>
            <span className="ml-2">{relativeTime(action.createdAt)}</span>
          </p>

          {/* AR draft body */}
          {isAr && (
            <div className="p-3 rounded-lg bg-bg-primary border border-border">
              {loadingDraft ? (
                <p className="text-xs text-text-secondary">Loading draft email...</p>
              ) : draftBody ? (
                <pre className="text-xs text-text-primary whitespace-pre-wrap font-mono leading-relaxed">
                  {draftBody}
                </pre>
              ) : (
                <p className="text-xs text-text-secondary">Draft unavailable.</p>
              )}
            </div>
          )}

          {/* History */}
          {action.status !== "pending" && (
            <div className="pt-2 border-t border-border">
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

        {/* Footer — action buttons */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-border shrink-0">
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
                onClick={() => { onArOp?.(action.id, "snooze"); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                Snooze 7d
              </button>
              <button
                onClick={() => { onArOp?.(action.id, "escalate"); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-warning/30 text-warning hover:bg-warning/10 transition-colors"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Escalate
              </button>
            </>
          )}
          {action.status === "pending" && !isAr && (
            <>
              <button
                onClick={() => { onApprove?.(action.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-success/30 text-success hover:bg-success/10 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={() => { onFlag?.(action.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Flag
              </button>
            </>
          )}
          {action.status === "pending" && (
            <>
              <button
                onClick={() => { onAskAI?.(action.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI
              </button>
              <button
                onClick={() => { onDismiss?.(action.id); onClose(); }}
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
      </div>
    </>
  );

  return createPortal(content, document.body);
}
