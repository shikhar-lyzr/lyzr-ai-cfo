// tests/agent/mock-query.ts
//
// Builders for scripted gitclaw GCMessage sequences. Used by
// tests/agent/close-package-response.test.ts and
// tests/chat-route/pipeline-sse.test.ts.
//
// The shapes match the minimum set of fields the production code actually
// reads. They intentionally do NOT try to mirror the full GCMessage union —
// extending this file is cheaper than keeping dummy values for fields
// nothing reads.

import type { GCMessage } from "gitclaw";

export function deltaMsg(text: string): GCMessage {
  return { type: "delta", deltaType: "text", content: text } as unknown as GCMessage;
}

export function assistantMsg(content: string, stopReason?: string): GCMessage {
  return { type: "assistant", content, stopReason } as unknown as GCMessage;
}

export function toolUseMsg(id: string, toolName: string, args?: unknown): GCMessage {
  return { type: "tool_use", id, toolName, args } as unknown as GCMessage;
}

export function toolResultMsg(toolUseId: string, text: string, isError = false): GCMessage {
  return { type: "tool_result", toolUseId, content: text, isError } as unknown as GCMessage;
}

export function systemErrorMsg(content: string): GCMessage {
  return { type: "system", subtype: "error", content } as unknown as GCMessage;
}

// Returns a value shaped like gitclaw's Query (an AsyncIterable<GCMessage>)
// that yields the provided messages in order and completes.
export function scriptedQuery(messages: GCMessage[]): AsyncIterable<GCMessage> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const m of messages) yield m;
    },
  };
}
