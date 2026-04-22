"use client";

import { openAskAi } from "@/components/journey/journey-chat-bridge";

export function ExplainButton({ prompt, label = "Ask AI" }: { prompt: string; label?: string }) {
  return (
    <button
      onClick={() => openAskAi(prompt)}
      className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}
