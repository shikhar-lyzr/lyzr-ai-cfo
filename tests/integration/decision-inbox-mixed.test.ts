import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { listDecisions } from "@/lib/decisions/service";
import { decisionToRow, actionToRow } from "@/app/(shell)/decision-inbox/inbox-row";
import { deleteTestUser } from "./cleanup";

describe("decision-inbox mixed loader", { timeout: 30_000 }, () => {
  let userId = "";
  let dataSourceId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    const ds = await prisma.dataSource.create({
      data: { userId, name: "test-source", type: "budget" },
    });
    dataSourceId = ds.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("returns variance + decision rows in createdAt desc order", async () => {
    // Older Action
    const olderAction = await prisma.action.create({
      data: {
        userId,
        type: "variance",
        severity: "medium",
        headline: "Variance A",
        detail: "d",
        driver: "EMEA",
        sourceDataSourceId: dataSourceId,
        status: "pending",
        createdAt: new Date("2026-04-25T10:00:00Z"),
      },
    });
    // Newer Decision
    const newerDecision = await prisma.decision.create({
      data: {
        userId,
        type: "post_journal",
        headline: "Post 100 USD",
        detail: "Break b1",
        status: "pending",
        createdAt: new Date("2026-04-26T10:00:00Z"),
      },
    });

    const [pendingDecisions, pendingActionsRaw] = await Promise.all([
      listDecisions(userId, "pending"),
      prisma.action.findMany({
        where: { userId, status: "pending" },
        orderBy: { createdAt: "desc" },
        include: { dataSource: { select: { name: true } } },
      }),
    ]);

    const pendingActions = pendingActionsRaw.map((a) => ({
      ...a,
      sourceName: a.dataSource?.name ?? null,
    }));

    const rows = [
      ...pendingDecisions.map((d) => decisionToRow(d as any)),
      ...pendingActions.map((a) => actionToRow(a)),
    ].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(newerDecision.id);
    expect(rows[0].source).toBe("decision");
    expect(rows[1].id).toBe(olderAction.id);
    expect(rows[1].source).toBe("action");
    expect(rows[1].kind).toBe("variance");
  });

  it("excludes resolved Actions and Decisions", async () => {
    await prisma.action.create({
      data: {
        userId,
        type: "anomaly",
        severity: "low",
        headline: "Already done",
        detail: "",
        driver: "",
        sourceDataSourceId: dataSourceId,
        status: "approved",
      },
    });
    await prisma.decision.create({
      data: {
        userId,
        type: "post_journal",
        headline: "Already approved",
        status: "approved",
        decidedBy: userId,
        decidedAt: new Date(),
      },
    });

    const [pendingDecisions, pendingActions] = await Promise.all([
      listDecisions(userId, "pending"),
      prisma.action.findMany({ where: { userId, status: "pending" } }),
    ]);

    expect(pendingDecisions).toHaveLength(0);
    expect(pendingActions).toHaveLength(0);
  });
});
