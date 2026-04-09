import { FileSpreadsheet, Sheet, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import type { DataSource } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface SourceListProps {
  sources: DataSource[];
}

const statusConfig = {
  ready: { icon: CheckCircle, label: "Ready", className: "text-success" },
  processing: { icon: Loader2, label: "Processing", className: "text-warning animate-spin" },
  error: { icon: AlertCircle, label: "Error", className: "text-danger" },
};

const typeIcons = {
  csv: FileSpreadsheet,
  sheets: Sheet,
};

export function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        No data sources connected yet. Upload a CSV to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => {
        const TypeIcon = typeIcons[source.type] ?? FileSpreadsheet;
        const status = statusConfig[source.status] ?? statusConfig.error;
        const StatusIcon = status.icon;

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
          </div>
        );
      })}
    </div>
  );
}
