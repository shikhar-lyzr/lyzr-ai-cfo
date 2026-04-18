import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createReconciliationTools } from "../reconciliation";

describe("reconciliation write tools", { timeout: 30_000 }, () => {
  let userId = "";
  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "T",
      },
    });
    userId = u.id;
  });

  it("run_matching returns friendly message on empty DB", async () => {
    const t = createReconciliationTools(userId);
    const res = await t.runMatching.handler({}) as { text: string; details?: any };
    expect(res.text).toMatch(/cannot run matching/i);
  });

  async function seedBreak() {
    const ds = await prisma.dataSource.create({ data: { userId, type: "gl", name: "t", status: "ready" } });
    const run = await prisma.matchRun.create({
      data: { userId, periodKey: "2026-04", triggeredBy: "manual", strategyConfig: {}, totalGL: 0, totalSub: 0, matched: 0, partial: 0, unmatched: 1 },
    });
    const gl = await prisma.gLEntry.create({
      data: {
        dataSourceId: ds.id, periodKey: "2026-04", entryDate: new Date(), postingDate: new Date(),
        account: "2100", reference: "X", amount: 50, txnCurrency: "USD", baseAmount: 50,
        debitCredit: "DR",
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id, side: "gl_only", entryId: gl.id,
        amount: 50, baseAmount: 50, txnCurrency: "USD",
        ageDays: 5, ageBucket: "0-30", severity: "low", severityRank: 1, status: "open",
      },
    });
    return brk;
  }

  it("approve_adjustment returns preview when confirm is not set", async () => {
    const brk = await seedBreak();
    const t = createReconciliationTools(userId);
    const prop = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "test",
    }) as { text: string; details?: any };
    const proposalId = (prop.details as { proposalId: string }).proposalId;

    const preview = await t.approveAdjustment.handler({ proposalId }) as { text: string; details?: any };
    expect(preview.text).toMatch(/preview/i);
    const after = await prisma.adjustmentProposal.findUnique({ where: { id: proposalId } });
    expect(after?.status).toBe("pending");
  });

  it("approve_adjustment with confirm posts journal and flips break", async () => {
    const brk = await seedBreak();
    const t = createReconciliationTools(userId);
    const prop = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "test",
    }) as { text: string; details?: any };
    const proposalId = (prop.details as { proposalId: string }).proposalId;

    const posted = await t.approveAdjustment.handler({ proposalId, confirm: true }) as { text: string; details?: any };
    expect(posted.text).toMatch(/posted journal/i);

    const after = await prisma.adjustmentProposal.findUnique({ where: { id: proposalId } });
    expect(after?.status).toBe("posted");
    const refreshedBreak = await prisma.break.findUnique({ where: { id: brk.id } });
    expect(refreshedBreak?.status).toBe("adjusted");
    const journals = await prisma.journalAdjustment.count({ where: { proposalId } });
    expect(journals).toBe(1);
  });

  it("approve_adjustment rejects cross-tenant proposal", async () => {
    const brk = await seedBreak();
    const t = createReconciliationTools(userId);
    const prop = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "test",
    }) as { text: string; details?: any };
    const proposalId = (prop.details as { proposalId: string }).proposalId;

    const otherUser = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}_x`,
        email: `t_${Date.now()}_${Math.random()}_x@test.local`,
        name: "Other",
      },
    });
    const otherTools = createReconciliationTools(otherUser.id);
    const res = await otherTools.approveAdjustment.handler({ proposalId, confirm: true }) as { text: string; details?: any };
    expect(res.text).toMatch(/not found/i);

    const journals = await prisma.journalAdjustment.count({ where: { proposalId } });
    expect(journals).toBe(0);
  });

  it("approve_adjustment is idempotent on double-post", async () => {
    const brk = await seedBreak();
    const t = createReconciliationTools(userId);
    const prop = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "test",
    }) as { text: string; details?: any };
    const proposalId = (prop.details as { proposalId: string }).proposalId;

    const first = await t.approveAdjustment.handler({ proposalId, confirm: true }) as { text: string; details?: any };
    expect(first.text).toMatch(/posted journal/i);

    const second = await t.approveAdjustment.handler({ proposalId, confirm: true }) as { text: string; details?: any };
    // Second call sees status != pending and short-circuits.
    expect(second.text).toMatch(/already/i);

    const journals = await prisma.journalAdjustment.count({ where: { proposalId } });
    expect(journals).toBe(1);
  });

  it("propose_adjustment rejects a second pending proposal on the same break", async () => {
    const brk = await seedBreak();
    const t = createReconciliationTools(userId);
    const first = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "first",
    }) as { text: string; details?: any };
    expect((first.details as { proposalId?: string }).proposalId).toBeTruthy();

    const second = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "second",
    }) as { text: string; details?: any };
    expect(second.text).toMatch(/already exists/i);

    const proposals = await prisma.adjustmentProposal.count({ where: { breakId: brk.id } });
    expect(proposals).toBe(1);
  });
});
