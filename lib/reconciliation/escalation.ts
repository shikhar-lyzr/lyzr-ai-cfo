import { prisma } from "@/lib/db";

export async function escalateQualifyingBreaks(userId: string, matchRunId: string) {
  const breaks = await prisma.break.findMany({
    where: {
      matchRunId,
      actionId: null,
      status: "open",
      severity: "high",
      ageDays: { gt: 60 },
    },
  });

  if (breaks.length === 0) return 0;

  // Wrap in a transaction so a mid-loop failure doesn't leave a subset of
  // breaks escalated and the rest not — the whole batch is all-or-nothing.
  await prisma.$transaction(
    async (tx) => {
      for (const b of breaks) {
        const action = await tx.action.create({
          data: {
            userId,
            type: "reconciliation_break",
            severity: "high",
            headline: `Unresolved break: ${b.side === "gl_only" ? "GL" : "Sub-ledger"} entry`,
            detail: `Age ${b.ageDays}d, ${b.baseAmount.toFixed(2)} ${b.txnCurrency}. Break #${b.id}.`,
            driver: "reconciliation",
            status: "pending",
          },
        });
        await tx.break.update({
          where: { id: b.id },
          data: { actionId: action.id },
        });
      }
    },
    { timeout: 30_000 }
  );

  return breaks.length;
}
