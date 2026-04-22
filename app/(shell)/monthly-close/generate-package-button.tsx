"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GeneratePackageButton({ period }: { period: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "close_package", period }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const doc = await res.json();
      router.push(`/documents?select=${doc.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generate}
        disabled={loading}
        className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Close Package"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
