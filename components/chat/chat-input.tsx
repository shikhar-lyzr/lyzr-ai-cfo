"use client";

import { useState, useRef } from "react";
import { SendHorizontal } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask about your financial data...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 p-4 border-t border-border bg-bg-card">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-btn border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-btn bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <SendHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}
