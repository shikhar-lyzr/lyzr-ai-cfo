import { getReconciliationStats, getTopBreaks } from "@/lib/reconciliation/stats";

export async function buildReconciliationContext(userId: string, periodKey: string): Promise<string> {
  const stats = await getReconciliationStats(userId, periodKey);

  if (!stats.hasData) {
    return `## Current Journey: Financial Reconciliation\nNo match run yet — user needs to upload a GL CSV and a sub-ledger CSV to kick off reconciliation.`;
  }

  const ageText = humanizeAge(stats.lastRunAt);

  const header =
    `## Current Journey: Financial Reconciliation\n` +
    `Match rate: ${(stats.matchRate * 100).toFixed(1)}%   ` +
    `Open breaks: ${stats.openBreakCount} ($${stats.openBreakValue.toLocaleString()})   ` +
    `Oldest: ${stats.oldestBreakDays}d\n` +
    `GL-only: ${stats.glOnly}   Sub-only: ${stats.subOnly}\n` +
    `Last match run: ${ageText}`;

  if (stats.openBreakCount === 0) {
    return `${header}\nAll breaks resolved. Nothing outstanding.`;
  }

  const top = await getTopBreaks(userId, periodKey, 5);
  // getTopBreaks returns: { id, ref, amount, currency, type, age, counterparty, severity }
  const lines = top
    .map(
      (b) =>
        `- [${b.severity.toUpperCase()}]  $${Math.abs(Number(b.amount)).toLocaleString()} ${b.currency}  ${b.type}  ${b.age}d`
    )
    .join("\n");

  return `${header}\n\n### Top ${top.length} open breaks\n${lines}`;
}

function humanizeAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
