import { tool } from "gitclaw";
import { prisma } from "@/lib/db";
import {
  loadLedgerEntries,
  saveMatchRun,
  reAgeOpenBreaks,
} from "@/lib/reconciliation/persist";
import { DEFAULT_STRATEGY_CONFIG } from "@/lib/reconciliation/types";

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
        ? await prisma.gLEntry.findMany({
            where,
            take: limit,
            select: {
              id: true,
              entryDate: true,
              account: true,
              reference: true,
              memo: true,
              amount: true,
              txnCurrency: true,
              baseAmount: true,
              debitCredit: true,
              counterparty: true,
              matchStatus: true,
            },
          })
        : await prisma.subLedgerEntry.findMany({
            where,
            take: limit,
            select: {
              id: true,
              entryDate: true,
              account: true,
              reference: true,
              memo: true,
              amount: true,
              txnCurrency: true,
              baseAmount: true,
              counterparty: true,
              matchStatus: true,
              sourceModule: true,
            },
          });

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
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          triggeredBy: true,
          totalGL: true,
          totalSub: true,
          matched: true,
          partial: true,
          unmatched: true,
        },
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
        orderBy: [{ severityRank: "desc" }, { ageDays: "desc" }, { baseAmount: "desc" }],
        take: Math.min(args.limit ?? 25, 50),
        select: {
          id: true,
          side: true,
          entryId: true,
          amount: true,
          baseAmount: true,
          txnCurrency: true,
          ageDays: true,
          ageBucket: true,
          severity: true,
          severityRank: true,
          status: true,
          actionId: true,
        },
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
        orderBy: [{ severityRank: "desc" }, { baseAmount: "desc" }],
        take: 5,
        select: {
          id: true,
          side: true,
          entryId: true,
          amount: true,
          baseAmount: true,
          txnCurrency: true,
          ageDays: true,
          ageBucket: true,
          severity: true,
          severityRank: true,
          status: true,
          actionId: true,
        },
      });
      // Each link covers 2 rows (1 GL + 1 sub), so matched * 2 gives row count reconciled
      const matchRate = lastRun.totalGL + lastRun.totalSub === 0
        ? 0
        : (lastRun.matched * 2) / (lastRun.totalGL + lastRun.totalSub);

      return {
        text:
          `Last run ${lastRun.startedAt.toISOString()}: match rate ${(matchRate * 100).toFixed(1)}%, ` +
          `${openBreaks} open breaks. Top breaks: ${topBreaks.map((b) => `$${b.baseAmount.toFixed(0)} (${b.ageBucket})`).join(", ")}.`,
        details: { lastRun, openBreaks, byBucket, topBreaks, matchRate },
      };
    }
  );

  const runMatching = tool(
    "run_matching",
    "Start a new reconciliation match run with the given strategy config. Auto-escalates qualifying breaks.",
    {
      type: "object",
      properties: {
        strategyConfig: {
          type: "object",
          description: "Override default; fields: exact (bool), tolerance {enabled,amount,daysPlus,daysMinus}, fuzzy {enabled,threshold}",
        },
      },
      required: [],
    },
    async (args) => {
      const { gl, sub } = await loadLedgerEntries(userId);
      if (gl.length === 0 && sub.length === 0) {
        return { text: "No ledger data loaded yet — upload GL and sub-ledger CSVs first.", details: {} };
      }
      const config = { ...DEFAULT_STRATEGY_CONFIG, ...(args.strategyConfig ?? {}) };
      const runId = await saveMatchRun(userId, gl, sub, config, "agent");
      return { text: `Match run ${runId} completed.`, details: { runId } };
    }
  );

  const ageBreaks = tool(
    "age_breaks",
    "Recompute ageing/severity for all currently open breaks as of today.",
    { type: "object", properties: {}, required: [] },
    async () => {
      const updated = await reAgeOpenBreaks(userId);
      return { text: `Re-aged ${updated} open breaks.`, details: { updated } };
    }
  );

  const escalateBreak = tool(
    "escalate_break",
    "Force-create an Action row for a specific break (use when auto-escalation did not pick it up).",
    {
      type: "object",
      properties: { breakId: { type: "string" } },
      required: ["breakId"],
    },
    async (args) => {
      const b = await prisma.break.findFirst({
        where: { id: args.breakId, matchRun: { userId } },
      });
      if (!b) return { text: `Break ${args.breakId} not found.`, details: {} };
      if (b.actionId) return { text: `Break already escalated to action ${b.actionId}.`, details: { actionId: b.actionId } };
      const action = await prisma.action.create({
        data: {
          userId,
          type: "reconciliation_break",
          severity: b.severity,
          headline: `Manual escalation: ${b.side === "gl_only" ? "GL" : "Sub-ledger"} break`,
          detail: `Age ${b.ageDays}d, ${b.baseAmount.toFixed(2)} ${b.txnCurrency}.`,
          driver: "reconciliation",
          status: "pending",
        },
      });
      await prisma.break.update({ where: { id: b.id }, data: { actionId: action.id } });
      return { text: `Escalated break ${b.id} → action ${action.id}.`, details: { actionId: action.id } };
    }
  );

  const proposeAdjustment = tool(
    "propose_adjustment",
    "Create an AdjustmentProposal for a break. Does not post until approved.",
    {
      type: "object",
      properties: {
        breakId: { type: "string" },
        debitAccount: { type: "string" },
        creditAccount: { type: "string" },
        amount: { type: "number" },
        description: { type: "string" },
      },
      required: ["breakId", "debitAccount", "creditAccount", "amount", "description"],
    },
    async (args) => {
      const b = await prisma.break.findFirst({
        where: { id: args.breakId, matchRun: { userId } },
      });
      if (!b) return { text: `Break ${args.breakId} not found.`, details: {} };
      const prop = await prisma.adjustmentProposal.create({
        data: {
          breakId: b.id,
          proposedBy: "agent",
          description: args.description,
          debitAccount: args.debitAccount,
          creditAccount: args.creditAccount,
          amount: args.amount,
          baseAmount: args.amount,
          currency: b.txnCurrency,
          journalDate: new Date(),
          status: "pending",
        },
      });
      return { text: `Proposal ${prop.id} pending. Ask user to approve before posting.`, details: { proposalId: prop.id, proposal: prop } };
    }
  );

  const approveAdjustment = tool(
    "approve_adjustment",
    "Approve a pending AdjustmentProposal. WITHOUT confirm:true, returns a preview only. WITH confirm:true, posts a JournalAdjustment and flips the break to adjusted.",
    {
      type: "object",
      properties: {
        proposalId: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["proposalId"],
    },
    async (args) => {
      const p = await prisma.adjustmentProposal.findUnique({ where: { id: args.proposalId } });
      if (!p) return { text: `Proposal ${args.proposalId} not found.`, details: {} };
      if (p.status !== "pending") return { text: `Proposal already ${p.status}.`, details: { status: p.status } };

      if (!args.confirm) {
        return {
          text:
            `PREVIEW — not posted. DR ${p.debitAccount} / CR ${p.creditAccount} for ${p.amount} ${p.currency}. ` +
            `Description: "${p.description}". Call again with confirm:true to post.`,
          details: { proposal: p, preview: true },
        };
      }

      const result = await prisma.$transaction(async (tx) => {
        const journal = await tx.journalAdjustment.create({
          data: {
            userId,
            proposalId: p.id,
            entryDate: new Date(),
            lines: [
              { account: p.debitAccount, dr: p.amount, cr: 0, baseAmount: p.baseAmount },
              { account: p.creditAccount, dr: 0, cr: p.amount, baseAmount: p.baseAmount },
            ],
          },
        });
        await tx.adjustmentProposal.update({
          where: { id: p.id },
          data: {
            status: "posted",
            approvedBy: userId,
            approvedAt: new Date(),
            postedJournalId: journal.id,
          },
        });
        await tx.break.update({
          where: { id: p.breakId },
          data: { status: "adjusted" },
        });
        return journal.id;
      }, { timeout: 30_000 });

      return { text: `Posted journal ${result}. Break flipped to adjusted.`, details: { journalId: result } };
    }
  );

  return {
    searchLedgerEntries, listMatchRuns, listBreaks, reconciliationSummary,
    runMatching, ageBreaks, escalateBreak, proposeAdjustment, approveAdjustment,
  };
}
