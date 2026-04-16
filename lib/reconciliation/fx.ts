import type { FXRateInput } from "./types";

export function convert(
  amount: number,
  from: string,
  to: string,
  asOf: Date,
  rates: FXRateInput[]
): number {
  if (from === to) return amount;

  const candidates = rates
    .filter((r) => r.fromCurrency === from && r.toCurrency === to && r.asOf <= asOf)
    .sort((a, b) => b.asOf.getTime() - a.asOf.getTime());

  if (candidates.length === 0) {
    throw new Error(`no FX rate for ${from}→${to} on or before ${asOf.toISOString()}`);
  }

  return amount * candidates[0].rate;
}
