export type DecisionStatus = "pending" | "approved" | "rejected" | "needs_info";
export type DecisionOutcome = "approve" | "reject" | "needs_info";

const TABLE: Record<DecisionStatus, Partial<Record<DecisionOutcome, DecisionStatus>>> = {
  pending:    { approve: "approved", reject: "rejected", needs_info: "needs_info" },
  needs_info: { approve: "approved", reject: "rejected" },
  approved:   {},
  rejected:   {},
};

export function legalTransition(
  current: DecisionStatus,
  outcome: DecisionOutcome,
): DecisionStatus | null {
  return TABLE[current]?.[outcome] ?? null;
}
