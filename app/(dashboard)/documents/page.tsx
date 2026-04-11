"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentViewer } from "@/components/documents/document-viewer";

interface DocListItem {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface DocFull {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocFull | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setIsLoadingDoc(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDoc(data);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleGenerate = async (type: "variance_report" | "ar_summary") => {
    setShowDropdown(false);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const newDoc = await res.json();
        await fetchDocuments();
        await handleSelect(newDoc.id);
      }
    } catch {
      // silent
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary">Documents</h1>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Generate Report
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
          {showDropdown && !isGenerating && (
            <div className="absolute right-0 mt-1 w-56 bg-bg-card border border-border rounded-card shadow-card z-10">
              <button
                onClick={() => handleGenerate("variance_report")}
                className="block w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-border/30 transition-colors rounded-t-card"
              >
                Monthly Variance Report
              </button>
              <button
                onClick={() => handleGenerate("ar_summary")}
                className="block w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-border/30 transition-colors rounded-b-card"
              >
                AR Aging Summary
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — document list */}
        <div className="w-72 border-r border-border shrink-0 overflow-y-auto">
          {isLoadingList ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <DocumentList
              documents={documents}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* Right panel — document viewer */}
        <div className="flex-1 min-w-0">
          <DocumentViewer
              document={selectedDoc}
              isLoading={isLoadingDoc}
              onRegenerate={(type) => handleGenerate(type as "variance_report" | "ar_summary")}
              isRegenerating={isGenerating}
            />
        </div>
      </div>
    </div>
  );
}
