export interface Insight {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  cta?: { label: string; path: string };
}

export const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "ins-1",
    severity: "warning",
    title: "SMB Revenue Miss: -$12.4M (-6.9%)",
    detail: "SMB segment revenue of $168.6M came in $12.4M below the $181.0M forecast. Macro headwinds in the mid-market segment are the primary driver. This is the largest single-segment variance this quarter.",
    cta: { label: "Run Variance Analysis", path: "/financial-reconciliation" },
  },
  {
    id: "ins-2",
    severity: "critical",
    title: "Executive T&E Anomaly Detected",
    detail: "VP Sales James Mitchell T&E is 312% above peer average ($124,100 Q1 vs peer avg $30,567).",
    cta: { label: "View Expense Report", path: "/monthly-close" },
  },
  {
    id: "ins-3",
    severity: "warning",
    title: "5 Vendors Below Risk Threshold",
    detail: "High-risk vendors: CloudHost Inc (3.2/10), DataVault Systems (4.1/10), CloudBridge CDN (4.8/10), Innovatech Labs (3.8/10), DataProtect360 (4.4/10). 5 are single-source dependencies.",
    cta: { label: "Score Vendors", path: "/financial-reconciliation" },
  },
  {
    id: "ins-4",
    severity: "info",
    title: "Q1 Close Readiness at 68%",
    detail: "Sub-ledger close and interco recon complete. Journal entries 42/56 posted. Consolidation and reporting package pending.",
    cta: { label: "View Close Status", path: "/monthly-close" },
  },
  {
    id: "ins-5",
    severity: "warning",
    title: "LCR Trending Down — 141% (was 148%)",
    detail: "Liquidity coverage ratio dropped 7 points MoM. Still above 100% minimum but approaching internal buffer threshold of 130%.",
    cta: { label: "Check Liquidity", path: "/daily-liquidity" },
  },
  {
    id: "ins-6",
    severity: "info",
    title: "IFRS 9 Stage 2 Migration +0.8% MoM",
    detail: "Stage 2 (under-performing) portfolio grew by ¥12.3B. Driven primarily by three corporate exposures in the manufacturing sector.",
  },
];
