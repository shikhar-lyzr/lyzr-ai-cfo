import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { decideOnProposal } from "@/lib/decisions/service";
import { deleteTestUser } from "./cleanup";

describe("decisions propose-and-approve flow", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("propose creates AdjustmentProposal + Decision atomically; approve posts journal with audit columns", async () => {
    // Seed: a MatchRun + Break to satisfy proposeAdjustment guards
    const run = await prisma.matchRun.create({
      data: {
        userId,
        periodKey: "2026-04",
        triggeredBy: "test",
        strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 0, partial: 0, unmatched: 1,
        completedAt: new Date(),
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id,
        side: "gl_only",
        entryId: "fake_gl",
        amount: 0.42,
        baseAmount: 0.42,
        txnCurrency: "USD",
        ageDays: 3,
        ageBucket: "0-30d",
        severity: "low",
        severityRank: 1,
        status: "open",
      },
    });

    // Simulate proposeAdjustment's transaction directly (the agent tool wraps it)
    const { prop, dec } = await prisma.$transaction(async (tx) => {
      const prop = await tx.adjustmentProposal.create({
        data: {
          breakId: brk.id,
          proposedBy: "agent",
          description: "FX rounding 2026-04",
          debitAccount: "5400-cash",
          creditAccount: "7900-fx-gl",
          amount: 0.42,
          baseAmount: 0.42,
          currency: "USD",
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
          headline: "Post 0.42 USD — FX rounding",
          detail: `Break ${brk.id} (gl_only)`,
          status: "pending",
        },
      });
      return { prop, dec };
    });

    expect(prop.status).toBe("pending");
    expect(dec.status).toBe("pending");
    expect(dec.proposalRef).toBe(prop.id);

    // Approve through the service layer
    const result = await decideOnProposal({
      userId,
      decisionId: dec.id,
      outcome: "approve",
      reason: "rounding adjustment confirmed",
    });
    expect(result.ok).toBe(true);

    // Verify all the post-conditions
    const decAfter = await prisma.decision.findUnique({ where: { id: dec.id } });
    expect(decAfter?.status).toBe("approved");
    expect(decAfter?.decidedBy).toBe(userId);
    expect(decAfter?.reason).toBe("rounding adjustment confirmed");

    const propAfter = await prisma.adjustmentProposal.findUnique({ where: { id: prop.id } });
    expect(propAfter?.status).toBe("posted");
    expect(propAfter?.approvedBy).toBe(userId);
    expect(propAfter?.reason).toBe("rounding adjustment confirmed");
    expect(propAfter?.postedJournalId).toBeTruthy();

    const journal = await prisma.journalAdjustment.findUnique({
      where: { id: propAfter!.postedJournalId! },
    });
    expect(journal?.approvedBy).toBe(userId);
    expect(journal?.reason).toBe("rounding adjustment confirmed");

    const brkAfter = await prisma.break.findUnique({ where: { id: brk.id } });
    expect(brkAfter?.status).toBe("adjusted");

    const events = await prisma.decisionEvent.findMany({ where: { decisionId: dec.id } });
    expect(events).toHaveLength(1);
    expect(events[0].toStatus).toBe("approved");
    expect(events[0].actorId).toBe(userId);
  });
});
