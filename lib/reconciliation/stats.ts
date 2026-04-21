import { prisma } from "@/lib/db";

export async function getReconciliationStats(userId: string, periodKey: string) {
  const lastRun = await prisma.matchRun.findFirst({
    where: { userId, periodKey },
    orderBy: { startedAt: "desc" },
  });
  if (!lastRun) {
    return { hasData: false as const };
  }
  const openBreaks = await prisma.break.findMany({
    where: { matchRunId: lastRun.id, status: "open" },
    select: { side: true, baseAmount: true, ageDays: true },
  });
  const totalEntries = lastRun.totalGL + lastRun.totalSub;
  // Each link pairs one GL row + one sub row, so matched rows covered = matched * 2.
  // partial is a subset of matched — do NOT add it separately.
  const matchRate = totalEntries === 0 ? 0 : (lastRun.matched * 2) / totalEntries;
  const sum = (arr: { baseAmount: number }[]) =>
    arr.reduce((acc, b) => acc + Math.abs(b.baseAmount), 0);
  return {
    hasData: true as const,
    matchRate,
    openBreakCount: openBreaks.length,
    openBreakValue: sum(openBreaks),
    oldestBreakDays: openBreaks.reduce((m, b) => Math.max(m, b.ageDays), 0),
    glOnly: openBreaks.filter((b) => b.side === "gl_only").length,
    subOnly: openBreaks.filter((b) => b.side === "sub_only").length,
    lastRunAt: lastRun.startedAt,
  };
}

export async function getTopBreaks(userId: string, periodKey: string, limit = 10) {
  const lastRun = await prisma.matchRun.findFirst({
    where: { userId, periodKey },
    orderBy: { startedAt: "desc" },
  });
  if (!lastRun) return [];
  const breaks = await prisma.break.findMany({
    where: { matchRunId: lastRun.id, status: "open" },
    orderBy: [{ severityRank: "desc" }, { baseAmount: "desc" }],
    take: limit,
    select: {
      id: true,
      side: true,
      entryId: true,
      baseAmount: true,
      txnCurrency: true,
      ageDays: true,
      severity: true,
    },
  });

  return Promise.all(
    breaks.map(async (b) => {
      const entry =
        b.side === "gl_only"
          ? await prisma.gLEntry.findUnique({
              where: { id: b.entryId },
              select: { reference: true, counterparty: true },
            })
          : await prisma.subLedgerEntry.findUnique({
              where: { id: b.entryId },
              select: { reference: true, counterparty: true },
            });
      return {
        id: b.id,
        ref: entry?.reference ?? "(missing)",
        amount: b.baseAmount,
        currency: b.txnCurrency,
        type: b.side === "gl_only" ? "GL-only" : "Sub-only",
        age: b.ageDays,
        counterparty: entry?.counterparty ?? "—",
        severity: b.severity,
      };
    })
  );
}
