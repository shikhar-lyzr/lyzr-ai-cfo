import { prisma } from "@/lib/db";
import { runMatchRun } from "./match-engine";
import { ageDays, ageBucket, severity } from "./ageing";
import { parseGlCsv } from "@/lib/csv/gl-parser";
import { parseSubLedgerCsv } from "@/lib/csv/sub-ledger-parser";
import { parseFxRatesCsv } from "@/lib/csv/fx-rates-parser";
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  StrategyConfig,
  FXRateInput,
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
  const runId = await prisma.$transaction(async (tx) => {
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

  const { escalateQualifyingBreaks } = await import("./escalation");
  await escalateQualifyingBreaks(userId, runId);

  return runId;
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

export async function loadFxRates(): Promise<FXRateInput[]> {
  const rows = await prisma.fXRate.findMany();
  return rows.map((r) => ({
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: r.rate,
    asOf: r.asOf,
  }));
}

export async function ingestFxRates(csvHeaders: string[], csvRows: string[][]) {
  const rates = parseFxRatesCsv(csvHeaders, csvRows);
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      rates.map((r) =>
        tx.fXRate.upsert({
          where: {
            fromCurrency_toCurrency_asOf: {
              fromCurrency: r.fromCurrency,
              toCurrency: r.toCurrency,
              asOf: r.asOf,
            },
          },
          create: r,
          update: { rate: r.rate },
        })
      )
    );
  }, { timeout: 30_000 });
  return rates.length;
}

export async function ingestGl(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
) {
  const rates = await loadFxRates();
  const { entries, skipped } = await parseGlCsv(headers, rows, rates);
  const { dataSource } = await prisma.$transaction(
    async (tx) => {
      const ds = await tx.dataSource.create({
        data: {
          userId, type: "gl", name: fileName, status: "processing",
          metadata: JSON.stringify({ headers }),
        },
      });
      if (entries.length > 0) {
        await tx.gLEntry.createMany({
          data: entries.map((e) => ({ ...e, dataSourceId: ds.id })),
        });
      }
      await tx.dataSource.update({
        where: { id: ds.id },
        data: { status: "ready", recordCount: entries.length },
      });
      return { dataSource: ds, skipped };
    },
    { timeout: 30_000 }
  );
  return { dataSource, skipped };
}

export async function ingestSubLedger(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
) {
  const rates = await loadFxRates();
  const { entries, skipped } = await parseSubLedgerCsv(headers, rows, rates);
  const { dataSource } = await prisma.$transaction(
    async (tx) => {
      const ds = await tx.dataSource.create({
        data: {
          userId, type: "sub_ledger", name: fileName, status: "processing",
          metadata: JSON.stringify({ headers }),
        },
      });
      if (entries.length > 0) {
        await tx.subLedgerEntry.createMany({
          data: entries.map((e) => ({ ...e, dataSourceId: ds.id })),
        });
      }
      await tx.dataSource.update({
        where: { id: ds.id },
        data: { status: "ready", recordCount: entries.length },
      });
      return { dataSource: ds, skipped };
    },
    { timeout: 30_000 }
  );
  return { dataSource, skipped };
}

export async function userHasBothLedgers(userId: string): Promise<boolean> {
  const [gl, sub] = await Promise.all([
    prisma.dataSource.count({ where: { userId, type: "gl", status: "ready" } }),
    prisma.dataSource.count({ where: { userId, type: "sub_ledger", status: "ready" } }),
  ]);
  return gl > 0 && sub > 0;
}
