"use client";

import { openAskAi } from "@/components/journey/journey-chat-bridge";

export function AskAiButton({ breakId, periodKey }: { breakId: string; periodKey: string }) {
  return (
    <button
      type="button"
      onClick={() => openAskAi(`investigate break ${breakId} for period ${periodKey}`)}
      className="text-xs underline"
    >
      Ask AI
    </button>
  );
}
