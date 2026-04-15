export type DecisionVerdict = "pass" | "fail" | "warning";
export type DecisionPriority = "critical" | "high" | "medium" | "low";
export type DecisionStatus = "pending" | "approved" | "rejected" | "flagged";

export interface ComplianceCheck {
  name: string;
  verdict: DecisionVerdict;
  detail: string;
}

export interface DecisionItem {
  id: string;
  title: string;
  description: string;
  journey: string;
  journeyStep: string;
  priority: DecisionPriority;
  status: DecisionStatus;
  agent: string;
  requestedAt: string;
  amount?: string;
  entity?: string;
  what: string;
  evidence: string[];
  skillUsed: string;
  triggeredBy: string;
  complianceChecks: ComplianceCheck[];
}

export const SAMPLE_DECISIONS: DecisionItem[] = [
  {
    id: "DI-001",
    title: "Post adjusting journal entry — ¥52.3M IC elimination",
    description:
      "Agent recommends posting intercompany elimination between Tokyo HQ and London Branch.",
    journey: "Monthly Close",
    journeyStep: "Step 4 (Consolidation)",
    priority: "critical",
    status: "pending",
    agent: "Monthly Close Orchestrator",
    requestedAt: "2 hours ago",
    amount: "¥52,300,000",
    entity: "Tokyo HQ ↔ London Branch",
    what: "Post adjusting journal entry for intercompany elimination of ¥52,300,000 between Tokyo HQ and London Branch per IFRS 10 consolidation requirements.",
    evidence: [
      "Source: IC Reconciliation output — matched position confirmed",
      "Matching IC balance confirmed: ¥52,300,000 both sides",
      "Exchange rate: GBP/JPY 191.24 (BOJ fixing 2026-03-31)",
      "Previous month: similar elimination of ¥48.7M",
    ],
    skillUsed: "close-orchestration",
    triggeredBy: "Automated close pipeline — Step 4",
    complianceChecks: [
      {
        name: "Threshold & Authorization",
        verdict: "pass",
        detail:
          "Amount ¥52.3M is within Controller auto-approve threshold of ¥100M",
      },
      {
        name: "Audit Trail Completeness",
        verdict: "pass",
        detail: "Source reconciliation attached, matching positions verified",
      },
      {
        name: "Regulatory Compliance",
        verdict: "pass",
        detail: "IC elimination follows IFRS 10 consolidation requirements",
      },
    ],
  },
  {
    id: "DI-002",
    title: "Accrual journal — ¥8.4M unbilled revenue",
    description:
      "Agent recommends accruing unbilled revenue for Tokyo services rendered in Q1 but not yet invoiced.",
    journey: "Monthly Close",
    journeyStep: "Step 3 (Journal Entries)",
    priority: "high",
    status: "pending",
    agent: "CFO Office Agent",
    requestedAt: "4 hours ago",
    amount: "¥8,400,000",
    entity: "Tokyo HQ",
    what: "Post accrual journal entry for unbilled professional services revenue recognized per ASC 606.",
    evidence: [
      "Contract reviewed: MSA-2026-014",
      "Service delivery confirmed by engagement lead",
      "Prior quarter baseline: ¥7.9M accrual",
    ],
    skillUsed: "variance-review",
    triggeredBy: "Automated close pipeline — Step 3",
    complianceChecks: [
      {
        name: "Threshold & Authorization",
        verdict: "pass",
        detail: "Below ¥10M materiality threshold",
      },
      {
        name: "Audit Trail Completeness",
        verdict: "pass",
        detail: "Contract and delivery evidence linked",
      },
      {
        name: "Regulatory Compliance",
        verdict: "pass",
        detail: "ASC 606 revenue recognition criteria met",
      },
    ],
  },
  {
    id: "DI-003",
    title: "FX hedge rollover — GBP 45M GBP/JPY forward",
    description:
      "Agent proposes rolling forward GBP/JPY hedge position to maintain treasury policy coverage.",
    journey: "Daily Liquidity",
    journeyStep: "Treasury Ops",
    priority: "critical",
    status: "flagged",
    agent: "CFO Office Agent",
    requestedAt: "5 hours ago",
    amount: "GBP 45,000,000",
    entity: "London Branch",
    what: "Roll forward GBP/JPY forward hedge at current market rate for 90-day tenor.",
    evidence: [
      "Treasury policy: minimum 60% FX exposure hedged",
      "Current hedge ratio: 58% (below threshold)",
      "Market rate: GBP/JPY 191.24",
    ],
    skillUsed: "treasury-ops",
    triggeredBy: "Automated hedge ratio monitor",
    complianceChecks: [
      {
        name: "Threshold & Authorization",
        verdict: "warning",
        detail: "Above ¥1M auto-approve threshold — requires CFO sign-off",
      },
      {
        name: "Audit Trail Completeness",
        verdict: "pass",
        detail: "Treasury policy referenced, market rates captured",
      },
      {
        name: "Regulatory Compliance",
        verdict: "pass",
        detail: "ASC 815 hedge accounting designation maintained",
      },
    ],
  },
];
