"use client";

import { FileText, RefreshCw } from "lucide-react";

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
        <div className="prose prose-sm max-w-none text-text-primary">
          {document.body.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-3 mb-1.5">{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
            if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold mt-2">{line.slice(2, -2)}</p>;
            if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm leading-relaxed">{line.slice(2)}</li>;
            if (line.trim() === "") return <div key={i} className="h-2" />;
            return <p key={i} className="text-sm leading-relaxed">{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}
