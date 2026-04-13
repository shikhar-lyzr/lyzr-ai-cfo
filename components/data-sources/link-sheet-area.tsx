"use client";

import { useState } from "react";
import { Sheet, Loader2 } from "lucide-react";

interface LinkSheetAreaProps {
  shape: "variance" | "ar";
  onLink: (url: string) => Promise<void>;
  isLinking: boolean;
}

export function LinkSheetArea({ shape, onLink, isLinking }: LinkSheetAreaProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onLink(url.trim());
    setUrl("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-5 border border-border rounded-card bg-bg-card"
    >
      <div className="flex items-center gap-2">
        <Sheet className="w-5 h-5 text-accent-primary" />
        <h3 className="text-sm font-medium text-text-primary">Link a Google Sheet</h3>
      </div>
      <p className="text-xs text-text-secondary">
        Share your sheet with &quot;Anyone with link&quot; first.
        {shape === "variance"
          ? " Sheet should have columns like Account, Period, Actual, Budget."
          : " Sheet should have columns like Invoice #, Customer, Amount, Due Date."}
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          disabled={isLinking}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-btn bg-bg-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLinking || !url.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shrink-0"
        >
          {isLinking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Sheet"
          )}
        </button>
      </div>
    </form>
  );
}
