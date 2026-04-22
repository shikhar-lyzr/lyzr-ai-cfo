import { getCloseReadiness, getCloseBlockers, type Blocker } from "@/lib/close/stats";
import { deriveTaskCounts } from "@/lib/close/tasks";

export async function buildMonthlyCloseContext(
  userId: string,
  periodKey: string,
): Promise<string> {
  const [readiness, blockers, tasks] = await Promise.all([
    getCloseReadiness(userId, periodKey),
    getCloseBlockers(userId, periodKey),
    deriveTaskCounts(userId, periodKey),
  ]);

  const header = `## Current Journey: Monthly Close — period ${periodKey}`;

  if (!readiness.hasData) {
    return (
      `${header}\n` +
      `No close data yet for ${periodKey}. Ask the user to upload a GL CSV, ` +
      `sub-ledger CSV, or budget/variance CSV with ${periodKey} rows to start the close.`
    );
  }

  const scoreLine =
    `Readiness: ${readiness.score}% (${readiness.tier}). ` +
    `Signals — match rate ${(readiness.signals.matchRate * 100).toFixed(0)}%, ` +
    `break penalty ${(readiness.signals.openBreakPenalty * 100).toFixed(0)}%, ` +
    `freshness penalty ${(readiness.signals.freshnessPenalty * 100).toFixed(0)}%, ` +
    `variance penalty ${(readiness.signals.variancePenalty * 100).toFixed(0)}%.`;

  const blockerLines = blockers.length
    ? blockers.map((b) => formatBlocker(b)).join("\n")
    : "No outstanding blockers.";

  const taskLines = tasks.length
    ? tasks
        .map((t) =>
          t.isEmpty
            ? `- ${t.label}: no data`
            : `- ${t.label}: ${t.completed}/${t.total}`,
        )
        .join("\n")
    : "No task data.";

  return [
    header,
    scoreLine,
    "",
    `### Blockers (${blockers.length})`,
    blockerLines,
    "",
    `### Task progress`,
    taskLines,
  ].join("\n");
}

function formatBlocker(b: Blocker): string {
  if (b.kind === "break") {
    return `- [BREAK] ${b.ref} $${Math.abs(b.amount).toLocaleString()} ${b.ageDays}d ${b.severity}`;
  }
  if (b.kind === "missing_source") {
    return `- [MISSING] ${b.sourceType}`;
  }
  const sign = b.pct >= 0 ? "+" : "";
  return `- [VARIANCE] ${b.account} (${b.category}): ${sign}${(b.pct * 100).toFixed(0)}% ($${b.actual.toLocaleString()} actual vs $${b.budget.toLocaleString()} budget)`;
}
