import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { ingestGl, ingestSubLedger, loadLedgerEntries } from "../persist";

const TEST_USER = "test-user-periods";

const GL_HEADERS = ["entry_date","posting_date","account","reference","memo","amount","currency","base_amount","debit_credit","counterparty"];
const SUB_HEADERS = ["source_module","entry_date","account","reference","memo","amount","currency","base_amount","counterparty"];

function glRow(date: string, ref: string, amount: number): string[] {
  return [date, date, "1000", ref, "", String(amount), "USD", String(amount), "DR", ""];
}
function subRow(date: string, ref: string, amount: number): string[] {
  return ["ap", date, "1000", ref, "", String(amount), "USD", String(amount), ""];
}

async function cleanup() {
  await prisma.matchLink.deleteMany({});
  await prisma.break.deleteMany({});
  await prisma.matchRun.deleteMany({ where: { userId: TEST_USER } });
  await prisma.gLEntry.deleteMany({ where: { dataSource: { userId: TEST_USER } } });
  await prisma.subLedgerEntry.deleteMany({ where: { dataSource: { userId: TEST_USER } } });
  await prisma.dataSource.deleteMany({ where: { userId: TEST_USER } });
  await prisma.reconPeriod.deleteMany({ where: { userId: TEST_USER } });
  await prisma.user.deleteMany({ where: { id: TEST_USER } });
}

beforeEach(async () => {
  await cleanup();
  await prisma.user.create({
    data: { id: TEST_USER, lyzrAccountId: TEST_USER, email: `${TEST_USER}@x`, name: "T" },
  });
});
afterEach(cleanup);

describe("period-aware ingest", { timeout: 30_000 }, () => {
  it("stamps each GL row with its periodKey and upserts ReconPeriod", async () => {
    const rows = [glRow("2026-03-15", "A", 100), glRow("2026-04-02", "B", 200)];
    const res = await ingestGl(TEST_USER, "mar-apr.csv", GL_HEADERS, rows);
    expect(res.periodsTouched.sort()).toEqual(["2026-03", "2026-04"]);

    const gl = await prisma.gLEntry.findMany({ where: { dataSource: { userId: TEST_USER } } });
    expect(gl.map((g) => g.periodKey).sort()).toEqual(["2026-03", "2026-04"]);

    const periods = await prisma.reconPeriod.findMany({ where: { userId: TEST_USER } });
    expect(periods.map((p) => p.periodKey).sort()).toEqual(["2026-03", "2026-04"]);
  });

  it("loadLedgerEntries filters by periodKey", async () => {
    await ingestGl(TEST_USER, "mar.csv", GL_HEADERS, [glRow("2026-03-10", "MAR-1", 100)]);
    await ingestGl(TEST_USER, "apr.csv", GL_HEADERS, [glRow("2026-04-10", "APR-1", 100)]);
    await ingestSubLedger(TEST_USER, "mar-sub.csv", SUB_HEADERS, [subRow("2026-03-11", "MAR-1", 100)]);

    const mar = await loadLedgerEntries(TEST_USER, "2026-03");
    expect(mar.gl.map((g) => g.reference)).toEqual(["MAR-1"]);
    expect(mar.sub.map((s) => s.reference)).toEqual(["MAR-1"]);

    const apr = await loadLedgerEntries(TEST_USER, "2026-04");
    expect(apr.gl.map((g) => g.reference)).toEqual(["APR-1"]);
    expect(apr.sub).toEqual([]);
  });
});
