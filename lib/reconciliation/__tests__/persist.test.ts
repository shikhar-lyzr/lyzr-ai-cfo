import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { saveMatchRun, loadLedgerEntries } from "../persist";
import { DEFAULT_STRATEGY_CONFIG } from "../types";

// Neon serverless pooler round-trips add up across beforeEach setup plus
// saveMatchRun's chain of writes; 5s vitest default is not enough.
describe("persist layer", { timeout: 30_000 }, () => {
  let userId = "";
  let glDsId = "";
  let subDsId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    const glDs = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    const subDs = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "test-sub.csv", status: "ready" },
    });
    glDsId = glDs.id;
    subDsId = subDs.id;

    await prisma.gLEntry.create({
      data: {
        dataSourceId: glDsId, periodKey: "2026-04",
        entryDate: new Date("2026-04-01"), postingDate: new Date("2026-04-01"),
        account: "2100", reference: "INV-001",
        amount: 100, txnCurrency: "USD", baseAmount: 100,
        debitCredit: "DR", counterparty: "Acme",
      },
    });
    await prisma.subLedgerEntry.create({
      data: {
        dataSourceId: subDsId, sourceModule: "AP", periodKey: "2026-04",
        entryDate: new Date("2026-04-01"),
        account: "2100", reference: "INV-001",
        amount: 100, txnCurrency: "USD", baseAmount: 100, counterparty: "Acme",
      },
    });
    await prisma.gLEntry.create({
      data: {
        dataSourceId: glDsId, periodKey: "2026-04",
        entryDate: new Date("2026-01-01"), postingDate: new Date("2026-01-01"),
        account: "2100", reference: "INV-OLD",
        amount: 20000, txnCurrency: "USD", baseAmount: 20000,
        debitCredit: "DR", counterparty: "OldVendor",
      },
    });
  });

  it("loadLedgerEntries returns inputs for matching", async () => {
    const { gl, sub } = await loadLedgerEntries(userId, "2026-04");
    expect(gl).toHaveLength(2);
    expect(sub).toHaveLength(1);
    // loadLedgerEntries orders by entryDate asc → 2026-01-01 (20000) first, then 2026-04-01 (100).
    expect(gl[0].baseAmount).toBe(20000);
    expect(gl[1].baseAmount).toBe(100);
  });

  it("saveMatchRun persists run, links, breaks, and flips entry status", async () => {
    const { gl, sub } = await loadLedgerEntries(userId, "2026-04");
    const runId = await saveMatchRun(userId, "2026-04", gl, sub, DEFAULT_STRATEGY_CONFIG, "manual");

    const run = await prisma.matchRun.findUnique({
      where: { id: runId },
      include: { links: true, breaks: true },
    });
    expect(run?.matched).toBe(1);
    expect(run?.unmatched).toBe(1);
    expect(run?.links).toHaveLength(1);
    expect(run?.breaks).toHaveLength(1);

    const matchedGL = await prisma.gLEntry.findFirst({
      where: { reference: "INV-001", dataSourceId: glDsId },
    });
    expect(matchedGL?.matchStatus).toBe("matched");

    const breakRow = run?.breaks[0];
    expect(breakRow?.side).toBe("gl_only");
    expect(breakRow?.severity).toBe("high"); // >60d OR >10k
    expect(breakRow?.ageBucket).toBe("60+");

    const br = await prisma.break.findFirst({ where: { matchRunId: runId } });
    expect(br?.actionId).not.toBeNull();

    const act = await prisma.action.findUnique({ where: { id: br!.actionId! } });
    expect(act?.type).toBe("reconciliation_break");
    expect(act?.severity).toBe("high");
  });
});
