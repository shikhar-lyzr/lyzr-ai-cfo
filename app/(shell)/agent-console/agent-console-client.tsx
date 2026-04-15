"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatInput } from "@/components/agent-console/chat-input";
import { AgentContextPanel } from "@/components/agent-console/agent-context-panel";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";

export function AgentConsoleClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      });
  }, []);

  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useChatStream(userId);

  // Auto-send from Command Center search bar
  useEffect(() => {
    if (!userId || autoSentRef.current) return;
    const msg = searchParams.get("message");
    if (msg) {
      autoSentRef.current = true;
      sendMessage(msg);
      router.replace("/agent-console");
    }
  }, [userId, searchParams, sendMessage, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pipelineSteps]);

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-8 -mt-8 -mb-4">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-3 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">CFO Agent</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Online &amp; Ready
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot size={48} className="mb-4 opacity-30" />
              <p className="text-sm">Send a message to start a conversation</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[70%] text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    {i === messages.length - 1 && pipelineSteps.length > 0 && (
                      <div className="mb-2 px-3 py-2 bg-card border border-border rounded-[var(--radius)]">
                        <PipelineContainer steps={pipelineSteps} isStreaming={isStreaming} />
                      </div>
                    )}
                    {msg.content && (
                      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-sm doc-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={(msg) => sendMessage(msg)}
          onStop={stopStream}
          isStreaming={isStreaming}
        />
      </div>

      <AgentContextPanel />
    </div>
  );
}
