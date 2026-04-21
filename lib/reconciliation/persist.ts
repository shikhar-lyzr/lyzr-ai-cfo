import { prisma } from "@/lib/db";
import { runMatchRun } from "./match-engine";
import { ageDays, ageBucket, severity, severityRank } from "./ageing";
import { parseGlCsv } from "@/lib/csv/gl-parser";
import { parseSubLedgerCsv } from "@/lib/csv/sub-ledger-parser";
import { parseFxRatesCsv } from "@/lib/csv/fx-rates-parser";
import { periodKeyFromDate, upsertPeriod } from "./period";
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  StrategyConfig,
  FXRateInput,
} from "./types";

export async function loadLedgerEntries(
  userId: string,
  periodKey: string
): Promise<{
  gl: GLEntryInput[];
  sub: SubLedgerEntryInput[];
}> {
  const gl = await prisma.gLEntry.findMany({
    where: { periodKey, dataSource: { userId, status: "ready" } },
    orderBy: { entryDate: "asc" },
  });
  const sub = await prisma.subLedgerEntry.findMany({
    where: { periodKey, dataSource: { userId, status: "ready" } },
    orderBy: { entryDate: "asc" },
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
  periodKey: string,
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
        periodKey,
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
          const sev = severity(days, entry.baseAmount);
          return {
            matchRunId: run.id,
            side: b.side,
            entryId: b.entryId,
            amount: entry.amount,
            baseAmount: entry.baseAmount,
            txnCurrency: entry.txnCurrency,
            ageDays: days,
            ageBucket: ageBucket(days),
            severity: sev,
            severityRank: severityRank(sev),
            status: "open",
          };
        }),
      });
    }

    return run.id;
  }, { timeout: 30_000 });

  const { escalateQualifyingBreaks } = await import("./escalation");
  const escalated = await escalateQualifyingBreaks(userId, runId);
  if (escalated > 0) {
    console.log(`[reconciliation] escalated ${escalated} break(s) to Actions for run ${runId}`);
  }

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
    const sev = severity(days, entry.baseAmount);
    await prisma.break.update({
      where: { id: b.id },
      data: {
        ageDays: days,
        ageBucket: ageBucket(days),
        severity: sev,
        severityRank: severityRank(sev),
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

export async function ingestFxRates(
  userId: string,
  fileName: string,
  csvHeaders: string[],
  csvRows: string[][]
) {
  const rates = parseFxRatesCsv(csvHeaders, csvRows);

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "fx",
      name: fileName,
      status: "processing",
      metadata: JSON.stringify({ headers: csvHeaders }),
    },
  });

  // Chunking to avoid exhausting the connection pool, but no interactive transaction
  // because that causes timeouts and "Transaction not found" errors on Neon.
  // Flip the DataSource to "error" if any chunk fails so it doesn't stay in "processing".
  try {
    const chunkSize = 50;
    for (let i = 0; i < rates.length; i += chunkSize) {
      const chunk = rates.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((r) =>
          prisma.fXRate.upsert({
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
    }
  } catch (err) {
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "error" },
    });
    throw err;
  }

  const updated = await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: { status: "ready", recordCount: rates.length },
  });

  return { dataSource: updated, ratesLoaded: rates.length };
}

export async function ingestGl(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
) {
  const rates = await loadFxRates();
  const { entries, skipped } = await parseGlCsv(headers, rows, rates);
  const periodSet = new Set<string>();
  const stamped = entries.map((e) => {
    const periodKey = periodKeyFromDate(e.entryDate);
    periodSet.add(periodKey);
    return { ...e, periodKey };
  });
  const { dataSource } = await prisma.$transaction(
    async (tx) => {
      const ds = await tx.dataSource.create({
        data: {
          userId, type: "gl", name: fileName, status: "processing",
          metadata: JSON.stringify({ headers }),
        },
      });
      if (stamped.length > 0) {
        await tx.gLEntry.createMany({
          data: stamped.map((e) => ({ ...e, dataSourceId: ds.id })),
        });
      }
      await tx.dataSource.update({
        where: { id: ds.id },
        data: { status: "ready", recordCount: stamped.length },
      });
      return { dataSource: ds, skipped };
    },
    { timeout: 30_000 }
  );
  const periodsTouched = [...periodSet];
  for (const pk of periodsTouched) {
    await upsertPeriod(prisma, userId, pk);
  }
  return { dataSource, skipped, periodsTouched };
}

export async function ingestSubLedger(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
) {
  const rates = await loadFxRates();
  const { entries, skipped } = await parseSubLedgerCsv(headers, rows, rates);
  const periodSet = new Set<string>();
  const stamped = entries.map((e) => {
    const periodKey = periodKeyFromDate(e.entryDate);
    periodSet.add(periodKey);
    return { ...e, periodKey };
  });
  const { dataSource } = await prisma.$transaction(
    async (tx) => {
      const ds = await tx.dataSource.create({
        data: {
          userId, type: "sub_ledger", name: fileName, status: "processing",
          metadata: JSON.stringify({ headers }),
        },
      });
      if (stamped.length > 0) {
        await tx.subLedgerEntry.createMany({
          data: stamped.map((e) => ({ ...e, dataSourceId: ds.id })),
        });
      }
      await tx.dataSource.update({
        where: { id: ds.id },
        data: { status: "ready", recordCount: stamped.length },
      });
      return { dataSource: ds, skipped };
    },
    { timeout: 30_000 }
  );
  const periodsTouched = [...periodSet];
  for (const pk of periodsTouched) {
    await upsertPeriod(prisma, userId, pk);
  }
  return { dataSource, skipped, periodsTouched };
}

export async function userHasBothLedgers(userId: string): Promise<boolean> {
  const [gl, sub] = await Promise.all([
    prisma.dataSource.count({ where: { userId, type: "gl", status: "ready" } }),
    prisma.dataSource.count({ where: { userId, type: "sub_ledger", status: "ready" } }),
  ]);
  return gl > 0 && sub > 0;
}
