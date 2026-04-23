import type { FXRateInput } from "@/lib/reconciliation/types";
import { findHeader, parseAmount, parseDate, detectDateFormat } from "./utils";

export interface FxParseResult {
  rates: FXRateInput[];
  skipped: Array<{ row: number; reason: string }>;
}

export function parseFxRatesCsv(headers: string[], rows: string[][]): FxParseResult {
  const iFrom = findHeader(headers, "from_currency", ["from", "base_currency"]);
  const iTo   = findHeader(headers, "to_currency",   ["to",   "quote_currency"]);
  const iRate = findHeader(headers, "rate", ["exchange_rate", "fx_rate"]);
  const iAsOf = findHeader(headers, "as_of", ["date", "rate_date"]);

  if (iFrom < 0 || iTo < 0 || iRate < 0 || iAsOf < 0) {
    throw new Error("FX CSV missing required headers");
  }

  const dateFormat = detectDateFormat(rows.map((r) => r[iAsOf]).filter(Boolean));

  const rates: FXRateInput[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rate = parseAmount(r[iRate]);
    if (rate === null) {
      skipped.push({ row: i + 2, reason: "non-numeric rate" });
      continue;
    }
    const asOf = parseDate(r[iAsOf], dateFormat);
    if (!asOf) {
      skipped.push({ row: i + 2, reason: "bad as_of date" });
      continue;
    }
    rates.push({
      fromCurrency: r[iFrom].toUpperCase(),
      toCurrency: r[iTo].toUpperCase(),
      rate,
      asOf,
    });
  }

  return { rates, skipped };
}
