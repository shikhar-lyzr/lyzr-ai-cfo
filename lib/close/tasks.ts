import { prisma } from "@/lib/db";
import { expandPeriodKey } from "./period-expansion";

// Breaks older than a week are expected to require a journal adjustment by close.
const EXPECTED_ADJUSTMENT_AGE_DAYS = 7;

export type TaskCard = {
  key: "subledger" | "gl" | "variance" | "journal" | "package";
  label: string;
  completed: number;
  total: number;
  isEmpty: boolean;
  cta?: { label: string; href: string };
};

export async function deriveTaskCounts(userId: string, periodKey: string): Promise<TaskCard[]> {
  const expanded = expandPeriodKey(periodKey);
  // Recon-keyed tables (GLEntry/SubLedgerEntry/MatchRun/Break) store monthly
  // periodKeys only. A quarterly/yearly selector on the close page must
  // aggregate across those months. Document.period is preserved verbatim
  // because Documents are generated with the user-visible label.
  const reconScope = { dataSource: { userId }, periodKey: { in: expanded } } as const;

  const [subMatched, subTotal, glMatched, glTotal, varianceDoc, journalCount, runs, pkgDoc] =
    await Promise.all([
      prisma.subLedgerEntry.count({
        where: { ...reconScope, matchStatus: { not: "unmatched" } },
      }),
      prisma.subLedgerEntry.count({ where: reconScope }),
      prisma.gLEntry.count({
        where: { ...reconScope, matchStatus: { not: "unmatched" } },
      }),
      prisma.gLEntry.count({ where: reconScope }),
      prisma.document.findFirst({
        where: { userId, type: "variance_report", period: periodKey },
        select: { id: true },
      }),
      prisma.journalAdjustment.count({ where: { userId } }),
      prisma.matchRun.findMany({
        where: { userId, periodKey: { in: expanded } },
        select: { id: true },
      }),
      prisma.document.findFirst({
        where: { userId, type: "close_package", period: periodKey },
        select: { id: true },
      }),
    ]);

  const runIds = runs.map((r) => r.id);
  const expectedAdjustments = runIds.length
    ? await prisma.break.count({
        where: { matchRunId: { in: runIds }, status: "open", ageDays: { gte: EXPECTED_ADJUSTMENT_AGE_DAYS } },
      })
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
