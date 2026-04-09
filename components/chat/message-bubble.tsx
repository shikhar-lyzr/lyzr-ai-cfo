import { clsx } from "clsx";
import type { ChatMessage } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAgent = message.role === "agent";

  return (
    <div
      className={clsx(
        "flex flex-col max-w-[85%] gap-1",
        isAgent ? "self-start" : "self-end"
      )}
    >
      <div
        className={clsx(
          "px-4 py-3 rounded-card text-sm leading-relaxed whitespace-pre-wrap",
          isAgent
            ? "bg-bg-primary text-text-primary border border-border"
            : "bg-accent-primary text-white"
        )}
      >
        {message.content}
      </div>
      <span
        className={clsx(
          "text-[10px] text-text-secondary px-1",
          isAgent ? "text-left" : "text-right"
        )}
      >
        {isAgent ? "AI CFO" : "You"} · {relativeTime(message.timestamp)}
      </span>
    </div>
  );
}
