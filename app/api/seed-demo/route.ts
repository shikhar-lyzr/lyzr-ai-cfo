import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeUpload } from "@/lib/agent";

const SAMPLE_RECORDS = [
  { account: "Marketing - Digital Ads", period: "2026-Q1", actual: 19800, budget: 15100, category: "Marketing" },
  { account: "Marketing - Contractors", period: "2026-Q1", actual: 12400, budget: 10400, category: "Marketing" },
  { account: "Marketing - Events", period: "2026-Q1", actual: 8200, budget: 8000, category: "Marketing" },
  { account: "Marketing - Other", period: "2026-Q1", actual: 4800, budget: 5000, category: "Marketing" },
  { account: "Sales - Compensation", period: "2026-Q1", actual: 35200, budget: 33000, category: "Sales" },
  { account: "Sales - Travel", period: "2026-Q1", actual: 12600, budget: 11000, category: "Sales" },
  { account: "Sales - Tools", period: "2026-Q1", actual: 5800, budget: 5500, category: "Sales" },
  { account: "Engineering - Salaries", period: "2026-Q1", actual: 185000, budget: 185000, category: "Engineering" },
  { account: "Engineering - Cloud Infrastructure", period: "2026-Q1", actual: 42000, budget: 32700, category: "Engineering" },
  { account: "Engineering - Software Licenses", period: "2026-Q1", actual: 14200, budget: 12600, category: "Engineering" },
  { account: "Engineering - Contractors", period: "2026-Q1", actual: 28000, budget: 31000, category: "Engineering" },
  { account: "Customer Support - Staff", period: "2026-Q1", actual: 18500, budget: 17000, category: "Customer Support" },
  { account: "Customer Support - Tools", period: "2026-Q1", actual: 4200, budget: 3800, category: "Customer Support" },
  { account: "G&A - Office", period: "2026-Q1", actual: 8900, budget: 9200, category: "G&A" },
  { account: "G&A - Legal", period: "2026-Q1", actual: 15600, budget: 8000, category: "G&A" },
  { account: "G&A - Insurance", period: "2026-Q1", actual: 4500, budget: 4500, category: "G&A" },
  { account: "Revenue - Enterprise", period: "2026-Q1", actual: 320000, budget: 290000, category: "Revenue" },
  { account: "Revenue - SMB", period: "2026-Q1", actual: 145000, budget: 155000, category: "Revenue" },
  { account: "Revenue - Services", period: "2026-Q1", actual: 42000, budget: 40000, category: "Revenue" },
  { account: "R&D - Research", period: "2026-Q1", actual: 22000, budget: 25000, category: "R&D" },
  { account: "R&D - Prototyping", period: "2026-Q1", actual: 8500, budget: 7000, category: "R&D" },
];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, scenario = "variance" } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Check if user already has data
  const existingSources = await prisma.dataSource.count({ where: { userId } });
  if (existingSources > 0) {
    return NextResponse.json({ error: "You already have data uploaded. Go to Data Sources to manage your files." }, { status: 409 });
  }

  if (scenario === "reconciliation") {
    const { seedReconciliation } = await import("@/lib/seed/reconciliation");
    await seedReconciliation(userId);
    return NextResponse.json({ scenario, ok: true });
  }

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "csv",
      name: "Q1_2026_budget_vs_actual.csv",
      status: "ready",
      recordCount: SAMPLE_RECORDS.length,
      metadata: JSON.stringify({ demo: true }),
    },
  });

  for (const record of SAMPLE_RECORDS) {
    await prisma.financialRecord.create({
      data: { dataSourceId: dataSource.id, ...record },
    });
  }

  // === PATH A: Agent creates all actions ===
  // The gitclaw agent analyzes the sample data and creates action items using its tools,
  // just as it does for real CSV uploads. No JS variance loop.
  let actionsGenerated = 0;
  if (process.env.OPENAI_API_KEY || process.env.LYZR_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      await analyzeUpload(userId, dataSource.id, dataSource.name, SAMPLE_RECORDS.length);
      actionsGenerated = await prisma.action.count({
        where: { userId, sourceDataSourceId: dataSource.id },
      });
    } catch (err) {
      console.error("[seed-demo] agent analysis failed:", err);
    }
  }

  return NextResponse.json({
    dataSource: { id: dataSource.id, name: dataSource.name, recordCount: SAMPLE_RECORDS.length },
    actionsGenerated,
  });
}

