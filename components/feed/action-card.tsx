"use client";

import { AlertTriangle, AlertCircle, CheckCircle, Flag, MessageSquare, X } from "lucide-react";
import { clsx } from "clsx";
import type { Action } from "@/lib/types";
import { relativeTime, severityColor } from "@/lib/utils";

interface ActionCardProps {
  action: Action;
  onFlag?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
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

export function ActionCard({ action, onFlag, onAskAI, onDismiss }: ActionCardProps) {
  const Icon = severityIcons[action.severity] ?? AlertCircle;

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

      <h3 className="text-sm font-semibold text-text-primary mb-1">
        {action.headline}
      </h3>
      <p className="text-sm text-text-secondary mb-2">{action.detail}</p>
      <p className="text-xs text-text-secondary mb-3">{action.driver}</p>

      <p className="text-xs text-text-secondary mb-3">
        Source:{" "}
        <span className="text-accent-primary font-medium">
          {action.sourceName}
        </span>
      </p>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        {action.status === "pending" && (
          <>
            <button
              onClick={() => onFlag?.(action.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              Flag for Review
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
      </div>
    </div>
  );
}
