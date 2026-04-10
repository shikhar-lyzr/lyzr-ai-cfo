/**
 * LLM-powered CSV column mapping fallback.
 *
 * When the regex-based autodetect in the upload route can't find required
 * columns (e.g. headers like "Cost Center" / "Spend" instead of "account" /
 * "actual"), this module asks the LLM to infer the mapping from the headers
 * and a few sample rows. Returns a column-index map compatible with the
 * existing parseRows() pipeline, or null if mapping is impossible.
 *
 * Supports two backends:
 *   1. Lyzr Studio (OpenAI-compatible) — preferred, no rate limits
 *   2. Gemini REST API — legacy fallback
 */

const LYZR_AGENT_ID = "69d43ccef008dd037bad64d7";
const LYZR_BASE_URL = "https://agent-prod.studio.lyzr.ai/v4/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash-lite";

const REQUIRED_FIELDS = ["account", "actual"] as const;
const ALL_FIELDS = ["account", "actual", "period", "budget", "category"] as const;

function buildPrompt(headers: string[], rows: string[][]): string {
  const headerLine = headers.map((h, i) => `${i}: ${h}`).join("\n");
  const sample = rows
    .slice(0, 5)
    .map((r, i) => `row ${i}: ${r.join(" | ")}`)
    .join("\n");

  return `You are a CSV schema mapper for a financial variance analysis tool. Map the columns of this CSV to a known schema by returning column indices.

Schema fields:
- account (REQUIRED): GL account, line item, or cost center name (e.g. "Marketing", "Salaries", "AWS Hosting")
- actual (REQUIRED): the realized or spent amount, parsed as a number
- period (optional): the time period (e.g. "Jan 2025", "Q1 2025", "2025-01")
- budget (optional): the planned, forecast, or target amount, parsed as a number
- category (optional): department, expense type, or grouping (e.g. "OpEx", "Marketing", "G&A")

CSV headers (index: name):
${headerLine}

Sample rows:
${sample}

Respond with ONLY a JSON object mapping each schema field you can confidently identify to its column index. Only include fields you are confident about. Example: {"account": 0, "period": 1, "actual": 2, "budget": 3, "category": 4}. If you cannot identify both required fields (account AND actual), return an empty object {}.`;
}

async function callLyzr(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LYZR_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(LYZR_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LYZR_AGENT_ID,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    console.error("[csv-mapper] Lyzr HTTP", response.status);
    return null;
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data?.choices?.[0]?.message?.content ?? null;
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    console.error("[csv-mapper] Gemini HTTP", response.status);
    return null;
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/**
 * Shared LLM call helper — tries Lyzr then Gemini.
 * Exported for reuse by ar-parser.ts and detect-shape.ts.
 */
export async function callLlm(prompt: string): Promise<string | null> {
  let text: string | null = null;
  try {
    text = await callLyzr(prompt);
  } catch {
    // ignore
  }
  if (!text) {
    try {
      text = await callGemini(prompt);
    } catch {
      // ignore
    }
  }
  return text;
}

export function extractJson(text: string): Record<string, unknown> | null {
  // Try to extract JSON from the response — handle markdown fences
  let clean = text.trim();
  const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) clean = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    console.error("[csv-mapper] model returned non-JSON:", text.slice(0, 200));
  }
  return null;
}

/**
 * LLM-powered CSV shape classification fallback.
 *
 * Called by detect-shape.ts when regex fast-path returns "unknown".
 */
export async function inferCsvShape(
  headers: string[]
): Promise<"variance" | "ar" | "unknown"> {
  const headerLine = headers.map((h, i) => `${i}: ${h}`).join(", ");
  const prompt = `You are a CSV classifier for a financial tool. Given these CSV column headers, classify the data shape.

Headers: ${headerLine}

Rules:
- "variance" = budget vs actual financial comparison (has columns like budget, actual, forecast, plan, spent)
- "ar" = accounts receivable / invoice aging (has columns like invoice number, due date, customer, amount due)
- "unknown" = neither pattern matches

Respond with ONLY a JSON object: {"shape": "variance"} or {"shape": "ar"} or {"shape": "unknown"}`;

  const text = await callLlm(prompt);
  if (!text) return "unknown";

  const obj = extractJson(text);
  if (!obj) return "unknown";

  const shape = obj.shape;
  if (shape === "variance" || shape === "ar") return shape;
  return "unknown";
}

export async function inferColumnMapping(
  headers: string[],
  rows: string[][]
): Promise<Record<string, number> | null> {
  const prompt = buildPrompt(headers, rows);

  // Try Lyzr first (no rate limits), then fall back to Gemini
  let text: string | null = null;
  try {
    text = await callLyzr(prompt);
  } catch (err) {
    // Re-throw rate limit errors
    if (err instanceof Error && err.message === "RATE_LIMIT") throw err;
    console.error("[csv-mapper] Lyzr call failed:", err);
  }

  if (!text) {
    try {
      text = await callGemini(prompt);
    } catch (err) {
      if (err instanceof Error && err.message === "RATE_LIMIT") throw err;
      console.error("[csv-mapper] Gemini call failed:", err);
    }
  }

  if (!text) return null;

  const obj = extractJson(text);
  if (!obj) return null;

  const mapping: Record<string, number> = {};
  for (const field of ALL_FIELDS) {
    const v = obj[field];
    if (
      typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v < headers.length
    ) {
      mapping[field] = v;
    }
  }

  for (const f of REQUIRED_FIELDS) {
    if (mapping[f] === undefined) return null;
  }

  return mapping;
}
