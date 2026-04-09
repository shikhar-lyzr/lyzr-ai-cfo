"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageSquare } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isStreaming?: boolean;
}

export function ChatPanel({ messages, onSend, isStreaming = false }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">Chat</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Ask questions about your financial data
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary gap-3">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-sm">No messages yet. Ask a question to get started.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isStreaming && (
          <div className="self-start px-4 py-3 rounded-card bg-bg-primary border border-border">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-bounce [animation-delay:0.1s]" />
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        )}
      </div>

      <ChatInput onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
