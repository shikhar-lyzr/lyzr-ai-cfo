import { tool } from "gitclaw";
import { prisma } from "@/lib/db";

export function createReconciliationTools(userId: string) {
  const searchLedgerEntries = tool(
    "search_ledger_entries",
    "Query GL or sub-ledger entries by side, reference, account, counterparty, or status.",
    {
      type: "object",
      properties: {
        side: { type: "string", enum: ["gl", "sub_ledger"], description: "which ledger to search" },
        reference: { type: "string" },
        account: { type: "string" },
        counterparty: { type: "string" },
        status: { type: "string", description: "matchStatus filter" },
        limit: { type: "number" },
      },
      required: ["side"],
    },
    async (args) => {
      const limit = Math.min(args.limit ?? 25, 50);
      const where: Record<string, unknown> = {
        dataSource: { userId, status: "ready" },
      };
      if (args.reference) where.reference = { contains: args.reference };
      if (args.account) where.account = { contains: args.account };
      if (args.counterparty) where.counterparty = { contains: args.counterparty };
      if (args.status) where.matchStatus = args.status;

      const rows = args.side === "gl"
        ? await prisma.gLEntry.findMany({ where, take: limit })
        : await prisma.subLedgerEntry.findMany({ where, take: limit });

      return {
        text: `Found ${rows.length} ${args.side} entries.`,
        details: { count: rows.length, rows },
      };
    }
  );

  const listMatchRuns = tool(
    "list_match_runs",
    "Return recent reconciliation match runs with their stats.",
    {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
    async (args) => {
      const runs = await prisma.matchRun.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: Math.min(args.limit ?? 10, 25),
      });
      return { text: `${runs.length} match run(s).`, details: { runs } };
    }
  );

  const listBreaks = tool(
    "list_breaks",
    "Filter open (or closed) breaks by side, age, severity, status. Returns up to 50.",
    {
      type: "object",
      properties: {
        side: { type: "string" },
        ageBucket: { type: "string" },
        severity: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
    async (args) => {
      const where: Record<string, unknown> = { matchRun: { userId } };
      if (args.side) where.side = args.side;
      if (args.ageBucket) where.ageBucket = args.ageBucket;
      if (args.severity) where.severity = args.severity;
      where.status = args.status ?? "open";

      const breaks = await prisma.break.findMany({
        where,
        orderBy: [{ severity: "desc" }, { ageDays: "desc" }, { baseAmount: "desc" }],
        take: Math.min(args.limit ?? 25, 50),
      });
      return { text: `${breaks.length} breaks matching filter.`, details: { count: breaks.length, breaks } };
    }
  );

  const reconciliationSummary = tool(
    "reconciliation_summary",
    "Summary of the latest reconciliation state: match rate, break counts, top breaks.",
    { type: "object", properties: {}, required: [] },
    async () => {
      const lastRun = await prisma.matchRun.findFirst({
        where: { userId },
        orderBy: { startedAt: "desc" },
      });
      if (!lastRun) {
        return {
          text: "No reconciliation has been run. Upload GL and sub-ledger CSVs to start.",
          details: { lastRun: null },
        };
      }
      const openBreaks = await prisma.break.count({
        where: { matchRunId: lastRun.id, status: "open" },
      });
      const byBucket = await prisma.break.groupBy({
        by: ["ageBucket"],
        _count: true,
        where: { matchRunId: lastRun.id, status: "open" },
      });
      const topBreaks = await prisma.break.findMany({
        where: { matchRunId: lastRun.id, status: "open" },
        orderBy: [{ severity: "desc" }, { baseAmount: "desc" }],
        take: 5,
      });
      const matchRate = lastRun.totalGL + lastRun.totalSub === 0
        ? 0
        : (lastRun.matched + lastRun.partial) / (lastRun.totalGL + lastRun.totalSub);

      return {
        text:
          `Last run ${lastRun.startedAt.toISOString()}: match rate ${(matchRate * 100).toFixed(1)}%, ` +
          `${openBreaks} open breaks. Top breaks: ${topBreaks.map((b) => `$${b.baseAmount.toFixed(0)} (${b.ageBucket})`).join(", ")}.`,
        details: { lastRun, openBreaks, byBucket, topBreaks, matchRate },
      };
    }
  );

  // IMPORTANT: return an ARRAY to match createFinancialTools convention.
  return [searchLedgerEntries, listMatchRuns, listBreaks, reconciliationSummary];
}
