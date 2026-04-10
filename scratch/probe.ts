/**
 * Agent-only probe for Path A validation.
 *
 * Runs the gitclaw agent against a data source with NO deterministic JS
 * pre-processing (no variance loop, no pre-seeded actions), and captures
 * every tool call, every delta, and the final commentary. The goal is to
 * answer: "if we delete the JS variance loop in the upload route, will the
 * agent reliably produce good action cards on its own?"
 *
 * This module is a diagnostic — it intentionally duplicates the gitclaw
 * query setup from lib/agent/index.ts rather than extending analyzeUpload,
 * so instrumentation concerns stay out of the production path.
 */

import { query } from "gitclaw";
import type { Query } from "gitclaw";
import { createFinancialTools } from "./tools";

const AGENT_DIR = process.cwd() + "/agent";
const MODEL = "google:gemini-2.5-flash-lite";

export interface ProbeToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  durationMs?: number;
}

export interface ProbeResult {
  ok: boolean;
  commentary: string;
  toolCalls: ProbeToolCall[];
  stopReason?: string;
  error?: string;
  durationMs: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
  };
}

export async function runAgentProbe(
  userId: string,
  dataSourceId: string,
  fileName: string,
  recordCount: number
): Promise<ProbeResult> {
  if (!process.env.OPENAI_API_KEY && !process.env.LYZR_API_KEY && !process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      commentary: "",
      toolCalls: [],
      error: "No LLM API key is set (OPENAI_API_KEY, LYZR_API_KEY, or GEMINI_API_KEY)",
      durationMs: 0,
    };
  }

  const tools = createFinancialTools(userId);

  // Explicit variance-review prompt — the agent must drive the whole workflow.
  // Mirrors the "analyzeUpload" prompt but without any pre-computed summary,
  // because the whole point of the probe is to see if the agent can do the
  // work unassisted.
  const prompt = `A new CSV file "${fileName}" was just uploaded with ${recordCount} financial records (data source ID: ${dataSourceId}). There are NO existing actions for this data source — you are the source of truth.

Your job is to run a complete variance review:
1. Call analyze_financial_data with dataSourceId="${dataSourceId}" to compute variances
2. For each significant variance (use the severity thresholds from RULES.md — critical >20%, warning 10-20%, info 5-10%), call create_action with a clear headline, detail, and driver
3. Call generate_commentary with dataSourceId="${dataSourceId}" and format="summary" to produce the narrative

Be exhaustive — surface every material variance as an action. Don't skip items.`;

  const startTs = Date.now();
  const toolCallsById = new Map<string, ProbeToolCall>();
  const toolStartTimes = new Map<string, number>();
  let commentary = "";
  let stopReason: string | undefined;
  let errorMessage: string | undefined;

  let result: Query;
  try {
    result = query({
      prompt,
      dir: AGENT_DIR,
      model: MODEL,
      tools,
      replaceBuiltinTools: true,
      maxTurns: 15,
      constraints: { temperature: 0.2 },
    });
  } catch (err) {
    return {
      ok: false,
      commentary: "",
      toolCalls: [],
      error: err instanceof Error ? err.message : "Failed to start probe query",
      durationMs: Date.now() - startTs,
    };
  }

  try {
    for await (const msg of result) {
      if (msg.type === "tool_use") {
        toolStartTimes.set(msg.toolCallId, Date.now());
        toolCallsById.set(msg.toolCallId, {
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          args: msg.args,
        });
      } else if (msg.type === "tool_result") {
        const existing = toolCallsById.get(msg.toolCallId);
        const startedAt = toolStartTimes.get(msg.toolCallId);
        const durationMs = startedAt ? Date.now() - startedAt : undefined;
        if (existing) {
          existing.result = msg.content;
          existing.isError = msg.isError;
          existing.durationMs = durationMs;
        } else {
          toolCallsById.set(msg.toolCallId, {
            toolCallId: msg.toolCallId,
            toolName: msg.toolName,
            args: {},
            result: msg.content,
            isError: msg.isError,
            durationMs,
          });
        }
      } else if (msg.type === "delta" && msg.deltaType === "text") {
        commentary += msg.content;
      } else if (msg.type === "assistant") {
        stopReason = msg.stopReason;
        if (msg.stopReason === "error") {
          errorMessage = msg.errorMessage || msg.content || "Model error";
          break;
        }
        // Fallback: some providers only emit full content on the assistant
        // message, not via deltas. Capture that as commentary if deltas were
        // empty.
        if (!commentary && msg.content) {
          commentary = msg.content;
        }
      } else if (msg.type === "system" && msg.subtype === "error") {
        errorMessage = msg.content || "Agent system error";
        break;
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Probe query failed";
  }

  let usage: ProbeResult["usage"];
  try {
    const costs = result.costs();
    if (costs) {
      const c = costs as unknown as Record<string, number>;
      usage = {
        inputTokens: c.inputTokens ?? 0,
        outputTokens: c.outputTokens ?? 0,
        totalTokens: c.totalTokens ?? 0,
        costUsd: c.costUsd ?? 0,
      };
    }
  } catch {
    // costs() may not be available on all providers — ignore
  }

  return {
    ok: !errorMessage,
    commentary,
    toolCalls: Array.from(toolCallsById.values()),
    stopReason,
    error: errorMessage,
    durationMs: Date.now() - startTs,
    usage,
  };
}
