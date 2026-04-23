// Pure data gatherers for the generate-report flow. These are called
// directly from lib/agent/index.ts::generateReport (server-driven path) and
// also surface as LLM tools (generate_variance_report / generate_ar_summary)
// inside lib/agent/tools.ts for chat-side agent use.
//
// Keeping the computation here means the server can assemble the report
// inputs deterministically without depending on the model successfully
// orchestrating a multi-tool call chain. The previous flow asked the agent
// to (1) call the data tool, (2) compose markdown, (3) call save_document —
// when the model skipped any step no Document persisted at all.

import { prisma } from "@/lib/db";

export type VarianceReportData = {
  totalRecords: number;
  totalActual: number;
  totalBudget: number;
  totalVariance: number;
  totalVariancePct: number;
  actionCounts: { critical: number; warning: number; info: number };
  categoryBreakdown: Array<{
    category: string;
    actual: number;
    budget: number;
    variance: number;
    variancePct: string;
    lineItems: number;
  }>;
  topVariances: Array<{
    headline: string;
    detail: string;
    driver: string;
    severity: string;
  }>;
};

export async function gatherVarianceReportData(
  userId: string,
  dataSourceId?: string,
): Promise<VarianceReportData | null> {
  const dsWhere: Record<string, unknown> = { userId, status: "ready" };
  if (dataSourceId) dsWhere.id = dataSourceId;

  const [records, actions] = await Promise.all([
    prisma.financialRecord.findMany({
      where: { dataSource: dsWhere },
      include: { dataSource: { select: { name: true } } },
    }),
    prisma.action.findMany({
      where: {
        userId,
        type: "variance",
        ...(dataSourceId ? { sourceDataSourceId: dataSourceId } : {}),
      },
      orderBy: { severity: "asc" },
    }),
  ]);

  if (records.length === 0) return null;

  const totalActual = records.reduce((s, r) => s + r.actual, 0);
  const totalBudget = records.reduce((s, r) => s + r.budget, 0);
  const totalVariance = totalActual - totalBudget;
  const totalVariancePct = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

  const byCategory = new Map<string, { actual: number; budget: number; count: number }>();
  for (const r of records) {
    const existing = byCategory.get(r.category) ?? { actual: 0, budget: 0, count: 0 };
    existing.actual += r.actual;
    existing.budget += r.budget;
    existing.count += 1;
    byCategory.set(r.category, existing);
  }
  const categoryBreakdown = Array.from(byCategory.entries()).map(([cat, data]) => ({
    category: cat,
    actual: data.actual,
    budget: data.budget,
    variance: data.actual - data.budget,
    variancePct:
      data.budget > 0
        ? (((data.actual - data.budget) / data.budget) * 100).toFixed(1)
        : "N/A",
    lineItems: data.count,
  }));

  const critical = actions.filter((a) => a.severity === "critical").length;
  const warning = actions.filter((a) => a.severity === "warning").length;
  const info = actions.filter((a) => a.severity === "info").length;

  const topVariances = actions.slice(0, 10).map((a) => ({
    headline: a.headline,
    detail: a.detail,
    driver: a.driver,
    severity: a.severity,
  }));

  return {
    totalRecords: records.length,
    totalActual,
    totalBudget,
    totalVariance,
    totalVariancePct,
    actionCounts: { critical, warning, info },
    categoryBreakdown,
    topVariances,
  };
}

export type ArSummaryData = {
  totalInvoices: number;
  totalOutstanding: number;
  buckets: { current: number; days1to14: number; days15to44: number; days45plus: number };
  bucketAmounts: { current: number; days1to14: number; days15to44: number; days45plus: number };
  activity: { sent: number; snoozed: number; escalated: number; pending: number };
  escalationCandidates: Array<{
    invoiceNumber: string;
    customer: string;
    amount: number;
    daysOverdue: number;
  }>;
};

export async function gatherArSummaryData(
  userId: string,
  dataSourceId?: string,
): Promise<ArSummaryData | null> {
  const dsWhere: Record<string, unknown> = { userId, status: "ready" };
  if (dataSourceId) dsWhere.id = dataSourceId;

  const [invoices, actions] = await Promise.all([
    prisma.invoice.findMany({
      where: { dataSource: dsWhere },
      include: { dataSource: { select: { name: true } } },
    }),
    prisma.action.findMany({
      where: {
        userId,
        type: "ar_followup",
        ...(dataSourceId ? { sourceDataSourceId: dataSourceId } : {}),
      },
    }),
  ]);

  if (invoices.length === 0) return null;

  const now = new Date();
  const open = invoices.filter((i) => i.status === "open");
  const totalOutstanding = open.reduce((s, i) => s + i.amount, 0);

  const buckets = { current: 0, days1to14: 0, days15to44: 0, days45plus: 0 };
  const bucketAmounts = { current: 0, days1to14: 0, days15to44: 0, days45plus: 0 };
  for (const inv of open) {
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
    if (daysOverdue < 1) {
      buckets.current++;
      bucketAmounts.current += inv.amount;
    } else if (daysOverdue < 15) {
      buckets.days1to14++;
      bucketAmounts.days1to14 += inv.amount;
    } else if (daysOverdue < 45) {
      buckets.days15to44++;
      bucketAmounts.days15to44 += inv.amount;
    } else {
      buckets.days45plus++;
      bucketAmounts.days45plus += inv.amount;
    }
  }

  const sent = actions.filter((a) => a.status === "approved").length;
  const snoozed = invoices.filter((i) => i.status === "snoozed").length;
  const escalated = invoices.filter((i) => i.status === "escalated").length;
  const pending = actions.filter((a) => a.status === "pending").length;

  const escalationCandidates = invoices
    .filter((i) => {
      if (i.status !== "open") return false;
      const days = Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000);
      return days >= 45;
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((i) => ({
      invoiceNumber: i.invoiceNumber,
      customer: i.customer,
      amount: i.amount,
      daysOverdue: Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000),
    }));

  return {
    totalInvoices: invoices.length,
    totalOutstanding,
    buckets,
    bucketAmounts,
    activity: { sent, snoozed, escalated, pending },
    escalationCandidates,
  };
}
