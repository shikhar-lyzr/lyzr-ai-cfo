import { describe, it, expect } from "vitest";
import {
  fromActionEvent, fromDecisionEvent, fromDataSource, fromDocument, fromMatchRun,
} from "@/lib/audit-trail/sources";

const ts = new Date("2026-04-15T10:30:00Z");

describe("audit-trail normalizers", () => {
  it("ActionEvent → row", () => {
    const row = fromActionEvent({
      id: "ae1", actionId: "a1", userId: "u1",
      fromStatus: "pending", toStatus: "approved", createdAt: ts,
      action: { headline: "Variance review" },
    } as never);
    expect(row).toEqual({
      id: "action:ae1",
      source: "action",
      timestamp: "2026-04-15T10:30:00.000Z",
      actorId: "u1",
      summary: "Action pending → approved (Variance review)",
      refType: "Action",
      refId: "a1",
      metadata: { fromStatus: "pending", toStatus: "approved" },
    });
  });

  it("DecisionEvent → row carries reason", () => {
    const row = fromDecisionEvent({
      id: "de1", decisionId: "d1", actorId: "u1",
      fromStatus: "pending", toStatus: "approved", reason: "ok", createdAt: ts,
      decision: { headline: "Post 0.42 USD" },
    } as never);
    expect(row.source).toBe("decision");
    expect(row.summary).toContain("(Post 0.42 USD)");
    expect(row.metadata).toMatchObject({ reason: "ok" });
  });

  it("DataSource → row uses name + type + recordCount", () => {
    const row = fromDataSource({
      id: "ds1", userId: "u1", name: "ar.csv", type: "ar",
      status: "ready", recordCount: 8, metadata: null, contentHash: null, createdAt: ts,
    });
    expect(row.summary).toContain("ar.csv");
    expect(row.summary).toContain("8 rows");
    expect(row.metadata).toMatchObject({ type: "ar", recordCount: 8 });
  });

  it("Document → includes period when present", () => {
    const row = fromDocument({
      id: "doc1", userId: "u1", type: "close_package", title: "April Close", body: "",
      dataSourceId: null, period: "2026-04", createdAt: ts, updatedAt: ts,
    });
    expect(row.summary).toContain("close_package");
    expect(row.summary).toContain("(period 2026-04)");
  });

  it("MatchRun → uses completedAt when set", () => {
    const completedAt = new Date("2026-04-16T10:00:00Z");
    const row = fromMatchRun({
      id: "mr1", userId: "u1", periodKey: "2026-04", triggeredBy: "agent",
      strategyConfig: {}, totalGL: 100, totalSub: 90, matched: 85, partial: 0, unmatched: 5,
      startedAt: ts, completedAt,
    });
    expect(row.timestamp).toBe(completedAt.toISOString());
    expect(row.summary).toContain("85/190 matched");
  });

  it("MatchRun → falls back to startedAt when completedAt null", () => {
    const row = fromMatchRun({
      id: "mr2", userId: "u1", periodKey: "2026-04", triggeredBy: "agent",
      strategyConfig: {}, totalGL: 0, totalSub: 0, matched: 0, partial: 0, unmatched: 0,
      startedAt: ts, completedAt: null,
    });
    expect(row.timestamp).toBe(ts.toISOString());
  });
});
