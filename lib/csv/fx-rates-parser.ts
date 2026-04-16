import type { FXRateInput } from "@/lib/reconciliation/types";

export function parseFxRatesCsv(headers: string[], rows: string[][]): FXRateInput[] {
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase().trim() === name);
  const iFrom = idx("from_currency");
  const iTo = idx("to_currency");
  const iRate = idx("rate");
  const iAsOf = idx("as_of");
  if (iFrom < 0 || iTo < 0 || iRate < 0 || iAsOf < 0) {
    throw new Error("FX CSV missing required headers");
  }
  const out: FXRateInput[] = [];
  for (const r of rows) {
    const rate = Number(r[iRate]);
    const asOf = new Date(r[iAsOf]);
    if (!Number.isFinite(rate) || isNaN(asOf.getTime())) continue;
    out.push({
      fromCurrency: r[iFrom].toUpperCase(),
      toCurrency: r[iTo].toUpperCase(),
      rate,
      asOf,
    });
  }
  return out;
}
