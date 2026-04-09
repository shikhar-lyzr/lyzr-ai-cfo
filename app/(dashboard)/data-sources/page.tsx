"use client";

import { useState, useEffect, useCallback } from "react";
import { UploadArea } from "@/components/data-sources/upload-area";
import { SourceList } from "@/components/data-sources/source-list";
import type { DataSource } from "@/lib/types";

export default function DataSourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
        setUploadResult(
          `Processed ${result.dataSource.recordCount} records, generated ${result.actionsGenerated} variance actions.`
        );
        fetchSources();
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Data Sources</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload financial data to get AI-powered variance analysis and recommendations.
          </p>
        </div>

        <UploadArea onUpload={handleUpload} isUploading={isUploading} />

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
          <SourceList sources={sources} />
        </div>
      </div>
    </div>
  );
}
