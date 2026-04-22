import { prisma } from "@/lib/db";

export type Tier = "Ready" | "Caution" | "Not Ready";

export function scoreToTier(score: number): Tier {
  if (score >= 85) return "Ready";
  if (score >= 60) return "Caution";
  return "Not Ready";
}

export type Readiness =
  | { hasData: false }
  | {
      hasData: true;
      score: number;
      tier: Tier;
      narrative: string;
      signals: {
        matchRate: number;
        openBreakPenalty: number;
        freshnessPenalty: number;
        variancePenalty: number;
      };
    };

const REQUIRED_SOURCE_TYPES = ["gl", "subledger", "variance"] as const;
const VARIANCE_THRESHOLD = 0.15;

export async function getCloseReadiness(userId: string, periodKey: string): Promise<Readiness> {
  const [lastRun, sources, records] = await Promise.all([
    prisma.matchRun.findFirst({
      where: { userId, periodKey },
      orderBy: { startedAt: "desc" },
    }),
    prisma.dataSource.findMany({ where: { userId }, select: { type: true } }),
    prisma.financialRecord.findMany({
      where: { dataSource: { userId }, period: periodKey },
      select: { category: true, actual: true, budget: true },
    }),
  ]);

  const hasAnySignal = !!lastRun || sources.length > 0 || records.length > 0;
  if (!hasAnySignal) return { hasData: false };

  // 1) Match rate — 40%
  let matchRate = 0;
  if (lastRun) {
    const total = lastRun.totalGL + lastRun.totalSub;
    // matched counts pairs; multiply by 2 to compare against combined entry count
    matchRate = total === 0 ? 0 : (lastRun.matched * 2) / total;
  }

  // 2) Open break severity — 20%. Penalty scales with count, age, and severity.
  const openBreaks = lastRun
    ? await prisma.break.findMany({
        where: { matchRunId: lastRun.id, status: "open" },
        select: { severity: true, ageDays: true },
      })
    : [];
  const weightedBreak = openBreaks.reduce((acc, b) => {
    const sev = b.severity === "high" ? 3 : b.severity === "medium" ? 2 : 1;
    // age normalization: breaks older than 30 days saturate
    const age = Math.min(b.ageDays / 30, 1);
    // 0.5 baseline so a brand-new break still contributes
    return acc + sev * (0.5 + age);
  }, 0);
  // 10 weighted units → full penalty
  const openBreakPenalty = Math.min(weightedBreak / 10, 1);

  // 3) Freshness — 20%. Missing required source types → proportional penalty.
  const haveTypes = new Set(sources.map((s) => s.type));
  const missing = REQUIRED_SOURCE_TYPES.filter((t) => !haveTypes.has(t)).length;
  const freshnessPenalty = missing / REQUIRED_SOURCE_TYPES.length;

  // 4) Variance anomalies — 20%. Aggregate by category first (a period can
  // have one row per month), then count unique categories whose combined
  // actual deviates beyond VARIANCE_THRESHOLD.
  const varianceByCategory = new Map<string, { actual: number; budget: number }>();
  for (const r of records) {
    const prev = varianceByCategory.get(r.category) ?? { actual: 0, budget: 0 };
    varianceByCategory.set(r.category, {
      actual: prev.actual + r.actual,
      budget: prev.budget + r.budget,
    });
  }
  let anomalies = 0;
  for (const { actual, budget } of varianceByCategory.values()) {
    if (budget === 0) continue;
    if (Math.abs(actual - budget) / Math.abs(budget) > VARIANCE_THRESHOLD) anomalies++;
  }
  const variancePenalty = Math.min(anomalies / 5, 1);

  const score = Math.round(
    100 *
      (0.4 * matchRate +
        0.2 * (1 - openBreakPenalty) +
        0.2 * (1 - freshnessPenalty) +
        0.2 * (1 - variancePenalty))
  );

  const tier = scoreToTier(score);
  const narrativeParts: string[] = [];
  if (openBreaks.length > 0)
    narrativeParts.push(
      `${openBreaks.length} open break${openBreaks.length === 1 ? "" : "s"}`
    );
  if (missing > 0) narrativeParts.push(`${missing} missing data source${missing === 1 ? "" : "s"}`);
  if (anomalies > 0) narrativeParts.push(`${anomalies} variance anomal${anomalies === 1 ? "y" : "ies"}`);
  const narrative =
    narrativeParts.length === 0
      ? `${score}% — ${tier}. Period is clean.`
      : `${score}% — ${tier}. ${narrativeParts.join("; ")}.`;

  return {
    hasData: true,
    score,
    tier,
    narrative,
    signals: { matchRate, openBreakPenalty, freshnessPenalty, variancePenalty },
  };
}

