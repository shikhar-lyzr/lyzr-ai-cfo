import type { Decision, Action } from "@prisma/client";

export type InboxRowKind =
  | "post_journal"
  | "variance"
  | "anomaly"
  | "recommendation"
  | "ar_followup"
  | "reconciliation_break";

export type DecisionWithProposal = Decision & {
  proposal: {
    id: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    currency: string;
    description: string;
    break?: { id: string; side: string; periodKey?: string } | null;
  } | null;
};

export type ActionWithSource = Action & { sourceName?: string | null };

export type InboxRow = {
  source: "decision" | "action";
  id: string;
  kind: InboxRowKind;
  headline: string;
  detail: string | null;
  createdAt: Date;
  decision?: DecisionWithProposal;
  action?: ActionWithSource;
};

export function decisionToRow(d: DecisionWithProposal): InboxRow {
  return {
    source: "decision",
    id: d.id,
    kind: d.type as InboxRowKind,
    headline: d.headline,
    detail: d.detail,
    createdAt: d.createdAt,
    decision: d,
  };
}

export function actionToRow(a: ActionWithSource): InboxRow {
  return {
    source: "action",
    id: a.id,
    kind: a.type as InboxRowKind,
    headline: a.headline,
    detail: a.detail,
    createdAt: a.createdAt,
    action: a,
  };
}
