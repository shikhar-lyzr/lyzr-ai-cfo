import { prisma } from "@/lib/db";
import {
  parseCapitalComponents,
  parseRwaBreakdown,
  type SkippedRow,
} from "@/lib/csv/capital-parser";
import { computeSnapshot, type ComponentInput, type RwaLineInput } from "./stats";
import { upsertCapitalPeriod } from "./period";

export async function ingestCapitalComponents(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][],
  contentHash: string,
): Promise<{
  dataSource: { id: string; name: string; recordCount: number };
  skipped: SkippedRow[];
  periodsTouched: string[];
}> {
  const { components, skipped } = parseCapitalComponents(headers, rows);

  const periodsTouched = [...new Set(components.map((c) => c.periodKey))];

  // Wrap the DataSource write chain in a transaction so a mid-chain failure
  // cannot leave a DataSource stranded in status="processing" with orphan
  // CapitalComponent rows. Period upsert and snapshot recompute stay outside
  // the transaction — they're idempotent recompute work, not part of the
  // indivisible ingest unit. Matches the lib/reconciliation/persist.ts
  // pattern on ingestGl/ingestSubLedger.
  const dataSource = await prisma.$transaction(
    async (tx) => {
      const ds = await tx.dataSource.create({
        data: {
          userId,
          type: "capital_components",
          name: fileName,
          status: "processing",
          metadata: JSON.stringify({ headers, shape: "capital_components" }),
          contentHash,
        },
      });

      await tx.capitalComponent.createMany({
        data: components.map((c) => ({
          dataSourceId: ds.id,
          periodKey: c.periodKey,
          component: c.component,
          amount: c.amount,
          currency: c.currency,
        })),
      });

      return tx.dataSource.update({
        where: { id: ds.id },
        data: { status: "ready", recordCount: components.length },
      });
    },
    { timeout: 30_000 },
  );

  for (const pk of periodsTouched) {
    await upsertCapitalPeriod(userId, pk);
  }

  for (const pk of periodsTouched) {
    await recomputeCapitalSnapshot(userId, pk);
  }

  return {
    dataSource: { id: dataSource.id, name: dataSource.name, recordCount: components.length },
    skipped,
    periodsTouched,
  };
}

export async function ingestRwaBreakdown(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][],
  contentHash: string,
): Promise<{
  dataSource: { id: string; name: string; recordCount: number };
  skipped: SkippedRow[];
  periodsTouched: string[];
}> {
  const { lines, skipped } = parseRwaBreakdown(headers, rows);

  const periodsTouched = [...new Set(lines.map((l) => l.periodKey))];

  // Wrap the DataSource write chain in a transaction so a mid-chain failure
  // cannot leave a DataSource stranded in status="processing" with orphan
  // RwaLine rows. Period upsert and snapshot recompute stay outside the
  // transaction — they're idempotent recompute work, not part of the
  // indivisible ingest unit. Matches the lib/reconciliation/persist.ts
  // pattern on ingestGl/ingestSubLedger.
  const dataSource = await prisma.$transaction(
    async (tx) => {
      const ds = await tx.dataSource.create({
        data: {
          userId,
          type: "rwa_breakdown",
          name: fileName,
          status: "processing",
          metadata: JSON.stringify({ headers, shape: "rwa_breakdown" }),
          contentHash,
        },
      });

      await tx.rwaLine.createMany({
        data: lines.map((l) => ({
          dataSourceId: ds.id,
          periodKey: l.periodKey,
          riskType: l.riskType,
          exposureClass: l.exposureClass,
          exposureAmount: l.exposureAmount,
          riskWeight: l.riskWeight,
          rwa: l.rwa,
        })),
      });

      return tx.dataSource.update({
        where: { id: ds.id },
        data: { status: "ready", recordCount: lines.length },
      });
    },
    { timeout: 30_000 },
  );

  for (const pk of periodsTouched) {
    await upsertCapitalPeriod(userId, pk);
  }

  for (const pk of periodsTouched) {
    await recomputeCapitalSnapshot(userId, pk);
  }

  return {
    dataSource: { id: dataSource.id, name: dataSource.name, recordCount: lines.length },
    skipped,
    periodsTouched,
  };
}

export async function recomputeCapitalSnapshot(
  userId: string,
  periodKey: string,
): Promise<void> {
  const [compRows, rwaRows] = await Promise.all([
    prisma.capitalComponent.findMany({
      where: { periodKey, dataSource: { userId, status: "ready" } },
      select: { periodKey: true, component: true, amount: true, currency: true },
    }),
    prisma.rwaLine.findMany({
      where: { periodKey, dataSource: { userId, status: "ready" } },
      select: {
        periodKey: true,
        riskType: true,
        exposureClass: true,
        exposureAmount: true,
        riskWeight: true,
        rwa: true,
      },
    }),
  ]);

  const snap = computeSnapshot(
    compRows as ComponentInput[],
    rwaRows as RwaLineInput[],
  );

  if (!snap.hasData) {
    // Remove stale snapshot if one exists (e.g., a prior upload was deleted
    // and there's no longer enough data to compute ratios).
    await prisma.capitalSnapshot.deleteMany({
      where: { userId, periodKey },
    });
    return;
  }

  await prisma.capitalSnapshot.upsert({
    where: { userId_periodKey: { userId, periodKey } },
    create: {
      userId,
      periodKey,
      cet1Ratio: snap.cet1Ratio,
      tier1Ratio: snap.tier1Ratio,
      totalRatio: snap.totalRatio,
      cet1Capital: snap.cet1Capital,
      tier1Capital: snap.tier1Capital,
      totalCapital: snap.totalCapital,
      totalRwa: snap.totalRwa,
    },
    update: {
      cet1Ratio: snap.cet1Ratio,
      tier1Ratio: snap.tier1Ratio,
      totalRatio: snap.totalRatio,
      cet1Capital: snap.cet1Capital,
      tier1Capital: snap.tier1Capital,
      totalCapital: snap.totalCapital,
      totalRwa: snap.totalRwa,
      computedAt: new Date(),
    },
  });
}
