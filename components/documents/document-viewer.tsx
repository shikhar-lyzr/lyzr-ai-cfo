"use client";

import { FileText, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DocumentViewerProps {
  document: {
    id: string;
    type: string;
    title: string;
    body: string;
    createdAt: string;
  } | null;
  isLoading: boolean;
  onRegenerate?: (type: string) => void;
  isRegenerating?: boolean;
}

export function DocumentViewer({ document, isLoading, onRegenerate, isRegenerating }: DocumentViewerProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FileText className="w-10 h-10 text-text-secondary mb-3 opacity-40" />
        <p className="text-sm text-text-secondary">
          Select a document to view its contents.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold text-text-primary">
            {document.title}
          </h1>
          {onRegenerate && (
            <button
              onClick={() => onRegenerate(document.type)}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          )}
        </div>
        <p className="text-xs text-text-secondary mb-6">
          Generated {new Date(document.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <div className="doc-body max-w-none">
          <ReactMarkdown>{document.body}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
