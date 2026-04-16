import { describe, it, expect } from "vitest";
import { fuzzyMatch, jaroWinkler } from "../../strategies/fuzzy";
import type { GLEntryInput, SubLedgerEntryInput } from "../../types";

describe("jaroWinkler", () => {
  it("returns 1 for identical strings", () => {
    expect(jaroWinkler("MARTHA", "MARTHA")).toBe(1);
  });
  it("returns 0 for fully disjoint strings", () => {
    expect(jaroWinkler("abc", "xyz")).toBe(0);
  });
  it("returns mid-range for similar strings", () => {
    expect(jaroWinkler("MARTHA", "MARHTA")).toBeGreaterThan(0.95);
    expect(jaroWinkler("DIXON", "DICKSONX")).toBeGreaterThan(0.8);
  });
});

function gl(id: string, ref: string, amount: number, memo: string): GLEntryInput {
  return {
    id, reference: ref,
    entryDate: new Date("2026-04-01"), postingDate: new Date("2026-04-01"),
    account: "2100", memo, amount, txnCurrency: "USD", baseAmount: amount,
    debitCredit: "DR",
  };
}

function sub(id: string, ref: string, amount: number, memo: string): SubLedgerEntryInput {
  return {
    id, reference: ref, sourceModule: "AP",
    entryDate: new Date("2026-04-01"), account: "2100", memo,
    amount, txnCurrency: "USD", baseAmount: amount,
  };
}

const cfg = { enabled: true, threshold: 0.85 };

describe("fuzzyMatch", () => {
  it("matches on memo similarity and amount proximity", () => {
    const { links } = fuzzyMatch(
      [gl("g1", "A", 100, "Acme Corp payment 123")],
      [sub("s1", "B", 101, "ACME CORP PMT 123")],
      cfg
    );
    expect(links).toHaveLength(1);
    expect(links[0].strategy).toBe("fuzzy");
    expect(links[0].confidence).toBeGreaterThan(0.85);
  });

  it("rejects below threshold", () => {
    const { links } = fuzzyMatch(
      [gl("g1", "A", 100, "totally different memo")],
      [sub("s1", "B", 100, "entirely unrelated text")],
      cfg
    );
    expect(links).toHaveLength(0);
  });

  it("rejects when amount proximity is terrible (>5% off)", () => {
    const { links } = fuzzyMatch(
      [gl("g1", "A", 100, "Acme payment")],
      [sub("s1", "B", 500, "Acme payment")],
      cfg
    );
    expect(links).toHaveLength(0);
  });
});
