import { describe, it, expect } from "vitest";
import { exactMatch } from "../../strategies/exact";
import type { GLEntryInput, SubLedgerEntryInput } from "../../types";

function gl(id: string, reference: string, baseAmount: number): GLEntryInput {
  return {
    id, reference, baseAmount,
    entryDate: new Date("2026-04-01"),
    postingDate: new Date("2026-04-01"),
    account: "2100-AP",
    amount: baseAmount, txnCurrency: "USD",
    debitCredit: "DR",
  };
}

function sub(id: string, reference: string, baseAmount: number): SubLedgerEntryInput {
  return {
    id, reference, baseAmount,
    sourceModule: "AP",
    entryDate: new Date("2026-04-01"),
    account: "2100-AP",
    amount: baseAmount, txnCurrency: "USD",
  };
}

describe("exactMatch", () => {
  it("links entries sharing the same reference", () => {
    const gls = [gl("g1", "INV-001", 100), gl("g2", "INV-002", 200)];
    const subs = [sub("s1", "INV-001", 100), sub("s2", "INV-002", 200)];
    const { links, residualGL, residualSub } = exactMatch(gls, subs);
    expect(links).toHaveLength(2);
    expect(residualGL).toHaveLength(0);
    expect(residualSub).toHaveLength(0);
    expect(links[0]).toMatchObject({
      strategy: "exact", confidence: 1, amountDelta: 0, dateDelta: 0, partial: false,
    });
  });

  it("returns residuals for non-matching entries", () => {
    const gls = [gl("g1", "INV-001", 100)];
    const subs = [sub("s1", "INV-999", 100)];
    const { links, residualGL, residualSub } = exactMatch(gls, subs);
    expect(links).toHaveLength(0);
    expect(residualGL.map((e) => e.id)).toEqual(["g1"]);
    expect(residualSub.map((e) => e.id)).toEqual(["s1"]);
  });

  it("is one-to-one when multiple subs share a reference (first wins)", () => {
    const gls = [gl("g1", "INV-001", 100)];
    const subs = [sub("s1", "INV-001", 100), sub("s2", "INV-001", 100)];
    const { links, residualSub } = exactMatch(gls, subs);
    expect(links).toHaveLength(1);
    expect(residualSub.map((e) => e.id)).toEqual(["s2"]);
  });
});
