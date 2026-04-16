import { query } from "gitclaw";
import type { GCMessage, Query } from "gitclaw";
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "@/lib/db";
import { createFinancialTools } from "./tools";
import { buildAllowedTools } from "./allowed-tools";

function resolveAgentDir(): string {
  const source = join(process.cwd(), "agent");
  // On AWS Lambda / Netlify Functions, /var/task is read-only but gitclaw
  // needs to write .gitagent/ state inside the agent dir. Stage a writable
  // copy under /tmp once per cold start.
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const writable = join(tmpdir(), "agent");
    if (!existsSync(writable)) {
      cpSync(source, writable, { recursive: true });
    }
    return writable;
  }
  return source;
}

const AGENT_DIR = resolveAgentDir();

/**
 * Pre-load all skill SKILL.md files so the agent has them in-context.
 *
 * Pre-load all skill instructions into the system prompt as a latency
 * optimization. Gitclaw's default skill system tells the model to call
 * `read skills/<name>/SKILL.md` which costs an extra tool round-trip per
 * skill activation. Inlining them removes that overhead and guarantees
 * availability regardless of the `read` tool's behavior through the
 * Lyzr API proxy.
 */
function loadSkillContent(): string {
  const skillsDir = join(AGENT_DIR, "skills");
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return "";
  }

  const parts: string[] = [];
  for (const name of entries) {
    const dir = join(skillsDir, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const filePath = join(dir, "SKILL.md");
    try {
      const content = readFileSync(filePath, "utf-8");
      parts.push(`<skill name="${name}">\n${content}\n</skill>`);
    } catch {
      // no SKILL.md, skip
    }
  }

  if (parts.length === 0) return "";
  return (
    "## Pre-loaded Skill Instructions\n" +
    "The following skill instructions are available. Use the matching skill " +
    "when the user's request fits its description. You do NOT need to call " +
    "the `read` tool — the full content is already here.\n\n" +
    parts.join("\n\n")
  );
}

// Cache once at module load — skill files don't change at runtime
const SKILL_CONTENT = loadSkillContent();

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

  // Append pre-loaded skills so the agent can use them without `read`
  if (SKILL_CONTENT) {
    parts.push(SKILL_CONTENT);
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
      allowedTools: buildAllowedTools(tools),
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
1. Call the \`memory\` tool with action="load" first to recall what you already know about this business
2. Use analyze_financial_data with dataSourceId="${dataSourceId}" to identify ALL variances exceeding the 5% threshold
3. Compile ALL significant variances into a single array and use the create_actions tool to bulk-insert them into the user's feed in ONE step. Apply your severity rules:
   - critical: >20% variance
   - warning: 10-20% variance
   - info: 5-10% variance
4. Include clear headlines, dollar-amount details, and identify the driver for each action
5. After all actions are created, call generate_variance_report to gather summary data, then compose a professional Monthly Variance Report in markdown and call save_document to persist it
6. **Reflect and learn**: if this upload revealed any durable fact about the business (a recurring vendor or category dominating OpEx, an unusual category mix, a likely business model signal, a recurring data-quality issue), append it to memory via \`memory\` action="save" with a short \`learned: ...\` commit message. Skip this step if nothing new was learned — do NOT save noise.
7. Provide a brief executive summary of the findings and mention the generated report

Do NOT skip any significant variances and DO NOT create actions individually. The user depends on you to catch everything above threshold using a single batch insertion.`;

  console.log("[analyzeUpload] starting query for", dataSourceId);
  const result = query({
    prompt,
    dir: AGENT_DIR,
    model: MODEL,
    systemPromptSuffix: context,
    tools,
    allowedTools: buildAllowedTools(tools),
    maxTurns: 10,
    constraints: { temperature: 0.3 },
  });

  let fullText = "";
  let msgCount = 0;

  for await (const msg of result) {
    msgCount++;
    if (msg.type === "delta" && msg.deltaType === "text") {
      fullText += msg.content;
    } else if (msg.type === "assistant") {
      console.log("[analyzeUpload] assistant msg:", {
        stopReason: msg.stopReason,
        contentLen: msg.content?.length,
        errorMessage: msg.errorMessage,
      });
      if (!fullText && msg.content) fullText = msg.content;
    } else if (msg.type === "system") {
      console.log("[analyzeUpload] system msg:", msg.subtype, msg.content?.slice(0, 300));
    } else if (msg.type === "tool_use") {
      console.log("[analyzeUpload] tool_use:", msg.toolName);
    } else if (msg.type === "tool_result") {
      console.log("[analyzeUpload] tool_result:", msg.toolName, msg.isError ? "ERROR" : "ok", msg.content?.slice(0, 200));
    }
  }

  console.log("[analyzeUpload] done. messages:", msgCount, "textLen:", fullText.length);
  return fullText;
}

