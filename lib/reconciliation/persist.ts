import { prisma } from "@/lib/db";
import { runMatchRun } from "./match-engine";
import { ageDays, ageBucket, severity } from "./ageing";
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  StrategyConfig,
} from "./types";

export async function loadLedgerEntries(userId: string): Promise<{
  gl: GLEntryInput[];
  sub: SubLedgerEntryInput[];
}> {
  const gl = await prisma.gLEntry.findMany({
    where: { dataSource: { userId, status: "ready" } },
  });
  const sub = await prisma.subLedgerEntry.findMany({
    where: { dataSource: { userId, status: "ready" } },
  });

  return {
    gl: gl.map((g) => ({
      id: g.id,
      entryDate: g.entryDate,
      postingDate: g.postingDate,
      account: g.account,
      reference: g.reference,
      memo: g.memo ?? undefined,
      amount: g.amount,
      txnCurrency: g.txnCurrency,
      baseAmount: g.baseAmount,
      debitCredit: g.debitCredit as "DR" | "CR",
      counterparty: g.counterparty ?? undefined,
    })),
    sub: sub.map((s) => ({
      id: s.id,
      sourceModule: s.sourceModule as "AP" | "AR" | "FA",
      entryDate: s.entryDate,
      account: s.account,
      reference: s.reference,
      memo: s.memo ?? undefined,
      amount: s.amount,
      txnCurrency: s.txnCurrency,
      baseAmount: s.baseAmount,
      counterparty: s.counterparty ?? undefined,
    })),
  };
}

export async function saveMatchRun(
  userId: string,
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  config: StrategyConfig,
  triggeredBy: "upload" | "agent" | "manual"
): Promise<string> {
  const result = runMatchRun(gl, sub, config);

  // Wrap the write chain in a transaction so a mid-chain failure cannot leave
  // a MatchRun row whose link/break/status side-effects are partially realized.
  return prisma.$transaction(async (tx) => {
    const run = await tx.matchRun.create({
      data: {
        userId,
        triggeredBy,
        strategyConfig: config,
        totalGL: result.stats.totalGL,
        totalSub: result.stats.totalSub,
        matched: result.stats.matched,
        partial: result.stats.partial,
        unmatched: result.stats.unmatched,
        completedAt: new Date(),
      },
    });

    if (result.links.length > 0) {
      await tx.matchLink.createMany({
        data: result.links.map((l) => ({
          matchRunId: run.id,
          glEntryId: l.glId,
          subEntryId: l.subId,
          strategy: l.strategy,
          confidence: l.confidence,
          amountDelta: l.amountDelta,
          dateDelta: l.dateDelta,
        })),
      });

      const matchedGL = result.links.filter((l) => !l.partial).map((l) => l.glId);
      const partialGL = result.links.filter((l) => l.partial).map((l) => l.glId);
      const matchedSub = result.links.filter((l) => !l.partial).map((l) => l.subId);
      const partialSub = result.links.filter((l) => l.partial).map((l) => l.subId);

      if (matchedGL.length > 0) {
        await tx.gLEntry.updateMany({
          where: { id: { in: matchedGL } },
          data: { matchStatus: "matched" },
        });
      }
      if (partialGL.length > 0) {
        await tx.gLEntry.updateMany({
          where: { id: { in: partialGL } },
          data: { matchStatus: "partial" },
        });
      }
      if (matchedSub.length > 0) {
        await tx.subLedgerEntry.updateMany({
          where: { id: { in: matchedSub } },
          data: { matchStatus: "matched" },
        });
      }
      if (partialSub.length > 0) {
        await tx.subLedgerEntry.updateMany({
          where: { id: { in: partialSub } },
          data: { matchStatus: "partial" },
        });
      }
    }

    if (result.breaks.length > 0) {
      const today = new Date();
      // Invariant: result.breaks only references ids in gl/sub (runMatchRun
      // derives them from the same arrays), so the map lookups are total.
      const glMap = new Map(gl.map((e) => [e.id, e]));
      const subMap = new Map(sub.map((e) => [e.id, e]));

      await tx.break.createMany({
        data: result.breaks.map((b) => {
          const entry =
            b.side === "gl_only" ? glMap.get(b.entryId)! : subMap.get(b.entryId)!;
          const days = ageDays(entry.entryDate, today);
          return {
            matchRunId: run.id,
            side: b.side,
            entryId: b.entryId,
            amount: entry.amount,
            baseAmount: entry.baseAmount,
            txnCurrency: entry.txnCurrency,
            ageDays: days,
            ageBucket: ageBucket(days),
            severity: severity(days, entry.baseAmount),
            status: "open",
          };
        }),
      });
    }

    return run.id;
  }, { timeout: 30_000 });
}

export async function reAgeOpenBreaks(userId: string): Promise<number> {
  const today = new Date();
  const openBreaks = await prisma.break.findMany({
    where: { status: "open", matchRun: { userId } },
  });

  let updated = 0;
  for (const b of openBreaks) {
    const entry =
      b.side === "gl_only"
        ? await prisma.gLEntry.findUnique({ where: { id: b.entryId } })
        : await prisma.subLedgerEntry.findUnique({ where: { id: b.entryId } });
    if (!entry) continue;
    const days = ageDays(entry.entryDate, today);
    await prisma.break.update({
      where: { id: b.id },
      data: {
        ageDays: days,
        ageBucket: ageBucket(days),
        severity: severity(days, entry.baseAmount),
      },
    });
    updated++;
  }
  return updated;
}
