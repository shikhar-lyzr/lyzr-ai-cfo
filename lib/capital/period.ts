import { prisma } from "@/lib/db";

export async function safely<T>(producer: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await producer();
  } catch (err) {
    console.error("[capital] safely() caught:", err);
    return fallback;
  }
}

export type CapitalPeriodSummary = { periodKey: string };

export function resolveActivePeriod(
  periods: { periodKey: string }[],
  requested: string | undefined
): string | null {
  if (periods.length === 0) return null;
  if (requested && periods.some((p) => p.periodKey === requested)) return requested;
  return periods[0].periodKey;
}

export async function listCapitalPeriods(userId: string): Promise<CapitalPeriodSummary[]> {
  const rows = await prisma.capitalPeriod.findMany({
    where: { userId },
    select: { periodKey: true },
    orderBy: [{ createdAt: "desc" }, { periodKey: "desc" }],
  });
  return rows;
}

export async function upsertCapitalPeriod(userId: string, periodKey: string): Promise<void> {
  await prisma.capitalPeriod.upsert({
    where: { userId_periodKey: { userId, periodKey } },
    create: { userId, periodKey, status: "open" },
    update: {},
  });
}
