"use client";

// Thin shim used by the unified decision-inbox to deep-link into a specific
// break row via ?breakId=…. Replaced by Phase 2's break-detail panel; safe
// to delete when that lands.

import { useEffect } from "react";

export function HighlightOnMount({ targetId }: { targetId: string | null }) {
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-amber-400");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-amber-400");
    }, 2000);
    return () => clearTimeout(t);
  }, [targetId]);
  return null;
}
