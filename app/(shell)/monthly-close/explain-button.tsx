"use client";

import { HelpCircle } from "lucide-react";
import { openAskAi } from "@/components/journey/journey-chat-bridge";

export function ExplainButton({ prompt, label = "Explain" }: { prompt: string; label?: string }) {
  return (
    <button
      onClick={() => openAskAi(prompt)}
      aria-label={label}
      className="inline-flex items-center text-muted-foreground hover:text-foreground"
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  );
}
