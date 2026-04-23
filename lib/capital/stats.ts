import { prisma } from "@/lib/db";
import { effectiveMinimum, type RatioKey } from "./minimums";

const RWA_MISMATCH_THRESHOLD = 0.01; // 1%

export type ComponentInput = {
  periodKey: string;
  component: string; // one of KNOWN_COMPONENTS at runtime
  amount: number;
  currency: string;
};

export type RwaLineInput = {
  periodKey: string;
  riskType: string;
  exposureClass: string;
  exposureAmount: number;
  riskWeight: number;
  rwa: number;
};

export type RwaMismatch = {
  capitalTotal: number;
  rwaLineTotal: number;
  deltaPct: number;
};

export type Snapshot =
  | { hasData: false }
  | {
      hasData: true;
      cet1Ratio: number;
      tier1Ratio: number;
      totalRatio: number;
      cet1Capital: number;
      tier1Capital: number;
      totalCapital: number;
      totalRwa: number;
      rwaMismatch: RwaMismatch | null;
    };

export function dedupeComponents(rows: ComponentInput[]): ComponentInput[] {
  const seen = new Set<string>();
  const out: ComponentInput[] = [];
  for (const r of rows) {
    const key = `${r.periodKey}|${r.component}|${r.amount}|${r.currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function computeSnapshot(
  components: ComponentInput[],
  rwaLines: RwaLineInput[],
): Snapshot {
  if (components.length === 0) return { hasData: false };

  const deduped = dedupeComponents(components);
  const sum = (name: string) =>
    deduped.filter((c) => c.component === name).reduce((s, c) => s + c.amount, 0);

  const cet1Gross = sum("cet1_capital");
  const at1 = sum("additional_tier1");
  const tier2 = sum("tier2");
  const goodwill = sum("goodwill");
  const dta = sum("dta");
  const otherDeductions = sum("other_deduction");
  const totalRwa = sum("total_rwa");

  if (totalRwa <= 0) return { hasData: false };

  const deductions = goodwill + dta + otherDeductions;
  const cet1Capital = cet1Gross - deductions;
  const tier1Capital = cet1Capital + at1;
  const totalCapital = tier1Capital + tier2;

  const rwaLineTotal = rwaLines.reduce((s, l) => s + l.rwa, 0);
  let rwaMismatch: RwaMismatch | null = null;
  if (rwaLines.length > 0) {
    const deltaPct = Math.abs(totalRwa - rwaLineTotal) / Math.abs(totalRwa);
    // Strict `>`: exactly 1% is within tolerance. Documented threshold
    // means "up to and including 1%" — do not flip to `>=`.
    if (deltaPct > RWA_MISMATCH_THRESHOLD) {
      rwaMismatch = { capitalTotal: totalRwa, rwaLineTotal, deltaPct };
    }
  }

  return {
    hasData: true,
    cet1Capital,
    tier1Capital,
    totalCapital,
    totalRwa,
    cet1Ratio: cet1Capital / totalRwa,
    tier1Ratio: tier1Capital / totalRwa,
    totalRatio: totalCapital / totalRwa,
    rwaMismatch,
  };
}

export type Breach =
  | {
      kind: "ratio_breach";
      ratio: RatioKey;
      value: number;
      minimum: number;
      gap: number;
    }
  | {
      kind: "missing_source";
      sourceType: "capital_components" | "rwa_breakdown";
    }
  | {
      kind: "rwa_mismatch";
      capitalTotal: number;
      rwaLineTotal: number;
      deltaPct: number;
    };

export type RwaBreakdownRow = {
  riskType: string;
  totalRwa: number;
  share: number;
  lineCount: number;
  lines: { exposureClass: string; exposureAmount: number; riskWeight: number; rwa: number }[];
};

// ── DB-backed read helpers. These pull rows for the period and delegate
//    to the pure functions above. Tested in persist.test.ts via integration.

/**
 * Read the persisted capital snapshot for a period, with `rwaMismatch`
 * recomputed fresh from current RwaLine rows.
 *
 * **Incomplete signal on its own.** If the user deleted the rwa_breakdown
 * upload after the snapshot was persisted, this function will return
 * `rwaMismatch: null` (because there are no RwaLine rows to compare
 * against), but the snapshot's ratios were computed with an earlier RWA
 * breakdown that disagreed. Callers should pair this with
 * getCapitalBreaches(), which emits a `missing_source: rwa_breakdown`
 * warning when RWA lines are absent for the period.
 */
export async function getCapitalSnapshot(
  userId: string,
  periodKey: string,
): Promise<Snapshot> {
  const row = await prisma.capitalSnapshot.findUnique({
    where: { userId_periodKey: { userId, periodKey } },
  });
  if (!row) return { hasData: false };

  // Also refresh rwaMismatch from current RwaLine rows, since the snapshot
  // itself only persists the numbers — the mismatch flag is derived.
  const rwaLines = await prisma.rwaLine.findMany({
    where: { periodKey, dataSource: { userId, status: "ready" } },
    select: { rwa: true },
  });
  const rwaLineTotal = rwaLines.reduce((s, l) => s + l.rwa, 0);
  let rwaMismatch: RwaMismatch | null = null;
  if (rwaLines.length > 0 && row.totalRwa > 0) {
    const deltaPct = Math.abs(row.totalRwa - rwaLineTotal) / Math.abs(row.totalRwa);
    if (deltaPct > RWA_MISMATCH_THRESHOLD) {
      rwaMismatch = { capitalTotal: row.totalRwa, rwaLineTotal, deltaPct };
    }
  }

  return {
    hasData: true,
    cet1Ratio: row.cet1Ratio,
    tier1Ratio: row.tier1Ratio,
    totalRatio: row.totalRatio,
    cet1Capital: row.cet1Capital,
    tier1Capital: row.tier1Capital,
    totalCapital: row.totalCapital,
    totalRwa: row.totalRwa,
    rwaMismatch,
  };
}

export async function getRwaBreakdown(
  userId: string,
  periodKey: string,
): Promise<RwaBreakdownRow[]> {
  const lines = await prisma.rwaLine.findMany({
    where: { periodKey, dataSource: { userId, status: "ready" } },
    select: {
      riskType: true,
      exposureClass: true,
      exposureAmount: true,
      riskWeight: true,
      rwa: true,
    },
  });
  if (lines.length === 0) return [];

  const total = lines.reduce((s, l) => s + l.rwa, 0);
  const byType = new Map<string, RwaBreakdownRow>();
  for (const l of lines) {
    const existing = byType.get(l.riskType) ?? {
      riskType: l.riskType,
      totalRwa: 0,
      share: 0,
      lineCount: 0,
      lines: [],
    };
    existing.totalRwa += l.rwa;
    existing.lineCount += 1;
    existing.lines.push({
      exposureClass: l.exposureClass,
      exposureAmount: l.exposureAmount,
      riskWeight: l.riskWeight,
      rwa: l.rwa,
    });
    byType.set(l.riskType, existing);
  }
  for (const row of byType.values()) {
    row.share = total === 0 ? 0 : row.totalRwa / total;
  }
  return [...byType.values()].sort((a, b) => b.totalRwa - a.totalRwa);
}

export async function getCapitalBreaches(
  userId: string,
  periodKey: string,
): Promise<Breach[]> {
  const breaches: Breach[] = [];
  const snap = await getCapitalSnapshot(userId, periodKey);

  // Detect which uploads are present for this period (scoped to this user).
  const [compCount, rwaCount] = await Promise.all([
    prisma.capitalComponent.count({
      where: { periodKey, dataSource: { userId, status: "ready" } },
    }),
    prisma.rwaLine.count({
      where: { periodKey, dataSource: { userId, status: "ready" } },
    }),
  ]);

  if (compCount === 0) {
    breaches.push({ kind: "missing_source", sourceType: "capital_components" });
  }
  if (rwaCount === 0) {
    breaches.push({ kind: "missing_source", sourceType: "rwa_breakdown" });
  }

  if (snap.hasData) {
    const checks: RatioKey[] = ["cet1", "tier1", "total"];
    for (const key of checks) {
      const value =
        key === "cet1" ? snap.cet1Ratio : key === "tier1" ? snap.tier1Ratio : snap.totalRatio;
      const minimum = effectiveMinimum(key);
      // Strict `<`: a ratio exactly at the minimum is compliant, not a breach.
      // Parity with ratioStatus() in minimums.ts — don't flip this to `<=`.
      if (value < minimum) {
        breaches.push({
          kind: "ratio_breach",
          ratio: key,
          value,
          minimum,
          gap: minimum - value,
        });
      }
    }
    if (snap.rwaMismatch) {
      breaches.push({ kind: "rwa_mismatch", ...snap.rwaMismatch });
    }
  }

  return breaches;
}
