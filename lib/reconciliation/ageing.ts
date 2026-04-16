import type { AgeBucket, Severity } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageDays(entryDate: Date, today: Date): number {
  return Math.floor((today.getTime() - entryDate.getTime()) / DAY_MS);
}

export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export function severity(days: number, baseAmount: number): Severity {
  const abs = Math.abs(baseAmount);
  if (days > 60 || abs > 10_000) return "high";
  if (days > 30 || abs > 1_000) return "medium";
  return "low";
}

export function severityRank(s: "low" | "medium" | "high"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}
