import { prisma } from "@/lib/db";

const userId = process.argv[2];
if (!userId) {
  console.error("usage: tsx scripts/seed-test-decision.ts <userId>");
  process.exit(1);
}

async function main() {
  const brk = await prisma.break.findFirst({
    where: { matchRun: { userId }, status: "open" },
    include: { matchRun: { select: { periodKey: true } } },
    orderBy: [{ severityRank: "desc" }, { ageDays: "desc" }],
  });
  if (!brk) {
    console.error(`No open break found for user ${userId}. Upload GL/sub-ledger CSVs first.`);
    process.exit(1);
  }

  const existing = await prisma.adjustmentProposal.findFirst({
    where: { breakId: brk.id, status: "pending" },
  });
  if (existing) {
    console.error(
      `Pending proposal already exists for break ${brk.id}: ${existing.id}. Approve/reject it first.`,
    );
    process.exit(1);
  }

  const { prop, dec } = await prisma.$transaction(async (tx) => {
    const prop = await tx.adjustmentProposal.create({
      data: {
        breakId: brk.id,
        proposedBy: "agent",
        description: "Test adjustment for Phase 1 smoke test",
        debitAccount: "5400-cash",
        creditAccount: "7900-fx-gl",
        amount: brk.amount,
        baseAmount: brk.baseAmount,
        currency: brk.txnCurrency,
        journalDate: new Date(),
        status: "pending",
      },
    });
    const dec = await tx.decision.create({
      data: {
        userId,
        type: "post_journal",
        proposalRef: prop.id,
        refModel: "AdjustmentProposal",
        headline: `Post ${prop.amount.toFixed(2)} ${prop.currency} — ${prop.description}`,
        detail: `Break ${brk.id} (${brk.side})`,
        status: "pending",
      },
    });
    return { prop, dec };
  });

  console.log("Seeded:");
  console.log("  break    ", brk.id, `(${brk.side}, ${brk.amount} ${brk.txnCurrency}, ${brk.matchRun.periodKey})`);
  console.log("  proposal ", prop.id);
  console.log("  decision ", dec.id);
  console.log();
  console.log("Refresh /decision-inbox — the new row should appear under Pending.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
