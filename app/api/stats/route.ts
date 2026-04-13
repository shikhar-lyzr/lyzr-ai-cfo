import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  const [actionGroups, invoices, records] = await Promise.all([
    prisma.action.groupBy({
      by: ["severity"],
      where: { userId },
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { dataSource: { userId } },
      select: { dueDate: true, status: true },
    }),
    prisma.financialRecord.findMany({
      where: { dataSource: { userId } },
      select: { category: true, actual: true, budget: true },
    }),
  ]);

  // Action counts
  const actionCounts = { critical: 0, warning: 0, info: 0, total: 0 };
  for (const g of actionGroups) {
    const sev = g.severity as "critical" | "warning" | "info";
    if (sev in actionCounts) {
      actionCounts[sev] = g._count;
    }
    actionCounts.total += g._count;
  }

  // AR aging buckets
  let ar: { info: number; warning: number; critical: number; total: number } | null = null;
  const openInvoices = invoices.filter((i) => i.status !== "paid");
  if (openInvoices.length > 0) {
    const now = Date.now();
    ar = { info: 0, warning: 0, critical: 0, total: openInvoices.length };
    for (const inv of openInvoices) {
      const daysOverdue = Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000);
      if (daysOverdue <= 0) ar.info++;
      else if (daysOverdue <= 30) ar.warning++;
      else ar.critical++;
    }
  }

  // Top variance categories
  const categoryMap = new Map<string, number>();
  for (const r of records) {
    const prev = categoryMap.get(r.category) ?? 0;
    categoryMap.set(r.category, prev + (r.actual - r.budget));
  }
  const topCategories = [...categoryMap.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([category, variance]) => ({
      category,
      variance: Math.round(variance),
      direction: (variance > 0 ? "over" : "under") as "over" | "under",
    }));

  return NextResponse.json({ actions: actionCounts, ar, topCategories });
}
