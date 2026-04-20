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

  // ---------------------------------------------------------------------------
  // periodKey scoping
  // ---------------------------------------------------------------------------
  async function seedRunWithBreak(
    uid: string,
    periodKey: string,
    opts: { startedAt?: Date; amount?: number } = {}
  ) {
    const ds = await prisma.dataSource.create({
      data: { userId: uid, type: "gl", name: `ds-${periodKey}`, status: "ready" },
    });
    const run = await prisma.matchRun.create({
      data: {
        userId: uid,
        periodKey,
        triggeredBy: "manual",
        strategyConfig: {},
        totalGL: 0,
        totalSub: 0,
        matched: 0,
        partial: 0,
        unmatched: 1,
        ...(opts.startedAt ? { startedAt: opts.startedAt } : {}),
      },
    });
    const gl = await prisma.gLEntry.create({
      data: {
        dataSourceId: ds.id,
        periodKey,
        entryDate: new Date(`${periodKey}-15`),
        postingDate: new Date(`${periodKey}-15`),
        account: "2100",
        reference: `R-${periodKey}`,
        amount: opts.amount ?? 50,
        txnCurrency: "USD",
        baseAmount: opts.amount ?? 50,
        debitCredit: "DR",
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id,
        side: "gl_only",
        entryId: gl.id,
        amount: opts.amount ?? 50,
        baseAmount: opts.amount ?? 50,
        txnCurrency: "USD",
        ageDays: 5,
        ageBucket: "0-30",
        severity: "low",
        severityRank: 1,
        status: "open",
      },
    });
    return { run, brk, ds, gl };
  }

  it("list_match_runs excludes runs from other periodKeys", async () => {
    await seedRunWithBreak(userId, "2026-03");
    const apr = await seedRunWithBreak(userId, "2026-04");
    const tools = createReconciliationTools(userId, "2026-04");
    const res = await tools.listMatchRuns.handler({}) as {
      text: string;
      details: { runs: Array<{ id: string }> };
    };
    const ids = res.details.runs.map((r) => r.id);
    expect(ids).toContain(apr.run.id);
    expect(ids).not.toContain((await prisma.matchRun.findFirst({
      where: { userId, periodKey: "2026-03" },
    }))?.id);
    expect(res.details.runs.every((r) => ids.includes(r.id))).toBe(true);
    // All returned runs should belong to 2026-04.
    const rows = await prisma.matchRun.findMany({ where: { id: { in: ids } } });
    expect(rows.every((r) => r.periodKey === "2026-04")).toBe(true);
  });

  it("reconciliation_summary returns the scoped period's last run, not the globally newest", async () => {
    // Newer run is in 2026-04; older run is in 2026-03. Scope to 2026-03 →
    // we should get the MAR run even though APR is globally newer.
    const older = await seedRunWithBreak(userId, "2026-03", {
      startedAt: new Date("2026-03-31T00:00:00Z"),
    });
    await seedRunWithBreak(userId, "2026-04", {
      startedAt: new Date("2026-04-30T00:00:00Z"),
    });

    const scoped = createReconciliationTools(userId, "2026-03");
    const res = await scoped.reconciliationSummary.handler({}) as {
      text: string;
      details: { lastRun: { id: string; periodKey: string } | null };
    };
    expect(res.details.lastRun?.id).toBe(older.run.id);
    expect(res.details.lastRun?.periodKey).toBe("2026-03");
  });

  it("list_breaks with periodKey returns only breaks under that period's runs", async () => {
    const mar = await seedRunWithBreak(userId, "2026-03", { amount: 11 });
    const apr = await seedRunWithBreak(userId, "2026-04", { amount: 22 });

    const marTools = createReconciliationTools(userId, "2026-03");
    const marRes = await marTools.listBreaks.handler({}) as {
      text: string;
      details: { breaks: Array<{ id: string }> };
    };
    const marIds = marRes.details.breaks.map((b) => b.id);
    expect(marIds).toContain(mar.brk.id);
    expect(marIds).not.toContain(apr.brk.id);

    const aprTools = createReconciliationTools(userId, "2026-04");
    const aprRes = await aprTools.listBreaks.handler({}) as {
      text: string;
      details: { breaks: Array<{ id: string }> };
    };
    const aprIds = aprRes.details.breaks.map((b) => b.id);
    expect(aprIds).toContain(apr.brk.id);
    expect(aprIds).not.toContain(mar.brk.id);
  });

  it("run_matching with explicit periodKey having no GL returns missing-side message (no fallback)", async () => {
    // Seed 2026-04 with BOTH sides so a newest-period fallback WOULD succeed,
    // but scope the tool to 2026-03 where there is no GL. The tool must not
    // fall through to 2026-04.
    const glDs = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "gl-apr", status: "ready" },
    });
    const subDs = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "sub-apr", status: "ready" },
    });
    await prisma.gLEntry.create({
      data: {
        dataSourceId: glDs.id, periodKey: "2026-04",
        entryDate: new Date("2026-04-10"), postingDate: new Date("2026-04-10"),
        account: "2100", reference: "APR-1", amount: 100, txnCurrency: "USD",
        baseAmount: 100, debitCredit: "DR",
      },
    });
    await prisma.subLedgerEntry.create({
      data: {
        dataSourceId: subDs.id, sourceModule: "AP", periodKey: "2026-04",
        entryDate: new Date("2026-04-10"), account: "2100", reference: "APR-1",
        amount: 100, txnCurrency: "USD", baseAmount: 100,
      },
    });
    await prisma.reconPeriod.create({ data: { userId, periodKey: "2026-04" } });
    await prisma.reconPeriod.create({ data: { userId, periodKey: "2026-03" } });

    const tools = createReconciliationTools(userId, "2026-03");
    const res = await tools.runMatching.handler({}) as {
      text: string;
      details: { periodKey?: string; glCount?: number; subCount?: number };
    };
    expect(res.text).toMatch(/cannot run matching for period 2026-03/i);
    expect(res.text).toMatch(/missing/i);
    expect(res.details.periodKey).toBe("2026-03");
    // Critically: no MatchRun was created for 2026-04 as a fallback.
    const runs = await prisma.matchRun.findMany({ where: { userId } });
    expect(runs.length).toBe(0);
  });

  it("run_matching without periodKey falls back to newest ReconPeriod with data on both sides", async () => {
    // Seed two periods, both with both sides. Without periodKey, newest (by
    // periodKey desc) should win. We use "2026-03" (older) and "2026-04"
    // (newer).
    const glMarDs = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "gl-mar", status: "ready" },
    });
    const subMarDs = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "sub-mar", status: "ready" },
    });
    const glAprDs = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "gl-apr", status: "ready" },
    });
    const subAprDs = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "sub-apr", status: "ready" },
    });
    await prisma.gLEntry.create({
      data: {
        dataSourceId: glMarDs.id, periodKey: "2026-03",
        entryDate: new Date("2026-03-10"), postingDate: new Date("2026-03-10"),
        account: "2100", reference: "MAR-1", amount: 100, txnCurrency: "USD",
        baseAmount: 100, debitCredit: "DR",
      },
    });
    await prisma.subLedgerEntry.create({
      data: {
        dataSourceId: subMarDs.id, sourceModule: "AP", periodKey: "2026-03",
        entryDate: new Date("2026-03-10"), account: "2100", reference: "MAR-1",
        amount: 100, txnCurrency: "USD", baseAmount: 100,
      },
    });
    await prisma.gLEntry.create({
      data: {
        dataSourceId: glAprDs.id, periodKey: "2026-04",
        entryDate: new Date("2026-04-10"), postingDate: new Date("2026-04-10"),
        account: "2100", reference: "APR-1", amount: 200, txnCurrency: "USD",
        baseAmount: 200, debitCredit: "DR",
      },
    });
    await prisma.subLedgerEntry.create({
      data: {
        dataSourceId: subAprDs.id, sourceModule: "AP", periodKey: "2026-04",
        entryDate: new Date("2026-04-10"), account: "2100", reference: "APR-1",
        amount: 200, txnCurrency: "USD", baseAmount: 200,
      },
    });
    await prisma.reconPeriod.create({ data: { userId, periodKey: "2026-03" } });
    await prisma.reconPeriod.create({ data: { userId, periodKey: "2026-04" } });

    const tools = createReconciliationTools(userId); // no periodKey
    const res = await tools.runMatching.handler({}) as {
      text: string;
      details: { runId?: string; periodKey?: string };
    };
    expect(res.details.periodKey).toBe("2026-04");
    expect(res.details.runId).toBeTruthy();
    const run = await prisma.matchRun.findUnique({ where: { id: res.details.runId! } });
    expect(run?.periodKey).toBe("2026-04");
  });
});
