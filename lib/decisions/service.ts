import { prisma } from "@/lib/db";
import { legalTransition, type DecisionOutcome, type DecisionStatus } from "./transitions";

export async function listDecisions(
  userId: string,
  status: DecisionStatus = "pending",
  limit = 50,
) {
  const decisions = await prisma.decision.findMany({
    where: { userId, status },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  // Hydrate AdjustmentProposal for type=post_journal rows in one batch
  const proposalIds = decisions
    .filter((d) => d.type === "post_journal" && d.proposalRef)
    .map((d) => d.proposalRef as string);
  const proposals = proposalIds.length === 0
    ? []
    : await prisma.adjustmentProposal.findMany({
        where: { id: { in: proposalIds } },
        include: { break: true },
      });
  const byId = new Map(proposals.map((p) => [p.id, p]));

  return decisions.map((d) => ({
    ...d,
    proposal: d.proposalRef ? byId.get(d.proposalRef) ?? null : null,
  }));
}

export async function getDecision(userId: string, id: string) {
  const d = await prisma.decision.findFirst({ where: { id, userId } });
  if (!d) return null;
  let proposal = null;
  if (d.type === "post_journal" && d.proposalRef) {
    proposal = await prisma.adjustmentProposal.findUnique({
      where: { id: d.proposalRef },
      include: { break: true },
    });
  }
  return { ...d, proposal };
}

export type DecideArgs = {
  userId: string;
  decisionId: string;
  outcome: DecisionOutcome;
  reason?: string;
};

export type DecideResult =
  | { ok: true; decision: { id: string; status: DecisionStatus } }
  | { ok: false; code: "not_found" | "illegal_transition" | "post_failed"; message: string };

export async function decideOnProposal(args: DecideArgs): Promise<DecideResult> {
  const { userId, decisionId, outcome, reason } = args;

  const dec = await prisma.decision.findFirst({ where: { id: decisionId, userId } });
  if (!dec) return { ok: false, code: "not_found", message: `Decision ${decisionId} not found.` };

  const next = legalTransition(dec.status as DecisionStatus, outcome);
  if (!next) {
    return {
      ok: false,
      code: "illegal_transition",
      message: `Cannot ${outcome} a decision in status ${dec.status}.`,
    };
  }

  // needs_info: just transition the Decision; no proposal/journal mutation
  if (next === "needs_info") {
    await prisma.$transaction([
      prisma.decision.update({
        where: { id: dec.id },
        data: { status: next, decidedBy: null, decidedAt: null, reason: reason ?? null },
      }),
      prisma.decisionEvent.create({
        data: {
          decisionId: dec.id,
          fromStatus: dec.status,
          toStatus: next,
          actorId: userId,
          reason: reason ?? null,
        },
      }),
    ]);
    return { ok: true, decision: { id: dec.id, status: next } };
  }

  if (next === "rejected") {
    await prisma.$transaction([
      prisma.decision.update({
        where: { id: dec.id },
        data: { status: next, decidedBy: userId, decidedAt: new Date(), reason: reason ?? null },
      }),
      prisma.decisionEvent.create({
        data: {
          decisionId: dec.id,
          fromStatus: dec.status,
          toStatus: next,
          actorId: userId,
          reason: reason ?? null,
        },
      }),
      ...(dec.proposalRef
        ? [
            prisma.adjustmentProposal.update({
              where: { id: dec.proposalRef },
              data: { status: "rejected", reason: reason ?? null },
            }),
          ]
        : []),
    ]);
    return { ok: true, decision: { id: dec.id, status: next } };
  }

  // approved: post the journal in one transaction with all the audit columns
  if (!dec.proposalRef) {
    return { ok: false, code: "post_failed", message: "Decision has no proposalRef to post." };
  }
  const proposalId = dec.proposalRef;

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.adjustmentProposal.updateMany({
        where: { id: proposalId, status: "pending" },
        data: {
          status: "posted",
          approvedBy: userId,
          approvedAt: new Date(),
          reason: reason ?? null,
        },
      });
      if (claim.count === 0) throw new Error("ALREADY_POSTED");

      const proposal = await tx.adjustmentProposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new Error("PROPOSAL_VANISHED");

      const journal = await tx.journalAdjustment.create({
        data: {
          userId,
          proposalId: proposal.id,
          entryDate: new Date(),
          lines: [
            { account: proposal.debitAccount, dr: proposal.amount, cr: 0, baseAmount: proposal.baseAmount },
            { account: proposal.creditAccount, dr: 0, cr: proposal.amount, baseAmount: proposal.baseAmount },
          ],
          approvedBy: userId,
          approvedAt: new Date(),
          reason: reason ?? null,
        },
      });

      await tx.adjustmentProposal.update({
        where: { id: proposal.id },
        data: { postedJournalId: journal.id },
      });
      await tx.break.update({
        where: { id: proposal.breakId },
        data: { status: "adjusted" },
      });
      await tx.decision.update({
        where: { id: dec.id },
        data: { status: "approved", decidedBy: userId, decidedAt: new Date(), reason: reason ?? null },
      });
      await tx.decisionEvent.create({
        data: {
          decisionId: dec.id,
          fromStatus: dec.status,
          toStatus: "approved",
          actorId: userId,
          reason: reason ?? null,
        },
      });
    }, { timeout: 30_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "post_failed", message: msg };
  }

  return { ok: true, decision: { id: dec.id, status: "approved" } };
}
