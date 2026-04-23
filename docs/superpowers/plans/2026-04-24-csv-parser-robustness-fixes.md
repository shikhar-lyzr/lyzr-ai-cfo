# CSV Parser Robustness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the CSV parser audit pass rate from 40/56 to ≥54/56 by introducing a shared `lib/csv/utils.ts` module (findHeader + parseAmount + parseDate + detectDateFormat) consumed by all five parsers, plus extending the shape-detector regex with synonym support.

**Architecture:** Build the shared utils first with their own unit tests, then migrate the brittle parsers (GL, sub-ledger, FX) and the partially-robust AR parser to consume them. One breaking signature change on FX (`parseFxRatesCsv` returns `{rates, skipped}`) is bundled with its one production consumer and its one test file in a single commit to preserve the green-build invariant between tasks. A matrix round-trip test locks in the post-fix pass rate as a regression guard.

**Tech Stack:** TypeScript strict, Vitest, `npx tsx` for the audit script, no new dependencies.

---

## Task 1: Shared CSV utilities module + unit tests

**Files:**
- Create: `lib/csv/utils.ts`
- Create: `tests/csv/utils.test.ts`

This task introduces four pure helpers with no dependents. Safe to commit in isolation — no production code imports from it yet.

- [ ] **Step 1: Write the failing tests**

Create `tests/csv/utils.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  findHeader,
  parseAmount,
  parseDate,
  detectDateFormat,
} from "@/lib/csv/utils";

describe("findHeader", () => {
  it("matches exact canonical name", () => {
    expect(findHeader(["account", "amount", "date"], "amount")).toBe(1);
  });

  it("matches case-insensitively", () => {
    expect(findHeader(["Account", "AMOUNT", "Date"], "amount")).toBe(1);
  });

  it("normalizes underscores and spaces", () => {
    expect(findHeader(["Entry Date", "amount"], "entry_date")).toBe(0);
    expect(findHeader(["entry_date", "amount"], "entry date")).toBe(0);
    expect(findHeader(["entry-date", "amount"], "entry_date")).toBe(0);
  });

  it("falls back to aliases in order", () => {
    expect(findHeader(["Dr/Cr", "amount"], "debit_credit", ["dr_cr", "dr/cr"])).toBe(0);
  });

  it("returns -1 when nothing matches", () => {
    expect(findHeader(["a", "b", "c"], "amount")).toBe(-1);
  });
});

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("-500.00")).toBe(-500);
  });

  it("strips thousands commas", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  it("strips currency symbols from the allowlist", () => {
    expect(parseAmount("$1,234.56")).toBe(1234.56);
    expect(parseAmount("€1,234.56")).toBe(1234.56);
    expect(parseAmount("£1234")).toBe(1234);
    expect(parseAmount("¥100")).toBe(100);
    expect(parseAmount("₹2500.50")).toBe(2500.5);
  });

  it("treats accounting parens as negative", () => {
    expect(parseAmount("(500.00)")).toBe(-500);
    expect(parseAmount("($1,234.56)")).toBe(-1234.56);
  });

  it("treats trailing minus as negative", () => {
    expect(parseAmount("500.00-")).toBe(-500);
  });

  it("returns null for European decimal format", () => {
    expect(parseAmount("1.234,56")).toBeNull();
    expect(parseAmount("1 234,56")).toBeNull();
  });

  it("returns null for placeholders and empty", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("  ")).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });

  it("returns null for non-numeric content with digits embedded", () => {
    expect(parseAmount("1M")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses ISO YYYY-MM-DD", () => {
    const d = parseDate("2026-04-15");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(3); // April = 3
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses US MM/DD/YYYY by default", () => {
    const d = parseDate("04/15/2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses EU DD/MM/YYYY when format=eu is passed", () => {
    const d = parseDate("15/04/2026", "eu");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses named-month long form", () => {
    const d = parseDate("15 Apr 2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parses named-month hyphen form", () => {
    const d = parseDate("15-Apr-2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("returns null for unrecognized formats", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("2026")).toBeNull();
  });
});

describe("detectDateFormat", () => {
  it("detects US when day > 12 appears anywhere", () => {
    expect(detectDateFormat(["01/15/2026", "02/03/2026"])).toBe("us");
  });

  it("detects EU when month position > 12 under US assumption", () => {
    expect(detectDateFormat(["15/01/2026", "03/04/2026"])).toBe("eu");
  });

  it("defaults to US and warns when column is fully ambiguous", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detectDateFormat(["01/02/2026", "03/04/2026"])).toBe("us");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores ISO values for disambiguation", () => {
    expect(detectDateFormat(["2026-01-15", "2026-02-20"])).toBe("us");
  });

  it("returns US for an empty column without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detectDateFormat([])).toBe("us");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/csv/utils.test.ts`
