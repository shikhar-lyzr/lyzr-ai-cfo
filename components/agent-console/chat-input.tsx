"use client";

import { useState } from "react";
import { Send, Square } from "lucide-react";
import { clsx } from "clsx";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, isStreaming, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && !isStreaming) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={placeholder ?? "Message CFO Agent..."}
          disabled={isStreaming}
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Square size={14} className="text-destructive-foreground" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              value.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <Send size={16} />
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        AI can make mistakes. Verify critical financial data.
      </p>
    </div>
  );
}
