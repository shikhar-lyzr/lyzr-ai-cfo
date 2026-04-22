import { prisma } from "@/lib/db";

export type TaskCard = {
  key: "subledger" | "gl" | "variance" | "journal" | "package";
  label: string;
  completed: number;
  total: number;
  isEmpty: boolean;
  cta?: { label: string; href: string };
};

export async function deriveTaskCounts(userId: string, periodKey: string): Promise<TaskCard[]> {
  const [subMatched, subTotal, glMatched, glTotal, varianceDoc, journalCount, lastRun, pkgDoc] =
    await Promise.all([
      prisma.subLedgerEntry.count({
        where: { dataSource: { userId }, periodKey, matchStatus: { not: "unmatched" } },
      }),
      prisma.subLedgerEntry.count({ where: { dataSource: { userId }, periodKey } }),
      prisma.gLEntry.count({
        where: { dataSource: { userId }, periodKey, matchStatus: { not: "unmatched" } },
      }),
      prisma.gLEntry.count({ where: { dataSource: { userId }, periodKey } }),
      prisma.document.findFirst({
        where: { userId, type: "variance_report", period: periodKey },
        select: { id: true },
      }),
      prisma.journalAdjustment.count({ where: { userId } }),
      prisma.matchRun.findFirst({
        where: { userId, periodKey },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      }),
      prisma.document.findFirst({
        where: { userId, type: "close_package", period: periodKey },
        select: { id: true },
      }),
    ]);

  const expectedAdjustments = lastRun
    ? await prisma.break.count({ where: { matchRunId: lastRun.id, status: "open", ageDays: { gte: 7 } } })
    : 0;

  return [
    {
      key: "subledger",
      label: "Sub-ledger Close",
      completed: subMatched,
      total: subTotal,
      isEmpty: subTotal === 0,
      cta: subTotal === 0 ? { label: "Upload sub-ledger", href: "/data-sources?tab=reconciliation" } : undefined,
    },
    {
      key: "gl",
      label: "GL Entries",
      completed: glMatched,
      total: glTotal,
      isEmpty: glTotal === 0,
      cta: glTotal === 0 ? { label: "Upload GL", href: "/data-sources?tab=reconciliation" } : undefined,
    },
    {
      key: "variance",
      label: "Variance Review",
      completed: varianceDoc ? 1 : 0,
      total: 1,
      isEmpty: false,
      cta: varianceDoc ? undefined : { label: "Generate variance report", href: "/documents" },
    },
    {
      key: "journal",
      label: "Journal Adjustments",
      completed: journalCount,
      total: expectedAdjustments,
      isEmpty: expectedAdjustments === 0 && journalCount === 0,
    },
    {
      key: "package",
      label: "Close Package",
      completed: pkgDoc ? 1 : 0,
      total: 1,
      isEmpty: false,
    },
  ];
}