Expected: FAIL — `lib/csv/utils.ts` does not yet export these symbols.

- [ ] **Step 3: Implement the utils**

Create `lib/csv/utils.ts`:

```ts
/**
 * Shared CSV parsing utilities used by all five shape parsers and the
 * shape detector. Pure functions — no I/O, no side effects except an
 * optional console.warn from detectDateFormat when a column is ambiguous.
 *
 * Scope intentionally excludes: European decimal/thousands formats
 * (1.234,56), Excel serial dates (45383), and file-encoding concerns.
 */

// Normalize a header string for comparison: lowercase, trim, replace
// runs of [_\s-] with a single space. "Entry_Date" and "entry date"
// both become "entry date".
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_\s-]+/g, " ");
}

export function findHeader(
  headers: string[],
  canonical: string,
  aliases: string[] = [],
): number {
  const candidates = [canonical, ...aliases].map(normalizeHeader);
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Currency symbols we strip. Explicit allowlist — we never strip
// arbitrary non-digits, so "1M" stays NaN rather than becoming 1.
const CURRENCY_SYMBOLS = "$€£¥₹";
const AMOUNT_STRIP_RE = new RegExp(`[${CURRENCY_SYMBOLS},\\s]`, "g");

export function parseAmount(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const raw = value.trim();
  if (raw === "" || raw === "-" || raw.toUpperCase() === "N/A") return null;

  // Detect accounting parens: "(500.00)" or "($1,234.56)" — negative.
  let negate = false;
  let inner = raw;
  const parens = inner.match(/^\(\s*(.+?)\s*\)$/);
  if (parens) {
    negate = true;
    inner = parens[1];
  }

  // Detect trailing minus: "500.00-" — negative.
  const trailingMinus = inner.match(/^(.+?)-\s*$/);
  if (trailingMinus) {
    negate = !negate;
    inner = trailingMinus[1];
  }

  const stripped = inner.replace(AMOUNT_STRIP_RE, "");

  // Reject European formats: if the string still contains both "." and ",",
  // or a "," that looks like a decimal separator (comma followed by 1-2
  // digits at end), bail out.
  if (/,/.test(stripped)) return null;

  // Must now be a plain number (allow leading minus sign).
  if (!/^-?\d+(\.\d+)?$/.test(stripped)) return null;

  const n = Number(stripped);
  if (!Number.isFinite(n)) return null;
  return negate ? -n : n;
}

export type DateFormat = "iso" | "us" | "eu" | "named";

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function makeDate(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (isNaN(dt.getTime())) return null;
  // Guard against JS Date's month rollover (e.g., Feb 30 -> Mar 2).
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return dt;
}

export function parseDate(value: string, format?: DateFormat): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ISO is always recognized regardless of format arg.
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // Named month: "15 Apr 2026" or "15-Apr-2026"
  const named = trimmed.match(
    /^(\d{1,2})[\s-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s-](\d{4})$/i,
  );
  if (named) {
    const m = MONTH_NAMES[named[2].toLowerCase()];
    return makeDate(Number(named[3]), m, Number(named[1]));
  }

  // Slash-delimited: ambiguous between US and EU
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    if (format === "eu") return makeDate(y, b - 1, a);
    // Default to US (when no format arg or format === "us")
    return makeDate(y, a - 1, b);
  }

  return null;
}

export function detectDateFormat(columnValues: string[]): DateFormat {
  if (columnValues.length === 0) return "us";

  let sawUsEvidence = false;
  let sawEuEvidence = false;

  for (const raw of columnValues) {
    if (!raw) continue;
    const slash = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!slash) continue; // ISO/named rows don't disambiguate
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    // Under US (MM/DD/YYYY): a=month, b=day. If b > 12, must be a day → US.
    // Under EU (DD/MM/YYYY): a=day, b=month. If a > 12, must be a day → EU.
    if (b > 12) sawUsEvidence = true;
    if (a > 12) sawEuEvidence = true;
  }

  if (sawUsEvidence && !sawEuEvidence) return "us";
  if (sawEuEvidence && !sawUsEvidence) return "eu";

  // Fully ambiguous OR both evidence (contradiction — shouldn't happen in
  // practice, but pick US and continue).
  if (!sawUsEvidence && !sawEuEvidence && columnValues.some((v) => v && /\//.test(v))) {
    console.warn(
      "CSV date column is ambiguous between US and EU format; defaulting to US (MM/DD/YYYY)",
    );
  }
  return "us";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/csv/utils.test.ts`
