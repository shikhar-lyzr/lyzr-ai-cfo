import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { decideOnProposal } from "@/lib/decisions/service";
import { deleteTestUser } from "./cleanup";

describe("decisions reject flow", { timeout: 30_000 }, () => {
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

  it("reject leaves break open; no JournalAdjustment is written", async () => {
    const run = await prisma.matchRun.create({
      data: {
        userId, periodKey: "2026-04", triggeredBy: "test", strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 0, partial: 0, unmatched: 1,
        completedAt: new Date(),
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id, side: "gl_only", entryId: "x", amount: 1, baseAmount: 1,
        txnCurrency: "USD", ageDays: 1, ageBucket: "0-30d", severity: "low", severityRank: 1, status: "open",
      },
    });
    const prop = await prisma.adjustmentProposal.create({
      data: {
        breakId: brk.id, proposedBy: "agent", description: "test", debitAccount: "x", creditAccount: "y",
        amount: 1, baseAmount: 1, currency: "USD", journalDate: new Date(), status: "pending",
      },
    });
    const dec = await prisma.decision.create({
      data: {
        userId, type: "post_journal", proposalRef: prop.id, refModel: "AdjustmentProposal",
        headline: "h", detail: "d", status: "pending",
      },
    });

    const result = await decideOnProposal({
      userId, decisionId: dec.id, outcome: "reject", reason: "wrong account",
    });
    expect(result.ok).toBe(true);

    const decAfter = await prisma.decision.findUnique({ where: { id: dec.id } });
    expect(decAfter?.status).toBe("rejected");
    expect(decAfter?.reason).toBe("wrong account");

    const propAfter = await prisma.adjustmentProposal.findUnique({ where: { id: prop.id } });
    expect(propAfter?.status).toBe("rejected");
    expect(propAfter?.reason).toBe("wrong account");
    expect(propAfter?.postedJournalId).toBeNull();

    const brkAfter = await prisma.break.findUnique({ where: { id: brk.id } });
    expect(brkAfter?.status).toBe("open");

    const journals = await prisma.journalAdjustment.findMany({ where: { userId } });
    expect(journals).toHaveLength(0);
  });
});
