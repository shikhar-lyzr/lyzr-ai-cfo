"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { UploadArea } from "@/components/data-sources/upload-area";
import { LinkSheetArea } from "@/components/data-sources/link-sheet-area";
import { SourceList } from "@/components/data-sources/source-list";
import type { DataSource } from "@/lib/types";

type TabShape = "variance" | "ar" | "reconciliation" | "capital";

export default function DataSourcesPage() {
  return (
    <Suspense fallback={null}>
      <DataSourcesPageInner />
    </Suspense>
  );
}

function DataSourcesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabShape>(() => {
    const tab = searchParams.get("tab");
    if (tab === "reconciliation" || tab === "ar" || tab === "capital") return tab;
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
    if (activeTab === "reconciliation") {
      return s.type === "gl" || s.type === "sub_ledger" || s.type === "fx";
    }
    if (activeTab === "capital") {
      return s.type === "capital_components" || s.type === "rwa_breakdown";
    }
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

    const postUpload = async (replaceId?: string) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);
      if (replaceId) formData.append("replace", replaceId);
      return fetch("/api/upload", { method: "POST", body: formData });
    };

    try {
      let res = await postUpload();

      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as {
          duplicateOf?: { id: string; name: string; createdAt: string };
        };
        const dup = body.duplicateOf;
        if (!dup) {
          setUploadResult("Error: duplicate upload (no prior reference returned)");
          return;
        }
        const when = new Date(dup.createdAt).toLocaleDateString();
        const ok = window.confirm(
          `This file looks identical to "${dup.name}" uploaded on ${when}. Replace it?`
        );
        if (!ok) {
          setUploadResult("Upload cancelled.");
          return;
        }
        res = await postUpload(dup.id);
      }

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
        // Capital shapes: redirect to the regulatory-capital page
        if (result.kind === "capital_components" || result.kind === "rwa_breakdown") {
          const kindLabel = result.kind === "capital_components" ? "capital components" : "RWA breakdown";
          setUploadResult(`${kindLabel} uploaded. ${result.dataSource?.recordCount ?? 0} records ingested. Redirecting…`);
          fetchSources();
          setTimeout(() => router.push("/regulatory-capital"), 1500);
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
        const redirectPath = activeTab === "ar" ? "/actions" : "/";
        setUploadResult(
          `Processed ${result.dataSource.recordCount} records.${analysisNote}${mappingNote} Redirecting...`
        );
        fetchSources();
        setTimeout(() => router.push(redirectPath), 1500);
      } else {
        const err = await res.json().catch(() => ({ error: res.statusText }));
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
      const shapeForApi: "variance" | "ar" | "gl" | "capital_components" =
        activeTab === "reconciliation"
          ? "gl"
          : activeTab === "capital"
            ? "capital_components"
            : activeTab;
      const res = await fetch("/api/data-sources/link-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, shape: shapeForApi }),
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
          {(["variance", "ar", "reconciliation", "capital"] as const).map((tab) => (
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
              {tab === "variance"
                ? "Variance / P&L"
                : tab === "ar"
                  ? "AR / Invoices"
                  : tab === "reconciliation"
                    ? "Reconciliation"
                    : "Regulatory Capital"}
            </button>
          ))}
        </div>

        {/* Upload + Link areas */}
        <div className={activeTab === "capital" ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
          <UploadArea
            onUpload={handleUpload}
            isUploading={isUploading}
            hint={
              activeTab === "reconciliation"
                ? "Upload a GL CSV, sub-ledger CSV, or FX-rates CSV — we auto-detect the shape"
                : activeTab === "capital"
                  ? "Upload a capital components CSV or RWA breakdown CSV — we auto-detect the shape"
                  : undefined
            }
          />
          {activeTab !== "capital" && (
            <LinkSheetArea
              shape={
                activeTab === "reconciliation"
                  ? "gl"
                  : // @ts-expect-error - dead code path kept for future re-enablement
                    activeTab === "capital"
                    ? "capital_components"
                    : activeTab
              }
              onLink={handleLink}
              isLinking={isLinking}
            />
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
