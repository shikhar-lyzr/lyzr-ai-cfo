import {
  getCapitalSnapshot,
  getCapitalBreaches,
  getRwaBreakdown,
  type Breach,
  type Snapshot,
  type RwaBreakdownRow,
} from "@/lib/capital/stats";
import { effectiveMinimum } from "@/lib/capital/minimums";

export async function buildCapitalContext(
  userId: string,
  periodKey: string,
): Promise<string> {
  const [snap, breaches, rwa] = await Promise.all([
    getCapitalSnapshot(userId, periodKey),
    getCapitalBreaches(userId, periodKey),
    getRwaBreakdown(userId, periodKey),
  ]);

  const header = `## Current Journey: Regulatory Capital — period ${periodKey}`;

  if (!snap.hasData) {
    return (
      `${header}\n` +
      `No capital data yet for ${periodKey}. ` +
      `Tell the user to upload a capital components CSV at /data-sources?tab=capital.`
    );
  }

  const snapshotBlock = formatSnapshot(snap);
  const breachBlock =
    breaches.length === 0
      ? "No breaches or warnings."
      : breaches.map(formatBreach).join("\n");
  const rwaBlock =
    rwa.length === 0
      ? "No RWA breakdown uploaded for this period."
      : rwa.map((r) => formatRwaRow(r)).join("\n");

  return [
    header,
    "",
    "### Snapshot",
    snapshotBlock,
    "",
    `### Breaches / warnings (${breaches.length})`,
    breachBlock,
    "",
    "### RWA breakdown",
    rwaBlock,
  ].join("\n");
}

// Format as a percentage string with up to `digits` fractional digits, with
// trailing zeros stripped — `formatPct(0.132, 2) === "13.2"` (not "13.20").
// Caller appends the `%` sign. Keeps snapshot output compact while preserving
// precision when the ratio genuinely has more decimals.
function formatPct(value: number, digits: number): string {
  return parseFloat((value * 100).toFixed(digits)).toString();
}

function formatSnapshot(snap: Extract<Snapshot, { hasData: true }>): string {
  const lines: string[] = [];
  lines.push(
    `CET1 ratio: ${formatPct(snap.cet1Ratio, 2)}% (min ${formatPct(effectiveMinimum("cet1"), 1)}%)`,
  );
  lines.push(
    `Tier 1 ratio: ${formatPct(snap.tier1Ratio, 2)}% (min ${formatPct(effectiveMinimum("tier1"), 1)}%)`,
  );
  lines.push(
    `Total Capital ratio: ${formatPct(snap.totalRatio, 2)}% (min ${formatPct(effectiveMinimum("total"), 1)}%)`,
  );
  lines.push(`CET1 capital (net of deductions): $${snap.cet1Capital.toLocaleString()}`);
  lines.push(`Tier 1 capital: $${snap.tier1Capital.toLocaleString()}`);
  lines.push(`Total capital: $${snap.totalCapital.toLocaleString()}`);
  lines.push(`Total RWA: $${snap.totalRwa.toLocaleString()}`);
  return lines.join("\n");
}

function formatBreach(b: Breach): string {
  if (b.kind === "ratio_breach") {
    return `- [BREACH] ${b.ratio.toUpperCase()} is ${formatPct(b.value, 2)}%, below ${formatPct(b.minimum, 1)}% minimum (gap ${formatPct(b.gap, 2)}%)`;
  }
  if (b.kind === "missing_source") {
    return `- [MISSING] ${b.sourceType}`;
  }
  return `- [RWA MISMATCH] capital components report $${b.capitalTotal.toLocaleString()}, RWA lines sum to $${b.rwaLineTotal.toLocaleString()} (${formatPct(b.deltaPct, 2)}% gap)`;
}

function formatRwaRow(r: RwaBreakdownRow): string {
  return `- ${r.riskType}: $${r.totalRwa.toLocaleString()} (${formatPct(r.share, 1)}%) across ${r.lineCount} exposure class${r.lineCount === 1 ? "" : "es"}`;
}
