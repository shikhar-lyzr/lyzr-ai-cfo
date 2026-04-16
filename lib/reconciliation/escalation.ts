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

  for (const b of breaks) {
    const action = await prisma.action.create({
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

    await prisma.break.update({
      where: { id: b.id },
      data: { actionId: action.id },
    });
  }

  return breaks.length;
}
