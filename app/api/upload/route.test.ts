import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestGl, ingestSubLedger } from "@/lib/reconciliation/persist";
import { maybeAutoMatch } from "./route";

const U = "test-user-upload-route";

const GL_HEADERS = ["entry_date","posting_date","account","reference","memo","amount","currency","base_amount","debit_credit","counterparty"];
const SUB_HEADERS = ["entry_date","account","source_module","reference","memo","amount","currency","base_amount","counterparty"];

function glRow(date: string, ref: string, amount: number): string[] {
  return [date, date, "1000", ref, "", String(amount), "USD", String(amount), "DR", ""];
}
function subRow(date: string, ref: string, amount: number): string[] {
  return [date, "1000", "ap", ref, "", String(amount), "USD", String(amount), ""];
}

async function cleanup() {
  await prisma.matchLink.deleteMany({ where: { matchRun: { userId: U } } });
  await prisma.break.deleteMany({ where: { matchRun: { userId: U } } });
  await prisma.matchRun.deleteMany({ where: { userId: U } });
  await prisma.gLEntry.deleteMany({ where: { dataSource: { userId: U } } });
  await prisma.subLedgerEntry.deleteMany({ where: { dataSource: { userId: U } } });
  await prisma.dataSource.deleteMany({ where: { userId: U } });
  await prisma.reconPeriod.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { id: U } });
}

describe("upload auto-match", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await cleanup();
    await prisma.user.create({
      data: { id: U, lyzrAccountId: U, email: `${U}@x`, name: "T" },
    });
  }, 30_000);
  afterEach(cleanup, 30_000);

  it("maybeAutoMatch creates a MatchRun per period when both ledgers exist", async () => {
    await ingestGl(U, "gl.csv", GL_HEADERS, [
      glRow("2026-03-15", "A", 100),
      glRow("2026-04-02", "B", 200),
    ]);
    await ingestSubLedger(U, "sub.csv", SUB_HEADERS, [
      subRow("2026-03-15", "A", 100),
      subRow("2026-04-02", "B", 200),
    ]);

    const runIds = await maybeAutoMatch(U, ["2026-03", "2026-04"]);
    expect(runIds).toHaveLength(2);

    const runs = await prisma.matchRun.findMany({
      where: { userId: U },
      select: { periodKey: true },
    });
    expect(runs.map((r) => r.periodKey).sort()).toEqual(["2026-03", "2026-04"]);
  });

  it("route handler awaits maybeAutoMatch so MatchRun exists before the response returns", () => {
    // Guard against the fire-and-forget regression that left prod without MatchRun rows
    // after successful ingest. On Netlify/Vercel serverless runtimes, detached promises
    // after the response are not guaranteed to complete.
    const src = readFileSync(join(__dirname, "route.ts"), "utf8");
    // No bare `maybeAutoMatch(...)` call followed by `.then(` or `.catch(` — all call
    // sites must be awaited.
    expect(src).not.toMatch(/maybeAutoMatch\([^)]*\)\s*\n?\s*\.then/);
    expect(src).not.toMatch(/maybeAutoMatch\([^)]*\)\s*\n?\s*\.catch/);
    // Every call site must be awaited.
    const callSites = [...src.matchAll(/(\bawait\s+)?maybeAutoMatch\(/g)];
    const nonAwaited = callSites.filter((m) => !m[1] && m.index! > src.indexOf("export async function maybeAutoMatch"));
    // Filter out the definition itself (which appears after `function maybeAutoMatch(`).
    const unawaitedCalls = callSites.filter((m) => {
      if (m[1]) return false;
      const before = src.slice(Math.max(0, m.index! - 30), m.index!);
      return !/function\s+$/.test(before);
    });
    expect(unawaitedCalls, "all maybeAutoMatch call sites must be awaited").toHaveLength(0);
    void nonAwaited;
  });
});

describe("upload capital shapes", () => {
  it("route handler dispatches capital_components to ingestCapitalComponents", () => {
    const src = readFileSync(join(__dirname, "route.ts"), "utf8");
    // There should be a branch on shape === "capital_components" that calls ingestCapitalComponents.
    expect(src).toMatch(/shape === "capital_components"/);
    expect(src).toMatch(/ingestCapitalComponents\s*\(/);
    // The branch must await (not fire-and-forget).
    expect(src).toMatch(/await\s+ingestCapitalComponents/);
  });

  it("route handler dispatches rwa_breakdown to ingestRwaBreakdown", () => {
    const src = readFileSync(join(__dirname, "route.ts"), "utf8");
    expect(src).toMatch(/shape === "rwa_breakdown"/);
    expect(src).toMatch(/ingestRwaBreakdown\s*\(/);
    expect(src).toMatch(/await\s+ingestRwaBreakdown/);
  });

  it("capital branches run before the AI-engine check (no API keys required)", () => {
    const src = readFileSync(join(__dirname, "route.ts"), "utf8");
    const capitalIdx = src.indexOf('shape === "capital_components"');
    const aiCheckIdx = src.indexOf("AI engine not configured");
    expect(capitalIdx).toBeGreaterThan(-1);
    expect(aiCheckIdx).toBeGreaterThan(-1);
    expect(capitalIdx).toBeLessThan(aiCheckIdx);
  });
});
