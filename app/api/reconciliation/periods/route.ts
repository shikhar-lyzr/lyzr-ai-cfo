import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReconciliationStats } from "@/lib/reconciliation/stats";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.userId;

  const periods = await prisma.reconPeriod.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { periodKey: "desc" }],
  });

  const enriched = await Promise.all(
    periods.map(async (p) => {
      const stats = await getReconciliationStats(userId, p.periodKey);
      const [glCount, subCount] = await Promise.all([
        prisma.gLEntry.count({ where: { dataSource: { userId }, periodKey: p.periodKey } }),
        prisma.subLedgerEntry.count({ where: { dataSource: { userId }, periodKey: p.periodKey } }),
      ]);
      return {
        periodKey: p.periodKey,
        status: p.status,
        lastRunAt: stats.hasData ? stats.lastRunAt : null,
        matchRate: stats.hasData ? stats.matchRate : null,
        openBreakCount: stats.hasData ? stats.openBreakCount : 0,
        openBreakValue: stats.hasData ? stats.openBreakValue : 0,
        hasGl: glCount > 0,
        hasSub: subCount > 0,
      };
    })
  );

  return NextResponse.json(enriched);
}