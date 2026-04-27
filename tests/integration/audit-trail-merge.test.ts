import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { deleteTestUser } from "./cleanup";

describe("audit trail five-source merge", { timeout: 30_000 }, () => {
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

  it("returns one row per source when each is seeded; respects source filter", async () => {
    // 1) DataSource
    const ds = await prisma.dataSource.create({
      data: { userId, type: "ar", name: "ar.csv", status: "ready", recordCount: 5 },
    });
    // 2) Action + ActionEvent
    const action = await prisma.action.create({
      data: { userId, type: "ar_followup", severity: "medium", headline: "Late invoice",
              detail: "...", driver: "ar", status: "pending" },
    });
    await prisma.actionEvent.create({
      data: { actionId: action.id, userId, fromStatus: "pending", toStatus: "approved" },
    });
    // 3) Document
    await prisma.document.create({
      data: { userId, type: "ar_summary", title: "AR Summary", body: "..." },
    });
    // 4) MatchRun (completed)
    await prisma.matchRun.create({
      data: {
        userId, periodKey: "2026-04", triggeredBy: "test", strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 1, partial: 0, unmatched: 0,
        completedAt: new Date(),
      },
    });
    // 5) Decision + DecisionEvent
    const dec = await prisma.decision.create({
      data: { userId, type: "post_journal", headline: "h", status: "pending" },
    });
    await prisma.decisionEvent.create({
      data: { decisionId: dec.id, fromStatus: "pending", toStatus: "approved", actorId: userId },
    });

    const all = await queryAuditTrail({ userId });
    expect(all.errors).toEqual({});
    const sources = new Set(all.rows.map((r) => r.source));
    expect(sources).toEqual(new Set(["data_source", "action", "document", "match_run", "decision"]));

    const onlyDecisions = await queryAuditTrail({ userId, sources: ["decision"] });
    expect(onlyDecisions.rows.every((r) => r.source === "decision")).toBe(true);
    expect(onlyDecisions.rows).toHaveLength(1);

    // Order is timestamp descending
    const ts = all.rows.map((r) => r.timestamp);
    const sorted = [...ts].sort().reverse();
    expect(ts).toEqual(sorted);

    // The unused dataSource id is referenced via ds, suppressing TS unused-var warnings
    expect(ds.id).toBeTruthy();
  });
});