Expected: all 25 tests pass.

- [ ] **Step 5: Run tsc to verify types**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/csv/utils.ts tests/csv/utils.test.ts
git commit -m "feat(csv): shared utils for header/date/amount parsing"
```

---

## Task 2: Extract audit fixtures into lib/csv/__fixtures__

**Files:**
- Create: `lib/csv/__fixtures__/audit-fixtures.ts`
- Modify: `scripts/audit-csv-parsers.ts`

Extracts the `BASELINES`, `ALL_VARIANTS`, and `runMatrix` machinery from `scripts/audit-csv-parsers.ts` into a reusable module. This is a pure refactor — the audit script's behavior is unchanged; it just imports instead of inlining.

- [ ] **Step 1: Create the fixtures module**

Create `lib/csv/__fixtures__/audit-fixtures.ts`. Copy the following sections verbatim from the current `scripts/audit-csv-parsers.ts`:

- The `Csv`, `Shape`, `Outcome`, `RunResult`, `Variant`, `Cell` type declarations
- `SHAPES` constant
- `BASELINES` constant
- `keyFieldFor`, `parsedRowCount`, `runShapeOnce` functions
- `A2_SYNONYMS`, `A6_DROP_COL` constants
- `HEADER_VARIANTS` array
- `DATE_COL`, `AMOUNT_COL` constants
- `mutateColumn`, `toUsDate`, `toEuDate`, `toNamedMonth` helpers
- `CONTENT_VARIANTS` array
- `ALL_VARIANTS` combined array
- `classify` function
- `runMatrix` function

Export all top-level named symbols:

```ts
export type { Csv, Shape, Outcome, RunResult, Variant, Cell };
export { SHAPES, BASELINES, ALL_VARIANTS, HEADER_VARIANTS, CONTENT_VARIANTS };
export { keyFieldFor, parsedRowCount, runShapeOnce };
export { classify, runMatrix };
```

Do NOT copy the `OUTCOME_LABEL` constant, the `renderMatrix` / `renderPerShapeFindings` / `renderPunchList` / `renderReport` functions, or the `main` function — those stay in the audit script.

- [ ] **Step 2: Update the audit script to import from fixtures**

Modify `scripts/audit-csv-parsers.ts`. Replace the type declarations, constants, and helper functions that were copied to the fixtures module with a single import block at the top (after the existing imports):

```ts
import {
  SHAPES,
  BASELINES,
  ALL_VARIANTS,
  runShapeOnce,
  runMatrix,
  type Shape,
  type Outcome,
  type RunResult,
  type Cell,
} from "@/lib/csv/__fixtures__/audit-fixtures";
```

Remove the now-duplicated declarations from the script. The script should keep only:
- The original file-level comment block
- Any imports `audit-fixtures.ts` does NOT re-export (notably `writeFileSync` from `node:fs`, and the renderer functions)
- `OUTCOME_LABEL` constant
- `renderMatrix`, `renderPerShapeFindings`, `renderPunchList`, `renderReport`
- `main()`
- The bottom `main().catch(...)` invocation

- [ ] **Step 3: Run the audit script — confirm parity**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: the same tallies as before the refactor. Before this task the tallies were: `PASS: 40, PARTIAL: 10, FAIL_DETECT: 3, FAIL_PARSE: 3, N/A: 4`. After this task they must match exactly — nothing has been fixed yet.

- [ ] **Step 4: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: all tests pass. New utils tests from Task 1 plus existing 259 → 284 tests.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/csv/__fixtures__/audit-fixtures.ts scripts/audit-csv-parsers.ts
git commit -m "refactor(audit): extract fixtures for reuse by tests"
```

---

## Task 3: Expand shape detector synonyms

**Files:**
- Modify: `lib/csv/detect-shape.ts:26-52`

Extends three of the four fingerprint regexes in `detectFastPath` to accept synonym variants. This is the direct fix for the audit's three FAIL_DETECT cells (A2 variant on gl, sub_ledger, fx).

- [ ] **Step 1: Modify detect-shape.ts**

Replace lines 26-52 (the `detectFastPath` function body) with:

