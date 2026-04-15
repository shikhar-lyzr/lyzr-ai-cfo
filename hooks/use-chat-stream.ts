"use client";

import { useState, useRef, useCallback } from "react";
import type { PipelineStep } from "@/lib/agent/pipeline-types";

export interface StreamMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  pipelineSteps?: PipelineStep[];
}

interface ChatStreamState {
  messages: StreamMessage[];
  pipelineSteps: PipelineStep[];
  isStreaming: boolean;
}

export function useChatStream(userId: string | null) {
  const [state, setState] = useState<ChatStreamState>({
    messages: [],
    pipelineSteps: [],
    isStreaming: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, opts?: { actionId?: string; journeyId?: string }) => {
    if (!userId || !content.trim()) return;

    abortRef.current = new AbortController();

    setState((s) => ({
      ...s,
      isStreaming: true,
      pipelineSteps: [],
      messages: [...s.messages, { id: `msg-${Date.now()}`, role: "user", content }],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: content,
          actionId: opts?.actionId,
          journeyId: opts?.journeyId,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.body) {
        setState((s) => ({ ...s, isStreaming: false }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const assistantId = `msg-${Date.now()}-agent`;

      setState((s) => ({
        ...s,
        messages: [...s.messages, { id: assistantId, role: "agent", content: "" }],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const eventLine = part.match(/^event: (.+)$/m)?.[1];
          const dataLine = part.match(/^data: (.+)$/m)?.[1];
          if (!eventLine || !dataLine) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue;
          }

          switch (eventLine) {
            case "pipeline_step":
              setState((s) => {
                const step = data as unknown as PipelineStep;
                const existing = s.pipelineSteps.find((p) => p.id === step.id);
                if (existing) {
                  return {
                    ...s,
                    pipelineSteps: s.pipelineSteps.map((p) =>
                      p.id === step.id ? { ...p, ...step } : p
                    ),
                  };
                }
                return { ...s, pipelineSteps: [...s.pipelineSteps, step] };
              });
              break;

            case "delta":
              assistantText += (data as { text: string }).text;
              setState((s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantText } : m
                ),
              }));
              break;

            case "done":
              setState((s) => ({ ...s, isStreaming: false }));
              break;

            case "error":
              assistantText += `\n\n**Error:** ${(data as { error: string }).error}`;
              setState((s) => ({
                ...s,
                isStreaming: false,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantText } : m
                ),
              }));
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({ ...s, isStreaming: false }));
      }
    }

    setState((s) => ({ ...s, isStreaming: false }));
  }, [userId]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  return { ...state, sendMessage, stopStream };
}
