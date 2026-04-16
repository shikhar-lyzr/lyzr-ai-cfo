import { describe, it, expect } from "vitest";
import { runMatchRun } from "../match-engine";
import { DEFAULT_STRATEGY_CONFIG } from "../types";
import type { GLEntryInput, SubLedgerEntryInput } from "../types";

function gl(
  id: string, ref: string, amount: number, date: string,
  memo = "", counterparty: string | undefined = "Acme"
): GLEntryInput {
  return {
    id, reference: ref,
    entryDate: new Date(date), postingDate: new Date(date),
    account: "2100", memo, amount, txnCurrency: "USD", baseAmount: amount,
    debitCredit: "DR", counterparty,
  };
}
function sub(
  id: string, ref: string, amount: number, date: string,
  memo = "", counterparty: string | undefined = "Acme"
): SubLedgerEntryInput {
  return {
    id, reference: ref, sourceModule: "AP",
    entryDate: new Date(date), account: "2100", memo,
    amount, txnCurrency: "USD", baseAmount: amount, counterparty,
  };
}

describe("runMatchRun", () => {
  it("matches exact first, then tolerance, then fuzzy; no double-matching", () => {
    // g3/s3 share amount+date but have different counterparties so tolerance
    // skips (gate) and fuzzy wins on memo similarity.
    const gls = [
      gl("g1", "INV-001", 100, "2026-04-01"),                            // exact
      gl("g2", "INV-002", 200.5, "2026-04-01"),                          // tolerance (amount)
      gl("g3", "INV-003", 300, "2026-04-01", "Acme pmt", "AcmeCo"),      // fuzzy
      gl("g4", "INV-004", 400, "2026-04-01"),                            // gl-only
    ];
    const subs = [
      sub("s1", "INV-001", 100, "2026-04-01"),
      sub("s2", "INV-OTHER", 200, "2026-04-02"),
      sub("s3", "INV-OTHER2", 300, "2026-04-01", "Acme payment", "Acme, Inc."),
      sub("s5", "INV-999", 999, "2026-04-01"),                           // sub-only
    ];
    const res = runMatchRun(gls, subs, DEFAULT_STRATEGY_CONFIG);

    expect(res.links.find((l) => l.strategy === "exact")?.glId).toBe("g1");
    expect(res.links.find((l) => l.strategy === "tolerance")?.glId).toBe("g2");
    expect(res.links.find((l) => l.strategy === "fuzzy")?.glId).toBe("g3");
    expect(res.links).toHaveLength(3);

    expect(res.breaks).toContainEqual({ side: "gl_only", entryId: "g4" });
    expect(res.breaks).toContainEqual({ side: "sub_only", entryId: "s5" });
    expect(res.breaks).toHaveLength(2);

    // matched = total links (3); partial is a subset of matched (1); unmatched = break rows (2).
    expect(res.stats).toEqual({ totalGL: 4, totalSub: 4, matched: 3, partial: 1, unmatched: 2 });
  });

  it("honours disabled strategies", () => {
    const gls = [gl("g1", "INV-001", 100, "2026-04-01")];
    const subs = [sub("s1", "INV-001", 100, "2026-04-01")];
    const res = runMatchRun(gls, subs, {
      exact: false,
      tolerance: { enabled: false, amount: 1, daysPlus: 2, daysMinus: 2 },
      fuzzy: { enabled: false, threshold: 0.85 },
    });
    expect(res.links).toHaveLength(0);
    expect(res.breaks).toHaveLength(2);
  });
});
