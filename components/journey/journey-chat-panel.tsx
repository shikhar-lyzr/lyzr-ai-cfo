"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatInput } from "@/components/agent-console/chat-input";
import { SuggestionCards } from "./suggestion-cards";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";
import {
  JOURNEY_ASK_AI_EVENT,
  type JourneyAskAiDetail,
} from "./journey-chat-bridge";

interface JourneyChatPanelProps {
  journeyId: string;
  nudges: string[];
  periodKey?: string;
}

const STORAGE_KEY = "inbox.chatPanel.expanded";

function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

export function JourneyChatPanel({ journeyId, nudges, periodKey }: JourneyChatPanelProps) {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(expanded)); } catch {}
  }, [expanded]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.userId) setUserId(data.userId); });
  }, []);

  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useChatStream(userId);

  const isStreamingRef = useRef(isStreaming);
  const sendMessageRef = useRef(sendMessage);
  const journeyIdRef = useRef(journeyId);
  const periodKeyRef = useRef(periodKey);

  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  useEffect(() => { journeyIdRef.current = journeyId; }, [journeyId]);
  useEffect(() => { periodKeyRef.current = periodKey; }, [periodKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<JourneyAskAiDetail>).detail;
      if (!detail?.message) return;
      if (isStreamingRef.current) return;
      if (lastPrefillRef.current === detail.message) return;
      lastPrefillRef.current = detail.message;
      setExpanded(true);
      sendMessageRef.current(detail.message, {
        journeyId: journeyIdRef.current,
        periodKey: periodKeyRef.current,
      });
    };
    window.addEventListener(JOURNEY_ASK_AI_EVENT, handler);
    return () => window.removeEventListener(JOURNEY_ASK_AI_EVENT, handler);
  }, []);

  const handleSend = (msg: string) => {
    if (!expanded) setExpanded(true);
    sendMessage(msg, { journeyId, periodKey });
  };

  if (!expanded) {
    return (
      <aside className="w-12 border-l border-border bg-card flex flex-col items-center py-3">
        <button
          onClick={() => setExpanded(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand chat panel"
        >
          <ChevronLeft size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[380px] shrink-0 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Ask the agent</h2>
        <button
          onClick={() => setExpanded(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Collapse chat panel"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ask anything about this journey. The agent has the data context.
            </p>
            <SuggestionCards nudges={nudges} onSelect={handleSend} />
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs max-w-[85%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[95%]">
                    {pipelineSteps.length > 0 && (
                      <div className="mb-1 text-[11px]">
                        <PipelineContainer steps={pipelineSteps} isStreaming={isStreaming} />
                      </div>
                    )}
                    {msg.content && (
                      <div className="bg-background border border-border rounded-xl px-3 py-2 text-xs doc-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-border">
        <ChatInput
          onSend={handleSend}
          onStop={stopStream}
          isStreaming={isStreaming}
          placeholder="Ask about this journey..."
        />
      </div>
    </aside>
  );
}
