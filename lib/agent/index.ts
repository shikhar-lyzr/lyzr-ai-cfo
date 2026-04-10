import { query } from "gitclaw";
import type { GCMessage, Query } from "gitclaw";
import { prisma } from "@/lib/db";
import { createFinancialTools } from "./tools";

const AGENT_DIR = process.cwd() + "/agent";

// Inject the Lyzr Key as OpenAI compatible key for gitclaw pi-ai router
if (process.env.LYZR_API_KEY && !process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.LYZR_API_KEY;
}

// We use the lyzr provider pattern specified by the GitClaw docs to securely
// route the LLM operations to the Lyzr Agent Engine using the provided ID.
// Note: the actual agent _id (69d43cce...) differs from the Studio URL slug.
const MODEL = "lyzr:69d43ccef008dd037bad64d7@https://agent-prod.studio.lyzr.ai/v4";

function ensureApiKey(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI API Key (or LYZR_API_KEY proxy) is not set");
  }
}

/**
 * Build system prompt context with the user's financial data summary.
 */
async function buildContext(
  userId: string,
  actionId?: string
): Promise<string> {
  const [dataSources, pendingActions, recentMessages, actionEvents] = await Promise.all([
    prisma.dataSource.findMany({
      where: { userId, status: "ready" },
      select: { id: true, name: true, recordCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.action.findMany({
      where: { userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
    prisma.actionEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { action: { select: { headline: true, severity: true } } },
    }),
  ]);

  const parts: string[] = [];

  // Data sources
  if (dataSources.length > 0) {
    parts.push(
      "## Active Data Sources\n" +
        dataSources
          .map((ds) => `- ${ds.name} (${ds.recordCount} records, ID: ${ds.id})`)
          .join("\n")
    );
  } else {
    parts.push(
      "## No Data Sources\nThe user has not uploaded any financial data yet. Suggest they upload a CSV with budget vs actual figures."
    );
  }

  // Pending actions
  if (pendingActions.length > 0) {
    parts.push(
      "## Open Actions (" +
        pendingActions.length +
        ")\n" +
        pendingActions
          .map(
            (a) =>
              `- [${a.severity.toUpperCase()}] ${a.headline}: ${a.detail} (ID: ${a.id})`
          )
          .join("\n")
    );
  }

  // Specific action context
  if (actionId) {
    const action = await prisma.action.findUnique({
      where: { id: actionId },
    });
    if (action) {
      parts.push(
        `## Current Action Context\nThe user is asking about: "${action.headline}"\nDetail: ${action.detail}\nDriver: ${action.driver}\nSeverity: ${action.severity}\nStatus: ${action.status}\nData source: ${action.sourceDataSourceId}`
      );
    }
  }

  // Recent chat history (reversed to chronological)
  if (recentMessages.length > 0) {
    const chronological = recentMessages.reverse();
    parts.push(
      "## Recent Chat History\n" +
        chronological
          .map((m) => `${m.role === "user" ? "User" : "CFO"}: ${m.content.slice(0, 200)}`)
          .join("\n")
    );
  }

  // Decision history — lets the agent learn from user behavior
  if (actionEvents.length > 0) {
    const approved = actionEvents.filter((e) => e.toStatus === "approved").length;
    const flagged = actionEvents.filter((e) => e.toStatus === "flagged").length;
    const dismissed = actionEvents.filter((e) => e.toStatus === "dismissed").length;

    parts.push(
      "## Recent User Decisions\n" +
        `Summary: ${approved} approved, ${flagged} flagged for review, ${dismissed} dismissed (last 20 actions)\n` +
        actionEvents
          .slice(0, 10)
          .map(
            (e) =>
              `- ${e.toStatus.toUpperCase()}: "${e.action.headline}" (${e.action.severity})`
          )
          .join("\n") +
        "\n\nUse this history to prioritize similarly to the user's past preferences."
    );
  }

  return parts.join("\n\n");
}

export interface AgentStreamCallbacks {
  onDelta: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

/**
 * Run an agent query for chat — streams tokens back via callbacks.
 */
export async function chatWithAgent(
  userId: string,
  message: string,
  actionId: string | undefined,
  callbacks: AgentStreamCallbacks
): Promise<void> {
  ensureApiKey();

  const context = await buildContext(userId, actionId);
  const tools = createFinancialTools(userId);

  let result: Query;
  try {
    result = query({
      prompt: message,
      dir: AGENT_DIR,
      model: MODEL,
      systemPromptSuffix: context,
      tools,
      replaceBuiltinTools: true,
      maxTurns: 10,
      constraints: { temperature: 0.3 },
    });
  } catch (err) {
    callbacks.onError(
      err instanceof Error ? err.message : "Failed to start agent query"
    );
    return;
  }

  let fullText = "";

  try {
    for await (const msg of result) {
      if (msg.type === "delta" && msg.deltaType === "text") {
        fullText += msg.content;
        callbacks.onDelta(msg.content);
      } else if (msg.type === "assistant") {
        if (msg.stopReason === "error") {
          callbacks.onError(
            msg.errorMessage || msg.content || "Model returned an error"
          );
          return;
        }
        // Final complete message — use this if we missed deltas
        if (!fullText && msg.content) {
          fullText = msg.content;
          callbacks.onDelta(msg.content);
        }
      } else if (msg.type === "system" && msg.subtype === "error") {
        callbacks.onError(msg.content || "Agent system error");
        return;
      }
    }
  } catch (err) {
    callbacks.onError(
      err instanceof Error ? err.message : "Agent query failed"
    );
    return;
  }

  callbacks.onComplete(fullText);
}

/**
 * Run an agent query for upload analysis — returns the full response.
 */
export async function analyzeUpload(
  userId: string,
  dataSourceId: string,
  fileName: string,
  recordCount: number
): Promise<string> {
  ensureApiKey();

  const context = await buildContext(userId);
  const tools = createFinancialTools(userId);

  const prompt = `A new CSV file "${fileName}" was just uploaded with ${recordCount} financial records (data source ID: ${dataSourceId}).

You are the CFO agent. This is your primary duty: proactive variance detection.

Execute this workflow using your tools:
1. Use analyze_financial_data with dataSourceId="${dataSourceId}" to identify ALL variances exceeding the 5% threshold
2. Compile ALL significant variances into a single array and use the create_actions tool to bulk-insert them into the user's feed in ONE step. Apply your severity rules:
   - critical: >20% variance
   - warning: 10-20% variance  
   - info: 5-10% variance
3. Include clear headlines, dollar-amount details, and identify the driver for each action
4. After all actions are created, provide a brief executive summary of the findings

Do NOT skip any significant variances and DO NOT create actions individually. The user depends on you to catch everything above threshold using a single batch insertion.`;

  const result = query({
    prompt,
    dir: AGENT_DIR,
    model: MODEL,
    systemPromptSuffix: context,
    tools,
    replaceBuiltinTools: true,
    maxTurns: 10,
    constraints: { temperature: 0.3 },
  });

  let fullText = "";

  for await (const msg of result) {
    if (msg.type === "delta" && msg.deltaType === "text") {
      fullText += msg.content;
    } else if (msg.type === "assistant" && !fullText && msg.content) {
      fullText = msg.content;
    }
  }

  return fullText;
}

export type { GCMessage };
