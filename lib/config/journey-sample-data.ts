// Monthly Close
export const MONTHLY_CLOSE_STEPS = [
  { name: "Sub-ledger Close", completed: 14, total: 14 },
  { name: "Interco Recon", completed: 8, total: 8 },
  { name: "Journal Entries", completed: 42, total: 56 },
  { name: "Consolidation", completed: 0, total: 3 },
  { name: "Reporting Package", completed: 0, total: 1 },
];

export const MONTHLY_CLOSE_BLOCKERS = [
  "Frankfurt entity — 3 unreconciled interco positions (¥12.4B)",
  "Tokyo HQ — 14 journal entries pending controller review",
  "London Branch — FX hedge rollover awaiting CFO sign-off",
];

// Financial Reconciliation
export const RECON_METRICS = [
  { label: "Matched", value: "4,105", sublabel: "transactions" },
  { label: "Match Rate", value: "94.85%", sublabel: "+1.2% vs prior" },
  { label: "Exceptions", value: "223", sublabel: "47 > 30 days" },
  { label: "Exposure", value: "¥47.2M", sublabel: "8 genuine errors" },
];

export const RECON_EXCEPTIONS = [
  { ref: "TXN-8847", amount: "¥12.3M", type: "Missing", age: "45 days", entity: "Tokyo HQ" },
  { ref: "TXN-9012", amount: "¥8.7M", type: "Timing", age: "12 days", entity: "London" },
  { ref: "TXN-9103", amount: "¥6.2M", type: "Error", age: "38 days", entity: "Frankfurt" },
  { ref: "TXN-9210", amount: "¥4.8M", type: "Fee", age: "7 days", entity: "Singapore" },
  { ref: "TXN-9315", amount: "¥3.1M", type: "Missing", age: "52 days", entity: "New York" },
];

// Regulatory Capital
export const CAPITAL_RATIOS = [
  { label: "CET1", value: "13.2%", minimum: "4.5%", status: "above" as const },
  { label: "Tier 1", value: "15.1%", minimum: "6.0%", status: "above" as const },
  { label: "Total Capital", value: "17.8%", minimum: "8.0%", status: "above" as const },
];

// IFRS 9 ECL
export const ECL_STAGES = [
  { stage: "Stage 1 (Performing)", amount: "¥847.2B", pct: 89.4, delta: "-0.3%" },
  { stage: "Stage 2 (Under-performing)", amount: "¥85.1B", pct: 9.0, delta: "+0.8%" },
  { stage: "Stage 3 (Non-performing)", amount: "¥15.3B", pct: 1.6, delta: "+0.3%" },
];

export const ECL_MIGRATIONS = [
  { from: "Stage 1", to: "Stage 2", amount: "¥12.3B", delta: "+0.8%" },
  { from: "Stage 2", to: "Stage 3", amount: "¥2.1B", delta: "+0.3%" },
];

// Daily Liquidity
export const LIQUIDITY_METRICS = [
  { label: "LCR", value: "141%", minimum: "100%", delta: "+3%" },
  { label: "NSFR", value: "118%", minimum: "100%", delta: "-1%" },
  { label: "Cash Position", value: "¥234.5B", minimum: null, delta: "+¥12.3B" },
];

// Regulatory Returns
export const FILING_STATUS = [
  { name: "COREP", status: "draft" as const, due: "2026-04-30", completion: 45 },
  { name: "FINREP", status: "submitted" as const, due: "2026-04-15", completion: 100 },
  { name: "FR Y-9C", status: "validated" as const, due: "2026-05-15", completion: 78 },
  { name: "FRTB IMA", status: "draft" as const, due: "2026-06-30", completion: 15 },
];
