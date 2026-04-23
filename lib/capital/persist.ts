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

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "capital_components",
      name: fileName,
      status: "processing",
      metadata: JSON.stringify({ headers, shape: "capital_components" }),
      contentHash,
    },
  });

  if (components.length > 0) {
    await prisma.capitalComponent.createMany({
      data: components.map((c) => ({
        dataSourceId: dataSource.id,
        periodKey: c.periodKey,
        component: c.component,
        amount: c.amount,
        currency: c.currency,
      })),
    });
  }

  const periodsTouched = [...new Set(components.map((c) => c.periodKey))];
  for (const pk of periodsTouched) {
    await upsertCapitalPeriod(userId, pk);
  }

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: { status: "ready", recordCount: components.length },
  });

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

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "rwa_breakdown",
      name: fileName,
      status: "processing",
      metadata: JSON.stringify({ headers, shape: "rwa_breakdown" }),
      contentHash,
    },
  });

  if (lines.length > 0) {
    await prisma.rwaLine.createMany({
      data: lines.map((l) => ({
        dataSourceId: dataSource.id,
        periodKey: l.periodKey,
        riskType: l.riskType,
        exposureClass: l.exposureClass,
        exposureAmount: l.exposureAmount,
        riskWeight: l.riskWeight,
        rwa: l.rwa,
      })),
    });
  }

  const periodsTouched = [...new Set(lines.map((l) => l.periodKey))];
  for (const pk of periodsTouched) {
    await upsertCapitalPeriod(userId, pk);
  }

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: { status: "ready", recordCount: lines.length },
  });

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