export type Blocker =
  | { kind: "break"; breakId: string; ref: string; amount: number; ageDays: number; severity: string }
  | { kind: "missing_source"; sourceType: string }
  | { kind: "variance"; category: string; actual: number; budget: number; pct: number };

export async function getCloseBlockers(userId: string, periodKey: string): Promise<Blocker[]> {
  const [lastRun, sources, records] = await Promise.all([
    prisma.matchRun.findFirst({
      where: { userId, periodKey },
      orderBy: { startedAt: "desc" },
    }),
    prisma.dataSource.findMany({ where: { userId }, select: { type: true } }),
    prisma.financialRecord.findMany({
      where: { dataSource: { userId }, period: periodKey },
      select: { category: true, actual: true, budget: true },
    }),
  ]);

  const blockers: Blocker[] = [];

  if (lastRun) {
    const breaks = await prisma.break.findMany({
      where: { matchRunId: lastRun.id, status: "open" },
      orderBy: [{ severityRank: "desc" }, { ageDays: "desc" }],
      take: 5,
      select: { id: true, side: true, entryId: true, baseAmount: true, ageDays: true, severity: true },
    });
    const glIds = breaks.filter((b) => b.side === "gl_only").map((b) => b.entryId);
    const subIds = breaks.filter((b) => b.side !== "gl_only").map((b) => b.entryId);
    const [glEntries, subEntries] = await Promise.all([
      glIds.length
        ? prisma.gLEntry.findMany({
            where: { id: { in: glIds } },
            select: { id: true, reference: true },
          })
        : Promise.resolve([] as { id: string; reference: string }[]),
      subIds.length
        ? prisma.subLedgerEntry.findMany({
            where: { id: { in: subIds } },
            select: { id: true, reference: true },
          })
        : Promise.resolve([] as { id: string; reference: string }[]),
    ]);
    const glRefs = new Map(glEntries.map((e) => [e.id, e.reference]));
    const subRefs = new Map(subEntries.map((e) => [e.id, e.reference]));
    for (const b of breaks) {
      const ref = (b.side === "gl_only" ? glRefs : subRefs).get(b.entryId) ?? "(missing)";
      blockers.push({
        kind: "break",
        breakId: b.id,
        ref,
        amount: b.baseAmount,
        ageDays: b.ageDays,
        severity: b.severity,
      });
    }
  }

  const haveTypes = new Set(sources.map((s) => s.type));
  for (const t of REQUIRED_SOURCE_TYPES) {
    if (!haveTypes.has(t)) blockers.push({ kind: "missing_source", sourceType: t });
  }

  // Aggregate records by category before checking the threshold. A period like
  // "2026-Q1" can have three rows (Jan, Feb, Mar) per category — without this
  // the same category surfaces up to three times as a blocker.
  const byCategory = new Map<string, { actual: number; budget: number }>();
  for (const r of records) {
    const prev = byCategory.get(r.category) ?? { actual: 0, budget: 0 };
    byCategory.set(r.category, { actual: prev.actual + r.actual, budget: prev.budget + r.budget });
  }
  for (const [category, { actual, budget }] of byCategory) {
    if (budget === 0) continue;
    const pct = (actual - budget) / Math.abs(budget);
    if (Math.abs(pct) > VARIANCE_THRESHOLD) {
      blockers.push({ kind: "variance", category, actual, budget, pct });
    }
  }

  return blockers;
}