```ts
export function detectFastPath(headers: string[]): CsvShape {
  const joined = headers.map((h) => h.toLowerCase()).join(" | ");

  // FX-rates: from_currency + to_currency + rate. Accept bare from/to
  // when surrounded by pipe separators (per the joined-headers shape) and
  // base/quote currency synonyms.
  if (
    (/from[_\s-]?currency|(^|\|)\s*from\s*($|\|)|\bbase[_\s-]?currency\b/i.test(joined)) &&
    (/to[_\s-]?currency|(^|\|)\s*to\s*($|\|)|\bquote[_\s-]?currency\b/i.test(joined)) &&
    /\brate\b/i.test(joined)
  ) return "fx";

  // GL and sub-ledger have unique header signals — check first.
  if (/debit[_\s-]?credit|\bdr[_\s/-]?cr\b|\bdr\s*\/\s*cr\b/i.test(joined)) return "gl";
  if (/source[_\s-]?module|(^|\|)\s*module\s*($|\|)/i.test(joined)) return "sub_ledger";

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
```

- [ ] **Step 2: Re-run audit script to confirm FAIL_DETECT drops**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected tally changes compared to pre-task state:
- `FAIL_DETECT` should drop from 3 to 0 (A2 variants for gl, sub_ledger, fx now pass detection)
- `FAIL_PARSE` may change: the A2 variants now flow to the parsers, which still do exact-match lookup — so they're likely to FAIL_PARSE on the same rows. Tally may now show something like: `PASS: 40, PARTIAL: 10, FAIL_DETECT: 0, FAIL_PARSE: 6, N/A: 4` (exact numbers don't matter; FAIL_DETECT must be 0).
- Total still 60.

- [ ] **Step 3: Run full vitest to verify no regressions in existing tests**

Run: `npx vitest run`
Expected: all tests pass. The detector change affects `detectCsvShape` consumers but doesn't change existing-shape outputs — only expands what previously returned "unknown".

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add lib/csv/detect-shape.ts
git commit -m "feat(csv): extend shape detector with synonym regexes"
```

---

## Task 4: Migrate GL parser to shared utils

**Files:**
- Modify: `lib/csv/gl-parser.ts`

Replace exact-match header lookup + `Number()` amount parse + `new Date()` date parse with `findHeader` + `parseAmount` + `parseDate` (column-detected format).

- [ ] **Step 1: Rewrite gl-parser.ts**

Replace the full contents of `lib/csv/gl-parser.ts` with:

```ts
import type { GLEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";
import { findHeader, parseAmount, parseDate, detectDateFormat } from "./utils";

type ParsedGL = Omit<GLEntryInput, "id">;

export async function parseGlCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedGL[]; skipped: Array<{ row: number; reason: string }> }> {
  const iDate = findHeader(headers, "entry_date", ["date", "transaction_date"]);
  const iPost = findHeader(headers, "posting_date", ["post_date"]);
  const iAcc  = findHeader(headers, "account", ["gl_account", "acct"]);
  const iRef  = findHeader(headers, "reference", ["ref", "reference_number"]);
  const iMemo = findHeader(headers, "memo", ["description", "note"]);
  const iAmt  = findHeader(headers, "amount", ["amt", "value"]);
  const iCur  = findHeader(headers, "currency", ["ccy", "txn_currency"]);
  const iDC   = findHeader(headers, "debit_credit", ["dr_cr", "dr/cr"]);
  const iCp   = findHeader(headers, "counterparty", ["vendor", "payee"]);

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iDC < 0) {
    throw new Error("GL CSV missing required headers");
  }

  // Detect date format once per column so per-row parsing is consistent.
  const entryDateFormat = detectDateFormat(rows.map((r) => r[iDate]).filter(Boolean));
  const postingDateFormat = iPost >= 0
    ? detectDateFormat(rows.map((r) => r[iPost]).filter(Boolean))
    : entryDateFormat;

  const entries: ParsedGL[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = parseDate(r[iDate], entryDateFormat);
      if (!entryDate) throw new Error("bad entry_date");
      const postingDate = iPost >= 0 ? parseDate(r[iPost], postingDateFormat) ?? entryDate : entryDate;

      const amount = parseAmount(r[iAmt]);
      if (amount === null) throw new Error("non-numeric amount");

      const cur = (r[iCur] || "USD").toUpperCase();
      const baseAmount = convert(amount, cur, "USD", postingDate, rates);

      entries.push({
        entryDate, postingDate,
        account: r[iAcc], reference: r[iRef],
        memo: iMemo >= 0 ? r[iMemo] : undefined,
        amount, txnCurrency: cur, baseAmount,
        debitCredit: (r[iDC]?.toUpperCase() === "CR" ? "CR" : "DR"),
        counterparty: iCp >= 0 ? r[iCp] || undefined : undefined,
      });
    } catch (err) {
      skipped.push({ row: i + 2, reason: err instanceof Error ? err.message : "unknown" });
    }
  });

  return { entries, skipped };
}
```

- [ ] **Step 2: Run existing GL parser tests**

Run: `npx vitest run __tests__/lib/csv/gl-parser.test.ts`

Expected: all existing GL tests pass. The "throws when required headers missing" test at `__tests__/lib/csv/gl-parser.test.ts:48` must still throw — the new code preserves this because its required-column guard (`iDate < 0 || iAcc < 0 || ...`) still triggers on a truly incomplete header set.

- [ ] **Step 3: Re-run audit script**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: `gl` row of the matrix improves. A2 (synonym) now PASS, A4 (whitespace) now PASS, B4/B5/B6 (amount formatting) now PASS. Specifically:
- GL PASS count should rise by ~5
- FAIL_PARSE count should drop
- Total still 60

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv/gl-parser.ts
git commit -m "feat(csv): GL parser uses shared utils"
```

