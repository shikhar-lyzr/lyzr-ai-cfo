"use client";

import { FileText, BarChart3, ClipboardCheck } from "lucide-react";
import { clsx } from "clsx";
import { relativeTime } from "@/lib/utils";

interface DocumentListItem {
  id: string;
  type: string;
  title: string;
  createdAt: string;
}

interface DocumentListProps {
  documents: DocumentListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const typeIcons: Record<string, typeof FileText> = {
  variance_report: BarChart3,
  ar_summary: FileText,
  close_package: ClipboardCheck,
};

const typeLabels: Record<string, string> = {
  variance_report: "Variance Report",
  ar_summary: "AR Summary",
  close_package: "Close Package",
};

export function DocumentList({ documents, selectedId, onSelect }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FileText className="w-10 h-10 text-text-secondary mb-3 opacity-40" />
        <p className="text-sm text-text-secondary">
          No documents yet. Upload financial data or click Generate Report to create your first document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 overflow-y-auto">
      {documents.map((doc) => {
        const Icon = typeIcons[doc.type] ?? FileText;
        return (
          <button
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            className={clsx(
              "flex items-start gap-3 p-3 rounded-btn text-left transition-colors w-full",
              selectedId === doc.id
                ? "bg-accent-primary/10 border border-accent-primary/30"
                : "hover:bg-border/30 border border-transparent"
            )}
          >
            <Icon className="w-4 h-4 mt-0.5 text-text-secondary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-text-primary truncate">
                {doc.title}
              </span>
              <span className="text-xs text-text-secondary">
                {typeLabels[doc.type] ?? doc.type} · {relativeTime(new Date(doc.createdAt))}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
