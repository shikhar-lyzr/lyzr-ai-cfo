/**
 * CSV shape detector.
 *
 * Fast-path regex classification of CSV headers into "variance", "ar", or
 * "unknown". Falls back to LLM when regex is inconclusive.
 */

import { inferCsvShape } from "./llm-mapper";

export type CsvShape = "variance" | "ar" | "gl" | "sub_ledger" | "fx" | "capital_components" | "rwa_breakdown" | "unknown";

/**
 * Classify a CSV by its headers.
 *
 * 1. Fast-path regex — AR if headers contain invoice/due date/customer signals;
 *    variance if they contain budget+actual signals.
 * 2. LLM fallback when regex returns "unknown".
 */
export async function detectCsvShape(headers: string[]): Promise<CsvShape> {
  const fast = detectFastPath(headers);
  if (fast !== "unknown") return fast;
  return inferCsvShape(headers);
}

/** Pure regex classifier — no I/O. */
export function detectFastPath(headers: string[]): CsvShape {
  const joined = headers.map((h) => h.toLowerCase()).join(" | ");

  // FX-rates: from_currency + to_currency + rate
  if (
    (/from[_\s-]?currency|(^|\|)\s*from\s*($|\|)|\bbase[_\s-]?currency\b/i.test(joined)) &&
    (/to[_\s-]?currency|(^|\|)\s*to\s*($|\|)|\bquote[_\s-]?currency\b/i.test(joined)) &&
    /\brate\b/i.test(joined)
  ) return "fx";

  // GL and sub-ledger have unique header signals — check first.
  if (/debit[_\s-]?credit|\bdr[_\s/-]?cr\b|\bdr\s*\/\s*cr\b/i.test(joined)) return "gl";
  if (/source[_\s-]?module|(^|\|)\s*module\s*($|\|)/i.test(joined)) return "sub_ledger";

  // Capital-flow shapes. risk_type is the most-specific RWA signal, so it
  // wins over capital_components in the ambiguous case.
  const hasRiskType = /risk[_\s-]?type/i.test(joined);
  if (hasRiskType) return "rwa_breakdown";

  const hasComponent = /\bcomponent\b/i.test(joined);
  const hasAmountCol = /\bamount\b/i.test(joined);
  const hasPeriod = /\bperiod\b/i.test(joined);
  if (hasComponent && hasAmountCol && hasPeriod) return "capital_components";

  const hasInvoice = /invoice|inv[_\s-]?(no|num|number|id)/i.test(joined);
  const hasDueDate = /due[_\s-]?date|payment[_\s-]?due/i.test(joined);
  const hasCustomer = /customer|client|debtor|buyer/i.test(joined);
  const hasAmountDue = /amount[_\s-]?(due|outstanding|owed|receivable)|balance|total[_\s-]?due/i.test(joined);

  const hasBudget = /budget|plan|forecast|target/i.test(joined);
  const hasActual = /actual|spent|real(ized|ised)?/i.test(joined);

  // AR: need invoice + at least one of (due date, customer, amount due)
  const arSignals = [hasInvoice, hasDueDate, hasCustomer, hasAmountDue].filter(Boolean).length;
  if (hasInvoice && arSignals >= 2) return "ar";

  // Variance: need both budget and actual
  if (hasBudget && hasActual) return "variance";

  return "unknown";
}