---

## Task 5: Migrate sub-ledger parser to shared utils

**Files:**
- Modify: `lib/csv/sub-ledger-parser.ts`

- [ ] **Step 1: Rewrite sub-ledger-parser.ts**

Replace the full contents with:

```ts
import type { SubLedgerEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";
import { findHeader, parseAmount, parseDate, detectDateFormat } from "./utils";

type ParsedSub = Omit<SubLedgerEntryInput, "id">;

export async function parseSubLedgerCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedSub[]; skipped: Array<{ row: number; reason: string }> }> {
  const iDate = findHeader(headers, "entry_date", ["date", "transaction_date"]);
  const iAcc  = findHeader(headers, "account", ["gl_account", "acct"]);
  const iMod  = findHeader(headers, "source_module", ["module"]);
  const iRef  = findHeader(headers, "reference", ["ref", "reference_number"]);
  const iMemo = findHeader(headers, "memo", ["description", "note"]);
  const iAmt  = findHeader(headers, "amount", ["amt", "value"]);
  const iCur  = findHeader(headers, "currency", ["ccy", "txn_currency"]);
  const iCp   = findHeader(headers, "counterparty", ["vendor", "payee"]);

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iMod < 0) {
    throw new Error("Sub-ledger CSV missing required headers");
  }

  const dateFormat = detectDateFormat(rows.map((r) => r[iDate]).filter(Boolean));

  const entries: ParsedSub[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = parseDate(r[iDate], dateFormat);
      if (!entryDate) throw new Error("bad entry_date");

      const amount = parseAmount(r[iAmt]);
      if (amount === null) throw new Error("non-numeric amount");

      const cur = (r[iCur] || "USD").toUpperCase();
      const baseAmount = convert(amount, cur, "USD", entryDate, rates);
      const mod = (r[iMod] || "AP").toUpperCase();
      const sourceModule = mod === "AR" || mod === "FA" ? mod : "AP";

      entries.push({
        entryDate, sourceModule,
        account: r[iAcc], reference: r[iRef],
        memo: iMemo >= 0 ? r[iMemo] : undefined,
        amount, txnCurrency: cur, baseAmount,
        counterparty: iCp >= 0 ? r[iCp] || undefined : undefined,
      });
    } catch (err) {
      skipped.push({ row: i + 2, reason: err instanceof Error ? err.message : "unknown" });
    }
  });

  return { entries, skipped };
}
```

- [ ] **Step 2: Run existing sub-ledger parser tests**

Run: `npx vitest run __tests__/lib/csv/sub-ledger-parser.test.ts`
Expected: all existing tests pass, including the "Sub-ledger CSV missing required headers" throw test.

- [ ] **Step 3: Re-run audit script**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: `sub_ledger` row of the matrix now resembles `gl` row — A2, A4, B4/B5/B6 improved. ~5 more PASS.

- [ ] **Step 4: Run full vitest**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv/sub-ledger-parser.ts
git commit -m "feat(csv): sub-ledger parser uses shared utils"
```

---

## Task 6: Migrate FX parser + update its consumer + test file

**Files:**
- Modify: `lib/csv/fx-rates-parser.ts` (breaking signature change)
- Modify: `lib/reconciliation/persist.ts` (FX consumer)
- Modify: `__tests__/lib/csv/fx-rates-parser.test.ts` (mechanical result[0] → result.rates[0])

This is the one commit that MUST bundle multiple files together — FX's public signature changes, and any green-between-commits rule demands the consumer and test file update in the same commit.

- [ ] **Step 1: Rewrite fx-rates-parser.ts with new signature**

Replace the full contents of `lib/csv/fx-rates-parser.ts` with:

```ts
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
```

- [ ] **Step 2: Update the FX consumer in persist.ts**

In `lib/reconciliation/persist.ts`, find the `ingestFxRates` function (~line 213). Replace the line `const rates = parseFxRatesCsv(csvHeaders, csvRows);` with:

```ts
  const { rates, skipped } = parseFxRatesCsv(csvHeaders, csvRows);
