"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatInput } from "@/components/agent-console/chat-input";
import { NudgeChips } from "./nudge-chips";
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

export function JourneyChatPanel({ journeyId, nudges, periodKey }: JourneyChatPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.userId) setUserId(data.userId); });
  }, []);

  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useChatStream(userId);

  // Refs to keep the event listener stable while accessing latest values.
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

  return (
    <div className="border-t border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        {expanded ? "Collapse chat" : "Ask about this journey..."}
      </button>

      {expanded && (
        <div className="flex flex-col h-[40vh]">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs max-w-[70%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[85%]">
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
          </div>

          {messages.length === 0 && <NudgeChips nudges={nudges} onSelect={handleSend} />}

          <ChatInput
            onSend={handleSend}
            onStop={stopStream}
            isStreaming={isStreaming}
            placeholder={`Ask about this journey...`}
          />
        </div>
      )}

      {!expanded && (
        <NudgeChips nudges={nudges.slice(0, 3)} onSelect={handleSend} />
      )}
    </div>
  );
}
