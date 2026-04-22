// Expand a close-page periodKey to the monthly keys that the reconciliation
// engine uses for MatchRun/GLEntry/SubLedgerEntry/Break rows.
//
// The picker on /monthly-close unions ReconPeriod.periodKey (always monthly)
// with DISTINCT FinancialRecord.period (arbitrary labels like "2026-Q1",
// "2026", "FY26"). When the user picks a non-monthly key the recon-backed
// signals find zero rows because the underlying columns only hold monthly
// values. Expansion translates quarterly/yearly keys to their month members
// so the readiness and task queries aggregate correctly.
//
// Unknown shapes pass through unchanged so custom budget period labels keep
// working (FinancialRecord.period can be anything the CSV supplies).

const QUARTER_RE = /^(\d{4})-[Qq]([1-4])$/;
const YEAR_RE = /^(\d{4})$/;

export function expandPeriodKey(key: string): string[] {
  const q = key.match(QUARTER_RE);
  if (q) {
    const [, year, qn] = q;
    const startMonth = (Number(qn) - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${year}-${String(startMonth + i).padStart(2, "0")}`);
  }
  const y = key.match(YEAR_RE);
  if (y) {
    const [, year] = y;
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }
  return [key];
}
