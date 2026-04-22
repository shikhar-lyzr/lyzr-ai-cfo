import { prisma } from "@/lib/db";

export type ClosePeriod = { periodKey: string; source: "recon" | "records" | "both" };

export function resolveActivePeriod(
  periods: { periodKey: string }[],
  requested: string | undefined
): string | null {
  if (periods.length === 0) return null;
  if (requested && periods.some((p) => p.periodKey === requested)) return requested;
  return periods[0].periodKey;
}

export async function listClosePeriods(userId: string): Promise<ClosePeriod[]> {
  const [reconRows, recordRows] = await Promise.all([
    prisma.reconPeriod.findMany({
      where: { userId },
      select: { periodKey: true },
      orderBy: { periodKey: "desc" },
    }),
    prisma.financialRecord.findMany({
      where: { dataSource: { userId } },
      select: { period: true },
      distinct: ["period"],
    }),
  ]);

  const seen = new Map<string, ClosePeriod>();
  for (const r of reconRows) seen.set(r.periodKey, { periodKey: r.periodKey, source: "recon" });
  for (const r of recordRows) {
    const existing = seen.get(r.period);
    seen.set(r.period, { periodKey: r.period, source: existing ? "both" : "records" });
  }
  return [...seen.values()].sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
}