```

Find where the function returns (near the bottom of the function body). The existing return is:

```ts
  return { dataSource: updated, ratesLoaded: rates.length };
```

Replace it with:

```ts
  return { dataSource: updated, ratesLoaded: rates.length, skipped: skipped.length };
```

Anywhere else in the function body that uses `rates` (the parsed array itself, e.g. the chunking loop) continues to work unchanged — `rates` is still `FXRateInput[]`.

- [ ] **Step 3: Update fx-rates-parser.test.ts**

Open `__tests__/lib/csv/fx-rates-parser.test.ts`. Every assertion of the form `result[0].foo`, `result.length`, or `expect(result).toHaveLength(N)` needs updating. There are 6 sites (per the plan's grep). Specifically:

- `expect(result).toHaveLength(N)` → `expect(result.rates).toHaveLength(N)`
- `result[0].foo` → `result.rates[0].foo`
- Any `result.filter(...)` or `result.map(...)` stays as `result.rates.filter(...)` etc.

Do NOT change the test at line 30 (`expect(() => parseFxRatesCsv(headers, rows)).toThrow("FX CSV missing required headers")`) — that still holds because the new parser still throws in the same case.

Also add one new test at the end of the describe block:

```ts
  it("puts unparseable rows into skipped[] with row number + reason", () => {
    const headers = ["from_currency", "to_currency", "rate", "as_of"];
    const rows = [
      ["EUR", "USD", "1.08", "2026-04-01"],
      ["GBP", "USD", "not-a-number", "2026-04-01"],
      ["JPY", "USD", "0.0066", "not-a-date"],
    ];
    const result = parseFxRatesCsv(headers, rows);
    expect(result.rates).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].row).toBe(3);
    expect(result.skipped[0].reason).toContain("rate");
    expect(result.skipped[1].row).toBe(4);
    expect(result.skipped[1].reason).toContain("as_of");
  });
```

- [ ] **Step 4: Run FX tests**

Run: `npx vitest run __tests__/lib/csv/fx-rates-parser.test.ts`
Expected: all tests pass, including the new skipped-array test.

- [ ] **Step 5: Run full vitest**

Run: `npx vitest run`
Expected: all tests pass. The signature change rippled through one consumer (persist.ts) and one test file; no other consumer exists.

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Re-run audit script**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: `fx` row of the matrix improves — A2 (PASS), A4 (PASS), B5/B6 (PASS because parseAmount now handles them).

- [ ] **Step 8: Commit**

```bash
git add lib/csv/fx-rates-parser.ts lib/reconciliation/persist.ts __tests__/lib/csv/fx-rates-parser.test.ts
git commit -m "feat(csv): FX parser returns {rates, skipped} and uses shared utils"
```

---

## Task 7: Migrate AR parser to shared utils (remove local helpers)

**Files:**
- Modify: `lib/csv/ar-parser.ts`

Removes the local `parseDate` and `parseAmount` functions (lines 66-107 of the current file), imports from utils instead. The AR parser's `autoDetectArColumns` stays — its regex-based fuzzy matching is already broader than `findHeader` and handles header variations that findHeader wouldn't.

- [ ] **Step 1: Read the current ar-parser.ts to locate the edit points**

Run: `cat lib/csv/ar-parser.ts | head -40`

This confirms the import at the top (`import { callLlm, extractJson } from "./llm-mapper";`) and the export signature. You'll add a new import to utils, and delete the local helper functions.

- [ ] **Step 2: Add the utils import**

At the top of `lib/csv/ar-parser.ts`, alongside the existing `import { callLlm, extractJson } from "./llm-mapper";` line, add:

```ts
import { parseDate, parseAmount, detectDateFormat } from "./utils";
```

- [ ] **Step 3: Delete the local helper functions**

Delete the entire `parseDate` function (lines 66-99 in the current file — the one with the ISO / MM/DD/YYYY / DD-MMM-YYYY branches). Delete the entire `parseAmount` function (lines 101-107). Leave `REQUIRED_AR_FIELDS` and everything from `parseArCsv` onward untouched — those callers now pick up the imported symbols.

- [ ] **Step 4: Add column-level date-format detection in parseArCsv**

In `parseArCsv`, after the `const mapping = ...` logic completes (around line 143, just before the `const invoices: ParsedInvoice[] = [];` line), add:

```ts
  // Detect date format per date column once, reuse across rows.
  const invoiceDateFormat = detectDateFormat(
    rows.map((r) => r[mapping.invoiceDate]).filter(Boolean),
  );
  const dueDateFormat = detectDateFormat(
    rows.map((r) => r[mapping.dueDate]).filter(Boolean),
  );
