/**
 * Basel III Pillar 1 minimum capital ratios.
 *
 * Callers read these via effectiveMinimum() rather than the constant
 * directly — so the C-phase (CCB / CCyB / G-SIB buffers) can return
 * "minimum + required_buffer" from here without changing any caller.
 */
export const BASEL_III_MINIMUMS = {
  cet1: 0.045,
  tier1: 0.060,
  total: 0.080,
} as const;

export type RatioKey = keyof typeof BASEL_III_MINIMUMS;

export function effectiveMinimum(key: RatioKey): number {
  return BASEL_III_MINIMUMS[key];
}

export type RatioStatus = "above_buffer" | "above_minimum" | "below_minimum";

export function ratioStatus(value: number, key: RatioKey): RatioStatus {
  // B-phase: only above_buffer and below_minimum are reachable. The
  // above_minimum tier exists so C-phase can insert buffer-aware logic
  // here without changing the type or callers.
  return value < effectiveMinimum(key) ? "below_minimum" : "above_buffer";
}
