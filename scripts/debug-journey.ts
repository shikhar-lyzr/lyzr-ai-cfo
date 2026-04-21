import { prisma } from "../lib/db";
import { getReconciliationStats, getTopBreaks } from "../lib/reconciliation/stats";
import { buildJourneyContext } from "../lib/agent/journey-context";

async function main() {
  const userId = "cmo11oh6f0000i609ak6lvlim";

  console.log("=== DATA SOURCES ===");
  const ds = await prisma.dataSource.findMany({
    where: { userId },
    select: { id: true, type: true, name: true, status: true, recordCount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const d of ds) {
    console.log(d.type.padEnd(12), d.status.padEnd(12), String(d.recordCount).padStart(5), d.name, d.createdAt.toISOString());
  }

  console.log("\n=== MATCH RUNS ===");
  const runs = await prisma.matchRun.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 5,
  });
  for (const r of runs) {
    console.log(
      r.startedAt.toISOString(),
      "gl/sub:", r.totalGL, "/", r.totalSub,
      "m/p/u:", r.matched, "/", r.partial, "/", r.unmatched,
      "by:", r.triggeredBy,
      r.id
    );
  }

  if (runs[0]) {
    console.log("\n=== LATEST RUN BREAK STATUS ===");
    const breaks = await prisma.break.groupBy({
      by: ["status", "severity"],
      where: { matchRunId: runs[0].id },
      _count: true,
    });
    for (const b of breaks) console.log(b.status, b.severity, b._count);

    const openTotal = await prisma.break.count({ where: { matchRunId: runs[0].id, status: "open" } });
    console.log("open total:", openTotal);
  }

  const newestPeriod = await prisma.reconPeriod.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const periodKey = newestPeriod?.periodKey ?? "";
  console.log("\nusing periodKey:", periodKey || "(none)");

  console.log("\n=== getReconciliationStats ===");
  const stats = await getReconciliationStats(userId, periodKey);
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n=== getTopBreaks(5) ===");
  const top = await getTopBreaks(userId, periodKey, 5);
  console.log(JSON.stringify(top, null, 2));

  console.log("\n=== buildJourneyContext(financial-reconciliation) ===");
  const ctx = await buildJourneyContext(userId, "financial-reconciliation");
  console.log(ctx);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
