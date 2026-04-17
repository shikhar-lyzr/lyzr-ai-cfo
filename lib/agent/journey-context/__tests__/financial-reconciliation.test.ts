import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { buildReconciliationContext } from "../financial-reconciliation";

describe("buildReconciliationContext", { timeout: 30_000 }, () => {
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

  it("returns 'no match run yet' when user has no match run", async () => {
    const out = await buildReconciliationContext(userId);
    expect(out).toContain("## Current Journey: Financial Reconciliation");
    expect(out).toContain("No match run yet");
  });

  it("returns stats + 'all resolved' footer when zero open breaks", async () => {
    await prisma.matchRun.create({
      data: {
        userId, triggeredBy: "manual", strategyConfig: {},
        totalGL: 10, totalSub: 10, matched: 10, partial: 0, unmatched: 0,
        startedAt: new Date(),
      },
    });
    const out = await buildReconciliationContext(userId);
    expect(out).toContain("Match rate: 100.0%");
    expect(out).toContain("Open breaks: 0");
    expect(out).toContain("All breaks resolved");
    expect(out).not.toContain("Top ");
  });

  it("returns stats + top-5 list when breaks exist", async () => {
    const run = await prisma.matchRun.create({
      data: {
        userId, triggeredBy: "upload", strategyConfig: {},
        totalGL: 10, totalSub: 10, matched: 7, partial: 0, unmatched: 3,
        startedAt: new Date(),
      },
    });
    for (let i = 0; i < 6; i++) {
      await prisma.break.create({
        data: {
          matchRunId: run.id, side: i % 2 === 0 ? "gl_only" : "sub_only",
          entryId: `fake-${i}`, amount: 1000 * (i + 1), baseAmount: 1000 * (i + 1),
          txnCurrency: "USD", ageDays: 10 * (i + 1), ageBucket: "0-30",
          severity: i < 2 ? "high" : i < 4 ? "medium" : "low",
          severityRank: i < 2 ? 3 : i < 4 ? 2 : 1,
          status: "open",
        },
      });
    }
    const out = await buildReconciliationContext(userId);
    expect(out).toContain("Match rate: 70.0%");
    expect(out).toContain("Open breaks: 6");
    expect(out).toContain("### Top 5 open breaks");
    expect(out).toMatch(/\[HIGH\]/);
    const bullets = out.split("\n").filter((l) => l.startsWith("- ["));
    expect(bullets).toHaveLength(5);
  });
});
