"use client";

import { useState } from "react";
import { FileSpreadsheet, Sheet, CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import type { DataSource } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface SourceListProps {
  sources: DataSource[];
  onReanalyze?: (id: string) => Promise<void>;
}

const statusConfig = {
  ready: { icon: CheckCircle, label: "Ready", className: "text-success" },
  processing: { icon: Loader2, label: "Processing", className: "text-warning animate-spin" },
  error: { icon: AlertCircle, label: "Error", className: "text-danger" },
};

const typeIcons: Record<string, typeof FileSpreadsheet> = {
  csv: FileSpreadsheet,
  sheets: Sheet,
  gl: FileSpreadsheet,
  sub_ledger: FileSpreadsheet,
  fx: FileSpreadsheet,
};

export function SourceList({ sources, onReanalyze }: SourceListProps) {
  const [reanalyzingIds, setReanalyzingIds] = useState<Set<string>>(new Set());

  const handleReanalyze = async (id: string) => {
    if (!onReanalyze) return;
    setReanalyzingIds((prev) => new Set(prev).add(id));
    try {
      await onReanalyze(id);
    } finally {
      setReanalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        No data sources connected yet. Upload a CSV or link a Google Sheet to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => {
        const TypeIcon = typeIcons[source.type] ?? FileSpreadsheet;
        const status = statusConfig[source.status] ?? statusConfig.error;
        const StatusIcon = status.icon;
        const isReanalyzing = reanalyzingIds.has(source.id);

        return (
          <div
            key={source.id}
            className="flex items-center gap-3 p-3 bg-bg-card rounded-card border border-border"
          >
            <div className="w-10 h-10 rounded-card bg-accent-primary/10 flex items-center justify-center shrink-0">
              <TypeIcon className="w-5 h-5 text-accent-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {source.name}
              </p>
              <p className="text-xs text-text-secondary">
                {source.type.toUpperCase()} · {source.recordCount} records · uploaded{" "}
                {relativeTime(source.createdAt)}
              </p>
            </div>
            <div className={clsx("flex items-center gap-1.5 text-xs font-medium", status.className)}>
              <StatusIcon className="w-4 h-4" />
              {status.label}
            </div>
            {onReanalyze && source.status === "ready" && (
              <button
                onClick={() => handleReanalyze(source.id)}
                disabled={isReanalyzing}
                title="Re-analyze this data source"
                className="p-1.5 text-text-secondary hover:text-accent-primary rounded-btn hover:bg-accent-primary/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx("w-4 h-4", isReanalyzing && "animate-spin")} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
