import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeUpload } from "@/lib/agent";

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
  const mapping = autoDetectColumns(headers);

  if (mapping.account === undefined || mapping.actual === undefined) {
    return NextResponse.json(
      { error: "Could not detect required columns (account, actual). Please check your CSV format." },
      { status: 422 }
    );
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

  const variances = parsedRows
    .filter((r) => r.budget > 0)
    .map((r) => {
      const pct = ((r.actual - r.budget) / r.budget) * 100;
      return { ...r, variancePercent: pct };
    })
    .filter((r) => Math.abs(r.variancePercent) > 5)
    .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));

  for (const v of variances) {
    const isOver = v.variancePercent > 0;
    const severity =
      Math.abs(v.variancePercent) > 20
        ? "critical"
        : Math.abs(v.variancePercent) > 10
          ? "warning"
          : "info";

    await prisma.action.create({
      data: {
        userId,
        type: "variance",
        severity,
        headline: `${v.account} ${isOver ? "over" : "under"} budget by ${Math.abs(v.variancePercent).toFixed(1)}%`,
        detail: `$${(v.actual / 1000).toFixed(1)}K actual vs $${(v.budget / 1000).toFixed(1)}K planned`,
        driver: `Variance of $${((v.actual - v.budget) / 1000).toFixed(1)}K in ${v.category}`,
        sourceDataSourceId: dataSource.id,
      },
    });
  }

  // Run agent analysis if configured
  let agentAnalysis: string | null = null;
  const agentAvailable = !!process.env.LYZR_API_KEY;

  if (agentAvailable) {
    try {
      agentAnalysis = await analyzeUpload(
        userId,
        dataSource.id,
        file.name,
        parsedRows.length
      );
    } catch {
      // Agent analysis is non-blocking — basic variances are already generated
      agentAnalysis = null;
    }
  }

  return NextResponse.json({
    dataSource: {
      id: dataSource.id,
      name: dataSource.name,
      recordCount: parsedRows.length,
    },
    actionsGenerated: variances.length,
    agentAnalysis,
    mapping,
  });
}
