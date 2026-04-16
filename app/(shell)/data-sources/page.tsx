"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { UploadArea } from "@/components/data-sources/upload-area";
import { LinkSheetArea } from "@/components/data-sources/link-sheet-area";
import { SourceList } from "@/components/data-sources/source-list";
import type { DataSource } from "@/lib/types";

type TabShape = "variance" | "ar" | "reconciliation";

export default function DataSourcesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabShape>(() => {
    const tab = searchParams.get("tab");
    if (tab === "reconciliation" || tab === "ar") return tab;
    return "variance";
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      });
  }, []);

  const fetchSources = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/data-sources?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setSources(
        data.map((s: Record<string, unknown>) => ({
          ...s,
          createdAt: new Date(s.createdAt as string),
        }))
      );
    }
  }, [userId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const filteredSources = sources.filter((s) => {
    try {
      const meta = typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata;
      return meta?.shape === activeTab;
    } catch {
      return false;
    }
  });

  const handleUpload = async (file: File) => {
    if (!userId) return;
    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        // Reconciliation shapes: redirect back to the reconciliation page
        if (result.kind === "gl" || result.kind === "sub_ledger" || result.kind === "fx") {
          const kindLabel = result.kind === "fx" ? "FX rates" : result.kind === "gl" ? "GL" : "sub-ledger";
          const matchNote = result.kind === "fx"
            ? ` ${result.ratesLoaded} rates loaded.`
            : ` ${result.dataSource?.recordCount ?? 0} records ingested${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.`
          setUploadResult(`${kindLabel} uploaded.${matchNote} Redirecting...`);
          fetchSources();
          setTimeout(() => router.push("/financial-reconciliation"), 1500);
          return;
        }
        const mappingNote =
          result.mappingSource === "llm"
            ? " (columns mapped by AI — non-standard headers detected)"
            : "";
        const analysisNote =
          result.analysisStatus === "processing"
            ? " AI is analyzing in the background — actions will appear on the dashboard shortly."
            : ` Generated ${result.actionsGenerated} actions.`;
        const redirectPath = activeTab === "ar" ? "/ar-followups" : "/";
        setUploadResult(
          `Processed ${result.dataSource.recordCount} records.${analysisNote}${mappingNote} Redirecting...`
        );
        fetchSources();
        setTimeout(() => router.push(redirectPath), 1500);
      } else {
        const err = await res.json();
        setUploadResult(`Error: ${err.error}`);
      }
    } catch {
      setUploadResult("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLink = async (url: string) => {
    setIsLinking(true);
    setUploadResult(null);
    try {
      const res = await fetch("/api/data-sources/link-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, shape: activeTab }),
      });
      if (res.ok) {
        setUploadResult("Sheet connected. AI is analyzing in the background...");
        fetchSources();
        setTimeout(() => router.push("/"), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setUploadResult(
          `Error: ${(data as { error?: string }).error ?? "Failed to connect sheet"}`
        );
      }
    } catch {
      setUploadResult("Connection failed. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleReanalyze = async (id: string) => {
    await fetch(`/api/data-sources/${id}/reanalyze`, { method: "POST" });
    fetchSources();
    setTimeout(() => router.push("/"), 1000);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Data Sources</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload financial data to get AI-powered variance analysis and recommendations.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["variance", "ar", "reconciliation"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setUploadResult(null);
              }}
              className={clsx(
                "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-accent-primary text-accent-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              {tab === "variance" ? "Variance / P&L" : tab === "ar" ? "AR / Invoices" : "Reconciliation"}
            </button>
          ))}
        </div>

        {/* Upload + Link areas */}
        <div className={clsx("grid gap-4", activeTab !== "reconciliation" && "md:grid-cols-2")}>
          <UploadArea
            onUpload={handleUpload}
            isUploading={isUploading}
            hint={
              activeTab === "reconciliation"
                ? "Upload a GL CSV, sub-ledger CSV, or FX-rates CSV — we auto-detect the shape"
                : undefined
            }
          />
          {activeTab !== "reconciliation" && (
            <LinkSheetArea shape={activeTab} onLink={handleLink} isLinking={isLinking} />
          )}
        </div>

        {uploadResult && (
          <div
            className={`px-4 py-3 rounded-card text-sm ${
              uploadResult.startsWith("Error")
                ? "bg-danger/10 text-danger border border-danger/20"
                : "bg-success/10 text-success border border-success/20"
            }`}
          >
            {uploadResult}
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Connected Sources
          </h2>
          <SourceList sources={filteredSources} onReanalyze={handleReanalyze} />
        </div>
      </div>
    </div>
  );
}
