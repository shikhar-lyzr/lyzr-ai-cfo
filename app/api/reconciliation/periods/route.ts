import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReconciliationStats } from "@/lib/reconciliation/stats";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

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
