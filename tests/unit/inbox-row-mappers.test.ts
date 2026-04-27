import { describe, it, expect } from "vitest";
import { decisionToRow, actionToRow, type InboxRow } from "@/app/(shell)/decision-inbox/inbox-row";

describe("inbox-row mappers", () => {
  it("decisionToRow maps a post_journal Decision to an InboxRow", () => {
    const d = {
      id: "dec_1",
      userId: "u1",
      type: "post_journal",
      proposalRef: "p1",
      refModel: "AdjustmentProposal",
      headline: "Post 100 USD",
      detail: "Break b_1",
      status: "pending",
      decidedBy: null,
      decidedAt: null,
      reason: null,
      createdAt: new Date("2026-04-27T10:00:00Z"),
      updatedAt: new Date("2026-04-27T10:00:00Z"),
      proposal: null,
    };
    const row = decisionToRow(d as any);
    expect(row.source).toBe("decision");
    expect(row.kind).toBe("post_journal");
    expect(row.id).toBe("dec_1");
    expect(row.headline).toBe("Post 100 USD");
    expect(row.detail).toBe("Break b_1");
    expect(row.createdAt).toEqual(new Date("2026-04-27T10:00:00Z"));
    expect(row.decision).toBe(d);
    expect(row.action).toBeUndefined();
  });

  it("actionToRow maps a variance Action to an InboxRow", () => {
    const a = {
      id: "act_1",
      userId: "u1",
      type: "variance",
      severity: "medium",
      headline: "Revenue down 12% vs budget",
      detail: "EMEA segment driver",
      driver: "EMEA",
      status: "pending",
      sourceDataSourceId: "ds1",
      invoiceId: null,
      draftBody: null,
      createdAt: new Date("2026-04-27T11:00:00Z"),
      sourceName: "Q1 Budget",
    };
    const row = actionToRow(a as any);
    expect(row.source).toBe("action");
    expect(row.kind).toBe("variance");
    expect(row.id).toBe("act_1");
    expect(row.headline).toBe("Revenue down 12% vs budget");
    expect(row.detail).toBe("EMEA segment driver");
    expect(row.action).toBe(a);
    expect(row.decision).toBeUndefined();
  });

  it("actionToRow preserves all five action kinds", () => {
    const kinds = ["variance", "anomaly", "recommendation", "ar_followup", "reconciliation_break"];
    for (const t of kinds) {
      const row = actionToRow({
        id: `a_${t}`, userId: "u", type: t, severity: "low",
        headline: t, detail: null, driver: "", status: "pending",
        sourceDataSourceId: null, invoiceId: null, draftBody: null,
        createdAt: new Date(),
      } as any);
      expect(row.kind).toBe(t);
    }
  });
});