/**
 * Run an agent query for AR upload analysis — returns the full response.
 */
export async function analyzeArUpload(
  userId: string,
  dataSourceId: string,
  fileName: string,
  invoiceCount: number
): Promise<string> {
  ensureApiKey();

  const context = await buildContext(userId);
  const tools = createFinancialTools(userId);

  const prompt = `A new AR aging CSV "${fileName}" was just uploaded with ${invoiceCount} invoices (data source ID: ${dataSourceId}).

Execute this workflow:
1. Call the \`memory\` tool with action="load" first to recall what you already know about this user's customer base and collection patterns
2. Call scan_ar_aging with dataSourceId="${dataSourceId}"
3. Compile eligible invoices into a single batch and call create_ar_actions
4. For each newly-created action, call draft_dunning_email with the bucket-appropriate tone
5. Call generate_ar_summary to gather summary data, then compose a professional AR Aging Summary in markdown and call save_document to persist it
6. **Reflect and learn**: if you noticed a chronic late-payer, a customer concentration risk, or a pattern in which buckets dominate, append it to memory via \`memory\` action="save" with a short \`learned: ...\` commit message. Skip this step if nothing new was learned.
7. Provide a brief summary of total overdue balance, top three items, and mention the generated report

Do not create actions for invoices in cooldown or snoozed.`;

  console.log("[analyzeArUpload] starting query for", dataSourceId);
  const result = query({
    prompt,
    dir: AGENT_DIR,
    model: MODEL,
    systemPromptSuffix: context,
    tools,
    allowedTools: buildAllowedTools(tools),
    maxTurns: 10,
    constraints: { temperature: 0.3 },
  });

  let fullText = "";
  let msgCount = 0;

  for await (const msg of result) {
    msgCount++;
    if (msg.type === "delta" && msg.deltaType === "text") {
      fullText += msg.content;
    } else if (msg.type === "assistant") {
      console.log("[analyzeArUpload] assistant msg:", {
        stopReason: msg.stopReason,
        contentLen: msg.content?.length,
        errorMessage: msg.errorMessage,
      });
      if (!fullText && msg.content) fullText = msg.content;
    } else if (msg.type === "system") {
      console.log("[analyzeArUpload] system msg:", msg.subtype, msg.content?.slice(0, 300));
    } else if (msg.type === "tool_use") {
      console.log("[analyzeArUpload] tool_use:", msg.toolName);
    } else if (msg.type === "tool_result") {
      console.log("[analyzeArUpload] tool_result:", msg.toolName, msg.isError ? "ERROR" : "ok", msg.content?.slice(0, 200));
    }
  }

  console.log("[analyzeArUpload] done. messages:", msgCount, "textLen:", fullText.length);
  return fullText;
}

/**
 * Run an agent query to generate a report on demand.
 */
export async function generateReport(
  userId: string,
  type: "variance_report" | "ar_summary"
): Promise<string> {
  ensureApiKey();

  const context = await buildContext(userId);
  const tools = createFinancialTools(userId);

  const prompt = type === "variance_report"
    ? `Generate a comprehensive Monthly Variance Report. Steps:
1. Call generate_variance_report to gather all variance data across all data sources
2. Compose a professional markdown report with: executive summary, top variances by impact, category breakdown, and recommended actions
3. Call save_document with type="variance_report", a descriptive title including the current date, and the full markdown body
4. Confirm the report was saved.`
    : `Generate a comprehensive AR Aging Summary. Steps:
1. Call generate_ar_summary to gather all AR/invoice data across all data sources
2. Compose a professional markdown report with: total outstanding balance, aging bucket breakdown, recent dunning activity, escalation candidates, and recommended next steps
3. Call save_document with type="ar_summary", a descriptive title including the current date, and the full markdown body
4. Confirm the report was saved.`;

  const result = query({
    prompt,
    dir: AGENT_DIR,
    model: MODEL,
    systemPromptSuffix: context,
    tools,
    allowedTools: buildAllowedTools(tools),
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