```

Then in the per-row loop, find the two `parseDate(invoiceDateRaw)` and `parseDate(dueDateRaw)` call sites (they exist after mapping is resolved) and pass the respective format:

```ts
    const invoiceDate = parseDate(invoiceDateRaw, invoiceDateFormat);
    // ... later ...
    const dueDate = parseDate(dueDateRaw, dueDateFormat);
```

If `parseDate(invoiceDateRaw)` is called without a second argument elsewhere in the file (there may be multiple call sites), pass the corresponding detected format to each.

- [ ] **Step 5: Run existing AR parser tests**

Run: `npx vitest run __tests__/lib/csv/ar-parser.test.ts`
Expected: all existing tests pass.

- [ ] **Step 6: Run full vitest**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Re-run audit script**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: `ar` row of the matrix improves — B3 (named-month) now PASS, B5 (accounting parens) now PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/csv/ar-parser.ts
git commit -m "refactor(csv): AR parser reuses shared utils (named-month + parens support)"
```

---

## Task 8: Add matrix round-trip regression test

**Files:**
- Create: `tests/csv/parser-robustness.test.ts`

Locks in the audit pass rate as a vitest-runnable regression guard. If any future change breaks a parser's tolerance, this test catches it without needing to re-run the audit script by hand.

- [ ] **Step 1: Write the test**

Create `tests/csv/parser-robustness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  SHAPES,
  BASELINES,
  ALL_VARIANTS,
  runShapeOnce,
  runMatrix,
  type RunResult,
  type Outcome,
  type Shape,
} from "@/lib/csv/__fixtures__/audit-fixtures";

describe("CSV parser robustness matrix", { timeout: 30_000 }, () => {
  it("achieves >= 54/56 PASS across 5 parsers × 12 variants", async () => {
    // Warm-up: establish baseline outcomes the mutations will be measured against.
    const baselineResults: Record<Shape, RunResult> = {} as Record<Shape, RunResult>;
    for (const shape of SHAPES) {
      baselineResults[shape] = await runShapeOnce(shape, BASELINES[shape]);
      expect(baselineResults[shape].outcome).toBe("PASS"); // baselines must be clean
    }

    // Run the full 5×12 matrix.
    const cells = await runMatrix(baselineResults);

    const tally: Record<Outcome, number> = { PASS: 0, PARTIAL: 0, FAIL_DETECT: 0, FAIL_PARSE: 0, "N/A": 0 };
    for (const c of cells) tally[c.outcome] += 1;

    expect(cells).toHaveLength(SHAPES.length * ALL_VARIANTS.length); // 5 × 12 = 60

    // The goals of the robustness-fixes pass:
    expect(tally.PASS).toBeGreaterThanOrEqual(54);
    expect(tally.FAIL_DETECT).toBe(0);
    expect(tally.FAIL_PARSE).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/csv/parser-robustness.test.ts`
Expected: PASS (all three assertions hold after Tasks 3-7).

- [ ] **Step 3: Run full vitest**

Run: `npx vitest run`
Expected: all tests pass. Test count = previous + 1.

- [ ] **Step 4: Commit**

```bash
git add tests/csv/parser-robustness.test.ts
git commit -m "test(csv): audit-matrix round-trip regression guard"
```

---

## Task 9: Regenerate audit report + final verification

**Files:**
- Modify: `docs/audits/2026-04-23-csv-format-robustness.md` (overwrite in place)

- [ ] **Step 1: Re-run the audit script one last time to produce the fresh report**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: report is written to `docs/audits/2026-04-23-csv-format-robustness.md`. Matrix now shows ≥54/56 PASS, zero FAIL_DETECT, zero FAIL_PARSE.

- [ ] **Step 2: Inspect the first 30 lines of the fresh report**

Run: `head -30 docs/audits/2026-04-23-csv-format-robustness.md`

Expected: summary paragraph now shows the new pass counts. Punch-list should be empty or nearly so.

- [ ] **Step 3: Capture before/after for the commit message**

