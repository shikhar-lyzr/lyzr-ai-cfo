import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeUpload } from "@/lib/agent";
import { inferColumnMapping } from "@/lib/csv/llm-mapper";

interface ParsedRow {
  account: string;
  period: string;
  actual: number;
  budget: number;
  category: string;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
  return { headers, rows };
}

function autoDetectColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (/account|name|description|line.?item|gl/i.test(h)) mapping.account = i;
    else if (/period|month|date|quarter/i.test(h)) mapping.period = i;
    else if (/actual|spent|real/i.test(h)) mapping.actual = i;
    else if (/budget|plan|forecast|target/i.test(h)) mapping.budget = i;
    else if (/category|type|class|dept|department/i.test(h)) mapping.category = i;
  }

  return mapping;
}

function parseRows(
  rows: string[][],
  mapping: Record<string, number>
): ParsedRow[] {
  return rows
    .filter((row) => row.length > Math.max(...Object.values(mapping)))
    .map((row) => ({
      account: row[mapping.account] ?? "Unknown",
      period: row[mapping.period] ?? "Unknown",
      actual: parseFloat(row[mapping.actual]) || 0,
      budget: parseFloat(row[mapping.budget]) || 0,
      category: row[mapping.category] ?? "General",
    }))
    .filter((r) => r.account !== "Unknown" && (r.actual > 0 || r.budget > 0));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const userId = formData.get("userId") as string | null;

  if (!file || !userId) {
    return NextResponse.json({ error: "file and userId required" }, { status: 400 });
  }

  if (!file.name.endsWith(".csv")) {
    return NextResponse.json({ error: "Only CSV files supported" }, { status: 400 });
  }

  const text = await file.text();
  const { headers, rows } = parseCSV(text);
  let mapping = autoDetectColumns(headers);
  let mappingSource: "regex" | "llm" = "regex";

  // If the regex autodetect couldn't find required columns, fall back to the
  // LLM mapper. This handles non-standard headers like "Cost Center" / "Spend"
  // that the regex doesn't catch.
  if (mapping.account === undefined || mapping.actual === undefined) {
    console.log(
      "[upload] regex mapping incomplete, trying LLM mapper. headers:",
      headers
    );
    try {
      const llmMapping = await inferColumnMapping(headers, rows);
      if (llmMapping) {
        mapping = llmMapping;
        mappingSource = "llm";
        console.log("[upload] LLM mapping succeeded:", llmMapping);
      } else {
        return NextResponse.json(
          {
            error:
              "Could not detect required columns (account, actual) via either regex or AI mapping. Please ensure your CSV has columns for account/line-item names and actual/spent amounts.",
          },
          { status: 422 }
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "RATE_LIMIT") {
        return NextResponse.json(
          {
            error: "AI column mapper rate limit reached. Please wait 60 seconds and try again.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Mapping failed" }, { status: 500 });
    }
  }

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "csv",
      name: file.name,
      status: "processing",
      metadata: JSON.stringify({ headers, mapping }),
    },
  });

  const parsedRows = parseRows(rows, mapping);

  for (const row of parsedRows) {
    await prisma.financialRecord.create({
      data: {
        dataSourceId: dataSource.id,
        ...row,
      },
    });
  }

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: {
      status: "ready",
      recordCount: parsedRows.length,
    },
  });
  // === PATH A: Agent-first architecture ===
  // The gitclaw agent is the sole engine for variance detection and action creation.
  // It uses analyze_financial_data to compute variances and create_action to surface items.
  // No deterministic JS fallback — the agent IS the product.

  if (!process.env.OPENAI_API_KEY && !process.env.LYZR_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI engine not configured. Set LYZR_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY." },
      { status: 503 }
    );
  }

  let agentAnalysis: string | null = null;
  try {
    agentAnalysis = await analyzeUpload(
      userId,
      dataSource.id,
      file.name,
      parsedRows.length
    );
  } catch (err) {
    console.error("[upload] agent analysis failed:", err);
    // Partial success — records saved but agent couldn't create actions
    const fallbackCount = await prisma.action.count({
      where: { userId, sourceDataSourceId: dataSource.id },
    });
    return NextResponse.json({
      dataSource: {
        id: dataSource.id,
        name: dataSource.name,
        recordCount: parsedRows.length,
      },
      actionsGenerated: fallbackCount,
      agentAnalysis: null,
      mapping,
      mappingSource,
      warning: "AI analysis failed — data saved but actions may be incomplete",
    });
  }

  const finalActionCount = await prisma.action.count({
    where: { userId, sourceDataSourceId: dataSource.id },
  });

  return NextResponse.json({
    dataSource: {
      id: dataSource.id,
      name: dataSource.name,
      recordCount: parsedRows.length,
    },
    actionsGenerated: finalActionCount,
    agentAnalysis,
    mapping,
    mappingSource,
  });
}
