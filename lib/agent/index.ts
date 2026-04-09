import { query } from "gitclaw";
import type { GCMessage, Query } from "gitclaw";
import { prisma } from "@/lib/db";
import { createFinancialTools } from "./tools";

const AGENT_DIR = process.cwd() + "/agent";

// gitclaw auto-reads LYZR_API_KEY for the "lyzr" provider (loader.js line 294)
const MODEL = "lyzr:default@https://agent-prod.studio.lyzr.ai/v4";

function ensureApiKey(): void {
  if (!process.env.LYZR_API_KEY) {
    throw new Error("LYZR_API_KEY is not set in .env");
  }
}

/**
 * Build system prompt context with the user's financial data summary.
 */
async function buildContext(
  userId: string,
  actionId?: string
): Promise<string> {
  const [dataSources, pendingActions, recentMessages] = await Promise.all([
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
        // Final complete message — use this if we missed deltas
        if (!fullText && msg.content) {
          fullText = msg.content;
          callbacks.onDelta(msg.content);
        }
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

Analyze the data using analyze_financial_data tool, then:
1. Summarize the key findings
2. Create action items for any significant variances using create_action
3. Provide a brief commentary

Focus on the most impactful variances first.`;

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