The pre-fix counts were: PASS 40, PARTIAL 10, FAIL_DETECT 3, FAIL_PARSE 3, N/A 4. Note the post-fix counts from the fresh report for the commit message.

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx vitest run`
Expected: all tests pass. Count = 259 (baseline) + 25 (utils) + 1 (parser-robustness) + 1 (FX skipped) = 286.

- [ ] **Step 5: Commit**

```bash
git add docs/audits/2026-04-23-csv-format-robustness.md
git commit -m "$(cat <<'EOF'
docs(audit): refresh robustness matrix after parser fixes

Before: 40/56 PASS, 10 PARTIAL, 3 FAIL_DETECT, 3 FAIL_PARSE, 4 N/A
After:  <fill in from step 3> PASS, <M> PARTIAL, 0 FAIL_DETECT, 0 FAIL_PARSE, 4 N/A

All three root-cause clusters from the 2026-04-23 audit now fixed:
- Detector synonyms (A2 variants pass detection)
- Fuzzy header matching (A4 whitespace headers parse)
- Shared parseAmount/parseDate (B3/B4/B5/B6 content mutations parse)

Pre-fix matrix accessible via: git show b3b6028:docs/audits/2026-04-23-csv-format-robustness.md
EOF
)"
```

- [ ] **Step 6: Push**

Run: `git push origin main`
Expected: all commits push cleanly.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| `lib/csv/utils.ts` with four helpers | Task 1 |
| `findHeader` with case/whitespace/alias normalization | Task 1 |
| `parseAmount` with parens/symbols/trailing minus, reject European | Task 1 |
| `parseDate` with ISO/US/EU/named, explicit format arg | Task 1 |
| `detectDateFormat` with US/EU evidence + ambiguity warn | Task 1 |
| Detector synonym expansion (`dr_cr`, `module`, `from`/`to`) | Task 3 |
| GL parser migration | Task 4 |
| Sub-ledger parser migration | Task 5 |
| FX signature change to `{rates, skipped}` | Task 6 |
| FX consumer update in `persist.ts` | Task 6 |
| FX test file update | Task 6 |
| AR parser removes local `parseDate`/`parseAmount` | Task 7 |
| Variance parser unchanged | (explicit non-action) |
| Audit fixtures extracted to shared module | Task 2 |
| `tests/csv/utils.test.ts` (~25 unit assertions) | Task 1 |
| `tests/csv/parser-robustness.test.ts` matrix assert | Task 8 |
| Report regeneration + before/after in commit | Task 9 |
| Pass rate ≥ 54/56 post-fix | Task 8 assertion + Task 9 regeneration |
| Zero FAIL_DETECT, zero FAIL_PARSE | Task 8 assertion |

All spec requirements mapped to tasks.

**2. Placeholder scan:**

- Task 7 Step 4 says "find the two `parseDate(invoiceDateRaw)` and `parseDate(dueDateRaw)` call sites" — this is an instruction-to-grep, not a placeholder, since the AR parser file isn't being rewritten from scratch and the exact line numbers drift as edits happen. It's directive enough for an implementer to find.
- Task 9 Step 5 has `<fill in from step 3>` placeholders in the commit message — this is intentional: the implementer reads the actual post-fix numbers from the re-run script and substitutes them. Called out in Step 3.

No other placeholders.

**3. Type consistency:**

- `findHeader(headers, canonical, aliases?)` — consistent across Tasks 1, 4, 5, 6, 7.
- `parseAmount(value)` returns `number | null` — consistent.
- `parseDate(value, format?)` returns `Date | null` — consistent.
- `detectDateFormat(columnValues)` returns `DateFormat` — consistent.
- `FxParseResult = {rates: FXRateInput[], skipped: Array<{row, reason}>}` — Task 6 defines it and Task 8's test consumes the same shape.
- `RunResult`, `Cell`, `Outcome` — same types in Tasks 2 and 8 via the shared fixtures module.

No drift.

**4. Execution risks:**

- Task 2's refactor moves ~200 lines of code; an implementer might miss one function. Mitigation: Step 3 re-runs the audit and compares tallies to a known baseline (40/10/3/3/4). Any mismatch flags the miss immediately.
- Task 6's signature change is the riskiest commit. Mitigation: Step 4 runs FX tests in isolation, Step 5 runs full vitest, Step 6 runs tsc. Three checks before the commit.
- Task 3's detector regex for `module` or `from/to` could in theory match an AR or variance CSV that happens to have those bare words. Mitigation: checked in brainstorming; no collision. Audit matrix re-run at Step 2 will catch any regression.
