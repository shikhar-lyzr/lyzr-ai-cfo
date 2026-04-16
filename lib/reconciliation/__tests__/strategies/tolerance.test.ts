import { describe, it, expect } from "vitest";
import { toleranceMatch } from "../../strategies/tolerance";
import type { GLEntryInput, SubLedgerEntryInput } from "../../types";

function gl(id: string, ref: string, amount: number, date: string, cp = "Acme"): GLEntryInput {
  return {
    id, reference: ref,
    entryDate: new Date(date), postingDate: new Date(date),
    account: "2100-AP", memo: "",
    amount, txnCurrency: "USD", baseAmount: amount,
    debitCredit: "DR", counterparty: cp,
  };
}

function sub(id: string, ref: string, amount: number, date: string, cp = "Acme"): SubLedgerEntryInput {
  return {
    id, reference: ref, sourceModule: "AP",
    entryDate: new Date(date),
    account: "2100-AP", memo: "",
    amount, txnCurrency: "USD", baseAmount: amount,
    counterparty: cp,
  };
}

const cfg = { enabled: true, amount: 1.0, daysPlus: 2, daysMinus: 2 };

describe("toleranceMatch", () => {
  it("matches when amount and date deltas are within tolerance and counterparty matches", () => {
    const { links } = toleranceMatch(
      [gl("g1", "A", 100, "2026-04-01")],
      [sub("s1", "B", 100.5, "2026-04-02")],
      cfg
    );
    expect(links).toHaveLength(1);
    expect(links[0].strategy).toBe("tolerance");
    expect(links[0].partial).toBe(true);
    expect(links[0].amountDelta).toBeCloseTo(0.5);
    expect(links[0].dateDelta).toBe(1);
  });

  it("rejects when amount delta exceeds tolerance", () => {
    const { links, residualGL, residualSub } = toleranceMatch(
      [gl("g1", "A", 100, "2026-04-01")],
      [sub("s1", "B", 102, "2026-04-01")],
      cfg
    );
    expect(links).toHaveLength(0);
    expect(residualGL).toHaveLength(1);
    expect(residualSub).toHaveLength(1);
  });

  it("rejects when date delta exceeds tolerance", () => {
    const { links } = toleranceMatch(
      [gl("g1", "A", 100, "2026-04-01")],
      [sub("s1", "B", 100, "2026-04-05")],
      cfg
    );
    expect(links).toHaveLength(0);
  });

  it("rejects when counterparty differs", () => {
    const { links } = toleranceMatch(
      [gl("g1", "A", 100, "2026-04-01", "Acme")],
      [sub("s1", "B", 100, "2026-04-01", "Other")],
      cfg
    );
    expect(links).toHaveLength(0);
  });

  it("flags partial=false when amount delta is exactly zero", () => {
    const { links } = toleranceMatch(
      [gl("g1", "A", 100, "2026-04-01")],
      [sub("s1", "B", 100, "2026-04-02")],
      cfg
    );
    expect(links[0].partial).toBe(false);
  });

  it("is one-to-one — each sub used at most once", () => {
    const { links, residualGL } = toleranceMatch(
      [gl("g1", "A", 100, "2026-04-01"), gl("g2", "B", 100, "2026-04-01")],
      [sub("s1", "X", 100, "2026-04-01")],
      cfg
    );
    expect(links).toHaveLength(1);
    expect(residualGL).toHaveLength(1);
  });
});
