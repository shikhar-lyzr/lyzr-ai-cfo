# CSV Format Robustness Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a one-shot audit script and markdown report enumerating how the five CSV parsers (variance, ar, gl, sub_ledger, fx) behave under 12 real-world header/content variations. Audit-only — no production changes.

**Architecture:** One throwaway TS script at `scripts/audit-csv-parsers.ts`, invoked via `npx tsx`. Inlines baselines, defines a variant catalog as mutator functions, runs each variant through `detectFastPath` + the matching parser without touching the DB or calling the LLM, assembles results into a markdown matrix + per-shape findings + punch-list written to `docs/audits/2026-04-23-csv-format-robustness.md`.

**Tech Stack:** TypeScript strict, `npx tsx` runner, no vitest, no Prisma, no network.

---

## Task 1: Skeleton — script entry + baseline constants

**Files:**
- Create: `scripts/audit-csv-parsers.ts`

Sets up the script shape (async IIFE or top-level await), imports the parsers and detector, defines the five baseline CSVs. At this point the script does nothing — just confirms all imports resolve and baselines can be parsed without errors.

- [ ] **Step 1: Create the file with baselines only**

```ts
// scripts/audit-csv-parsers.ts
//
// Audit-only harness: runs each of the five shape parsers against a
// catalog of real-world CSV variations and writes a pass/fail report to
// docs/audits/. Throwaway script — no tests, no production changes.
//
// Usage: npx tsx scripts/audit-csv-parsers.ts

import { detectFastPath } from "@/lib/csv/detect-shape";
import { autoDetectColumns, parseRows } from "@/lib/csv/variance-parser";
import { parseArCsv } from "@/lib/csv/ar-parser";
import { parseGlCsv } from "@/lib/csv/gl-parser";
import { parseSubLedgerCsv } from "@/lib/csv/sub-ledger-parser";
import { parseFxRatesCsv } from "@/lib/csv/fx-rates-parser";
import { writeFileSync } from "node:fs";

type Csv = { headers: string[]; rows: string[][] };

const BASELINES: Record<Shape, Csv> = {
  variance: {
    headers: ["account", "actual", "budget", "period", "category"],
    rows: [
      ["Marketing", "14200", "11500", "2026-04", "OpEx"],
      ["R&D", "15600", "12000", "2026-04", "OpEx"],
      ["G&A", "8500", "8000", "2026-04", "OpEx"],
    ],
  },
  ar: {
    headers: ["invoice_number", "customer", "customer_email", "amount", "invoice_date", "due_date"],
    rows: [
      ["INV-001", "Acme Corp", "ap@acme.com", "1000.00", "2026-03-01", "2026-04-01"],
      ["INV-002", "Beta LLC", "pay@beta.co", "2500.00", "2026-03-05", "2026-04-05"],
      ["INV-003", "Gamma Inc", "billing@gamma.io", "500.00", "2026-03-10", "2026-04-10"],
    ],
  },
  gl: {
    headers: ["entry_date", "posting_date", "account", "reference", "memo", "amount", "currency", "debit_credit", "counterparty"],
    rows: [
      ["2026-04-01", "2026-04-01", "2100", "GL-001", "wire", "1000.00", "USD", "DR", "Acme"],
      ["2026-04-05", "2026-04-05", "2100", "GL-002", "ach", "2500.00", "USD", "DR", "Beta"],
      ["2026-04-10", "2026-04-10", "2100", "GL-003", "chk", "500.00", "USD", "CR", "Gamma"],
    ],
  },
  sub_ledger: {
    headers: ["entry_date", "source_module", "account", "reference", "memo", "amount", "currency", "counterparty"],
    rows: [
      ["2026-04-01", "AP", "2100", "GL-001", "wire", "1000.00", "USD", "Acme"],
      ["2026-04-05", "AP", "2100", "GL-002", "ach", "2500.00", "USD", "Beta"],
      ["2026-04-10", "AR", "2100", "GL-003", "chk", "500.00", "USD", "Gamma"],
    ],
  },
  fx: {
    headers: ["from_currency", "to_currency", "rate", "as_of"],
    rows: [
      ["EUR", "USD", "1.08", "2026-04-01"],
      ["GBP", "USD", "1.25", "2026-04-01"],
      ["JPY", "USD", "0.0066", "2026-04-01"],
    ],
  },
};

type Shape = "variance" | "ar" | "gl" | "sub_ledger" | "fx";
const SHAPES: Shape[] = ["variance", "ar", "gl", "sub_ledger", "fx"];

async function main() {
  console.log("CSV audit scaffolding loaded.");
  console.log(`Shapes: ${SHAPES.join(", ")}`);
  for (const shape of SHAPES) {
    const b = BASELINES[shape];
    console.log(`  ${shape}: ${b.headers.length} headers × ${b.rows.length} rows`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script and verify it prints the five shape summaries**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected output:
```
CSV audit scaffolding loaded.
Shapes: variance, ar, gl, sub_ledger, fx
  variance: 5 headers × 3 rows
  ar: 6 headers × 3 rows
  gl: 9 headers × 3 rows
  sub_ledger: 8 headers × 3 rows
  fx: 4 headers × 3 rows
```

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-csv-parsers.ts
git commit -m "chore(audit): skeleton + baseline CSVs for format audit"
```

---

## Task 2: Baseline runner — verify each parser accepts its own baseline

**Files:**
- Modify: `scripts/audit-csv-parsers.ts`

Before testing variants, confirm every baseline is recognised by the detector AND parses cleanly. Captures the reference output row count + key field for later comparison. If any baseline fails, that's a script bug (not a parser bug) and must be fixed before proceeding.

- [ ] **Step 1: Add a `runParser` helper and baseline-verification loop**

Replace the `main()` function. Add these definitions above it:

```ts
type Outcome = "PASS" | "PARTIAL" | "FAIL_DETECT" | "FAIL_PARSE" | "N/A";

interface RunResult {
  outcome: Outcome;
  rowCount: number;
  keyField: string | null;
  error?: string;
}

// The per-shape key field used by the comparator. For AR it's invoiceNumber
// on the first parsed invoice; for the ledgers it's reference; etc.
function keyFieldFor(shape: Shape, parserOutput: unknown): string | null {
  if (!Array.isArray(parserOutput) && typeof parserOutput !== "object") return null;
  try {
    if (shape === "variance") {
      const rows = parserOutput as Array<{ account?: string }>;
      return rows[0]?.account ?? null;
    }
    if (shape === "ar") {
      const res = parserOutput as { invoices: Array<{ invoiceNumber?: string }> };
      return res.invoices[0]?.invoiceNumber ?? null;
    }
    if (shape === "gl" || shape === "sub_ledger") {
      const res = parserOutput as { entries: Array<{ reference?: string }> };
      return res.entries[0]?.reference ?? null;
    }
    if (shape === "fx") {
      const rates = parserOutput as Array<{ fromCurrency?: string }>;
      return rates[0]?.fromCurrency ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function parsedRowCount(shape: Shape, parserOutput: unknown): number {
  if (shape === "variance") return (parserOutput as unknown[]).length;
  if (shape === "ar") return (parserOutput as { invoices: unknown[] }).invoices.length;
  if (shape === "gl" || shape === "sub_ledger") return (parserOutput as { entries: unknown[] }).entries.length;
  if (shape === "fx") return (parserOutput as unknown[]).length;
  return 0;
}

async function runShapeOnce(shape: Shape, csv: Csv): Promise<RunResult> {
  try {
    let output: unknown;
    if (shape === "variance") {
      const mapping = autoDetectColumns(csv.headers);
      if (mapping.account === undefined || mapping.actual === undefined) {
        return { outcome: "FAIL_PARSE", rowCount: 0, keyField: null, error: "variance auto-detect failed" };
      }
      output = parseRows(csv.rows, mapping);
    } else if (shape === "ar") {
      output = await parseArCsv(csv.headers, csv.rows);
    } else if (shape === "gl") {
      output = await parseGlCsv(csv.headers, csv.rows, []);
    } else if (shape === "sub_ledger") {
      output = await parseSubLedgerCsv(csv.headers, csv.rows, []);
    } else {
      output = parseFxRatesCsv(csv.headers, csv.rows);
    }
    return {
      outcome: "PASS",
      rowCount: parsedRowCount(shape, output),
      keyField: keyFieldFor(shape, output),
    };
  } catch (err) {
    return {
      outcome: "FAIL_PARSE",
      rowCount: 0,
      keyField: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

Replace the `main()` body with:

```ts
async function main() {
  console.log("=== Baseline verification ===");
  const baselineResults: Record<Shape, RunResult> = {} as Record<Shape, RunResult>;
  for (const shape of SHAPES) {
    const result = await runShapeOnce(shape, BASELINES[shape]);
    baselineResults[shape] = result;
    const key = result.keyField ?? "(no key)";
    console.log(`  ${shape}: ${result.outcome} — ${result.rowCount} rows, first=${key}${result.error ? ` (${result.error})` : ""}`);
    if (result.outcome !== "PASS") {
      throw new Error(`Baseline for ${shape} failed: ${result.error}`);
    }
  }
  console.log("All baselines PASS.");
}
```

- [ ] **Step 2: Run and verify all five baselines pass**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected output (rowCount = 3 per shape; first key fields vary):
```
=== Baseline verification ===
  variance: PASS — 3 rows, first=Marketing
  ar: PASS — 3 rows, first=INV-001
  gl: PASS — 3 rows, first=GL-001
  sub_ledger: PASS — 3 rows, first=GL-001
  fx: PASS — 3 rows, first=EUR
All baselines PASS.
```

If any shape does NOT show PASS — fix the baseline (wrong header name, wrong data shape). Do not modify production code.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-csv-parsers.ts
git commit -m "chore(audit): baseline runner — verify each parser accepts its own sample"
```

---

## Task 3: Variant catalog — Category A (header mutations)

**Files:**
- Modify: `scripts/audit-csv-parsers.ts`

Defines six header-mutation variants. Each is a pure function `(shape, csv) => csv | null` (null when the variant doesn't apply — e.g., A6 drop-optional when the shape has no optional columns defined for this variant). No runner changes yet.

- [ ] **Step 1: Add the header variant catalog**

Add above `async function main()`:

```ts
interface Variant {
  id: string;
  category: "A" | "B";
  description: string;
  // null return means "not applicable to this shape"
  apply: (shape: Shape, csv: Csv) => Csv | null;
}

// Per-shape synonym rename map used by variant A2.
const A2_SYNONYMS: Record<Shape, Record<string, string>> = {
  variance:   { account: "line_item", actual: "spent", budget: "plan" },
  ar:         { invoice_number: "inv_no", customer: "client", due_date: "payment_due" },
  gl:         { entry_date: "date", amount: "amt", debit_credit: "dr_cr" },
  sub_ledger: { entry_date: "date", amount: "amt", source_module: "module" },
  fx:         { from_currency: "from", to_currency: "to", as_of: "date" },
};

// Per-shape optional column to drop for A6.
const A6_DROP_COL: Partial<Record<Shape, string>> = {
  variance:   "category",       // optional per lib/csv/llm-mapper.ts#ALL_FIELDS
  ar:         "customer_email", // optional in ar-parser.ts autoDetect
  gl:         "memo",           // iMemo >= 0 check makes this optional
  sub_ledger: "memo",
  // fx has no optional columns in fx-rates-parser.ts
};

const HEADER_VARIANTS: Variant[] = [
  {
    id: "A1",
    category: "A",
    description: "Swap column order (reverse)",
    apply: (_shape, csv) => ({
      headers: [...csv.headers].reverse(),
      rows: csv.rows.map((r) => [...r].reverse()),
    }),
  },
  {
    id: "A2",
    category: "A",
    description: "Rename with synonym",
    apply: (shape, csv) => {
      const map = A2_SYNONYMS[shape];
      return {
        headers: csv.headers.map((h) => map[h] ?? h),
        rows: csv.rows,
      };
    },
  },
  {
    id: "A3",
    category: "A",
    description: "Uppercase headers",
    apply: (_shape, csv) => ({
      headers: csv.headers.map((h) => h.toUpperCase()),
      rows: csv.rows,
    }),
  },
  {
    id: "A4",
    category: "A",
    description: "Whitespace + title-case (underscores -> spaces)",
    apply: (_shape, csv) => ({
      headers: csv.headers.map((h) =>
        h.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      ),
      rows: csv.rows,
    }),
  },
  {
    id: "A5",
    category: "A",
    description: "Add irrelevant extra column 'Notes'",
    apply: (_shape, csv) => ({
      headers: [...csv.headers, "Notes"],
      rows: csv.rows.map((r) => [...r, "see appendix"]),
    }),
  },
  {
    id: "A6",
    category: "A",
    description: "Drop one optional column",
    apply: (shape, csv) => {
      const col = A6_DROP_COL[shape];
      if (!col) return null;
      const idx = csv.headers.indexOf(col);
      if (idx < 0) return null;
      return {
        headers: csv.headers.filter((_, i) => i !== idx),
        rows: csv.rows.map((r) => r.filter((_, i) => i !== idx)),
      };
    },
  },
];
```

- [ ] **Step 2: Add a quick print-variants loop to `main()` to verify the catalog produces sensible outputs**

Append to the end of `main()` (before the existing `console.log("All baselines PASS.")` — or after, doesn't matter):

```ts
  console.log("\n=== Header variant preview (first shape: gl) ===");
  for (const v of HEADER_VARIANTS) {
    const mutated = v.apply("gl", BASELINES.gl);
    if (mutated === null) {
      console.log(`  ${v.id} ${v.description}: N/A for gl`);
    } else {
      console.log(`  ${v.id} ${v.description}: headers=[${mutated.headers.slice(0, 3).join(", ")}, …]`);
    }
  }
```

- [ ] **Step 3: Run and eyeball the catalog**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected snippet of output (exact strings after "headers=" will vary):
```
=== Header variant preview (first shape: gl) ===
  A1 Swap column order (reverse): headers=[counterparty, debit_credit, currency, …]
  A2 Rename with synonym: headers=[date, posting_date, account, …]
  A3 Uppercase headers: headers=[ENTRY_DATE, POSTING_DATE, ACCOUNT, …]
  A4 Whitespace + title-case (underscores -> spaces): headers=[Entry Date, Posting Date, Account, …]
  A5 Add irrelevant extra column 'Notes': headers=[entry_date, posting_date, account, …]
  A6 Drop one optional column: headers=[entry_date, posting_date, account, …]
```

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-csv-parsers.ts
git commit -m "chore(audit): Category A header-mutation variant catalog"
```

---

## Task 4: Variant catalog — Category B (content mutations)

**Files:**
- Modify: `scripts/audit-csv-parsers.ts`

Six content-mutation variants. Each mutates data rows while leaving headers unchanged. Per-shape column targeting (which column is the "amount", which is the "date") lives in small maps.

- [ ] **Step 1: Add content variant maps + variants**

Add above `const HEADER_VARIANTS` (or just after it):

```ts
// Per-shape index lookups for content variants. Each value is the header
// name for the column. `null` means the shape doesn't have that column.
const DATE_COL: Record<Shape, string | null> = {
  variance:   null,           // period is "2026-04" style, not a date-parsed column
  ar:         "invoice_date",
  gl:         "entry_date",
  sub_ledger: "entry_date",
  fx:         "as_of",
};

const AMOUNT_COL: Record<Shape, string | null> = {
  variance:   "actual",
  ar:         "amount",
  gl:         "amount",
  sub_ledger: "amount",
  fx:         "rate",
};

function mutateColumn(
  csv: Csv,
  colName: string,
  fn: (cell: string) => string,
): Csv {
  const idx = csv.headers.indexOf(colName);
  if (idx < 0) return csv;
  return {
    headers: csv.headers,
    rows: csv.rows.map((r) => r.map((cell, i) => (i === idx ? fn(cell) : cell))),
  };
}

// Convert an ISO date string (YYYY-MM-DD) to another format. Returns the
// input unchanged if it doesn't look like ISO (e.g., variance's "2026-04").
function toUsDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}
function toEuDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function toNamedMonth(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

const CONTENT_VARIANTS: Variant[] = [
  {
    id: "B1",
    category: "B",
    description: "Date format: ISO -> US (MM/DD/YYYY)",
    apply: (shape, csv) => {
      const col = DATE_COL[shape];
      return col ? mutateColumn(csv, col, toUsDate) : null;
    },
  },
  {
    id: "B2",
    category: "B",
    description: "Date format: ISO -> EU (DD/MM/YYYY)",
    apply: (shape, csv) => {
      const col = DATE_COL[shape];
      return col ? mutateColumn(csv, col, toEuDate) : null;
    },
  },
  {
    id: "B3",
    category: "B",
    description: "Date format: named month (15 Apr 2026)",
    apply: (shape, csv) => {
      const col = DATE_COL[shape];
      return col ? mutateColumn(csv, col, toNamedMonth) : null;
    },
  },
  {
    id: "B4",
    category: "B",
    description: "Amount with thousands separator (1,234.56)",
    apply: (shape, csv) => {
      const col = AMOUNT_COL[shape];
      if (!col) return null;
      return mutateColumn(csv, col, (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return v;
        return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    },
  },
  {
    id: "B5",
    category: "B",
    description: "Amount with accounting parens for negatives ((500.00))",
    apply: (shape, csv) => {
      const col = AMOUNT_COL[shape];
      if (!col) return null;
      // Only rewrite the first row's amount — enough to exercise the parser path.
      const idx = csv.headers.indexOf(col);
      if (idx < 0) return null;
      const newRows = csv.rows.map((r, i) => {
        if (i !== 0) return r;
        const n = Number(r[idx]);
        return r.map((cell, j) =>
          j === idx && Number.isFinite(n) ? `(${Math.abs(n).toFixed(2)})` : cell,
        );
      });
      return { headers: csv.headers, rows: newRows };
    },
  },
  {
    id: "B6",
    category: "B",
    description: "Amount with currency-symbol prefix ($1234.56)",
    apply: (shape, csv) => {
      const col = AMOUNT_COL[shape];
      return col ? mutateColumn(csv, col, (v) => `$${v}`) : null;
    },
  },
];

const ALL_VARIANTS: Variant[] = [...HEADER_VARIANTS, ...CONTENT_VARIANTS];
```

- [ ] **Step 2: Extend the catalog preview in `main()` to show Category B on the `gl` baseline**

Replace the existing `console.log("\n=== Header variant preview (first shape: gl) ===")` block with:

```ts
  console.log("\n=== Variant preview (first shape: gl) ===");
  for (const v of ALL_VARIANTS) {
    const mutated = v.apply("gl", BASELINES.gl);
    if (mutated === null) {
      console.log(`  ${v.id} ${v.description}: N/A for gl`);
    } else {
      const sampleRow = mutated.rows[0];
      console.log(`  ${v.id} ${v.description}: row0=[${sampleRow.slice(0, 3).join(", ")}, …]`);
    }
  }
```

- [ ] **Step 3: Run and verify 12 variants show output**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected lines (exact row-0 values will differ):
```
=== Variant preview (first shape: gl) ===
  A1 Swap column order (reverse): row0=[Acme, DR, USD, …]
  A2 Rename with synonym: row0=[2026-04-01, 2026-04-01, 2100, …]
  A3 Uppercase headers: row0=[2026-04-01, 2026-04-01, 2100, …]
  A4 Whitespace + title-case (underscores -> spaces): row0=[2026-04-01, 2026-04-01, 2100, …]
  A5 Add irrelevant extra column 'Notes': row0=[2026-04-01, 2026-04-01, 2100, …]
  A6 Drop one optional column: row0=[2026-04-01, 2026-04-01, 2100, …]
  B1 Date format: ISO -> US (MM/DD/YYYY): row0=[04/01/2026, 2026-04-01, 2100, …]
  B2 Date format: ISO -> EU (DD/MM/YYYY): row0=[01/04/2026, 2026-04-01, 2100, …]
  B3 Date format: named month (15 Apr 2026): row0=[1 Apr 2026, 2026-04-01, 2100, …]
  B4 Amount with thousands separator (1,234.56): row0=[2026-04-01, 2026-04-01, 2100, …]
  B5 Amount with accounting parens for negatives ((500.00)): row0=[2026-04-01, 2026-04-01, 2100, …]
  B6 Amount with currency-symbol prefix ($1234.56): row0=[2026-04-01, 2026-04-01, 2100, …]
```

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-csv-parsers.ts
git commit -m "chore(audit): Category B content-mutation variant catalog"
```

---

## Task 5: Main runner — execute all shape × variant combinations

**Files:**
- Modify: `scripts/audit-csv-parsers.ts`

Replace the preview loop with the real runner. For each (shape, variant), mutate the baseline, run detector (Category A only) + parser, compute the outcome by comparing row count + key field against the baseline, collect into a 5 × 12 matrix.

- [ ] **Step 1: Add the classifier and runner**

Add above `async function main()`:

```ts
interface Cell {
  shape: Shape;
  variantId: string;
  category: "A" | "B";
  description: string;
  outcome: Outcome;
  detail: string;
}

function classify(
  shape: Shape,
  variant: Variant,
  mutated: Csv | null,
  baseline: RunResult,
): Promise<Cell> | Cell {
  if (mutated === null) {
    return {
      shape,
      variantId: variant.id,
      category: variant.category,
      description: variant.description,
      outcome: "N/A",
      detail: "variant not applicable to this shape",
    };
  }

  // For Category A we also exercise the shape detector.
  const needsDetect = variant.category === "A";

  return (async (): Promise<Cell> => {
    if (needsDetect) {
      const detected = detectFastPath(mutated.headers);
      if (detected !== shape) {
        return {
          shape,
          variantId: variant.id,
          category: variant.category,
          description: variant.description,
          outcome: "FAIL_DETECT",
          detail: `detectFastPath returned '${detected}' (expected '${shape}')`,
        };
      }
    }

    const result = await runShapeOnce(shape, mutated);

    if (result.outcome === "FAIL_PARSE") {
      return {
        shape,
        variantId: variant.id,
        category: variant.category,
        description: variant.description,
        outcome: "FAIL_PARSE",
        detail: result.error ?? "parser threw",
      };
    }

    // Compare against baseline.
    const sameRowCount = result.rowCount === baseline.rowCount;
    const sameKey = result.keyField === baseline.keyField;
    if (sameRowCount && sameKey) {
      return {
        shape,
        variantId: variant.id,
        category: variant.category,
        description: variant.description,
        outcome: "PASS",
        detail: "",
      };
    }
    return {
      shape,
      variantId: variant.id,
      category: variant.category,
      description: variant.description,
      outcome: "PARTIAL",
      detail: `rowCount ${result.rowCount}/${baseline.rowCount}, key ${result.keyField ?? "(null)"} vs ${baseline.keyField ?? "(null)"}`,
    };
  })();
}

async function runMatrix(baselines: Record<Shape, RunResult>): Promise<Cell[]> {
  const out: Cell[] = [];
  for (const shape of SHAPES) {
    for (const variant of ALL_VARIANTS) {
      const mutated = variant.apply(shape, BASELINES[shape]);
      const cell = await classify(shape, variant, mutated, baselines[shape]);
      out.push(cell);
    }
  }
  return out;
}
```

- [ ] **Step 2: Replace the preview loop in `main()` with the runner + tallies**

Replace the "=== Variant preview ===" block with:

```ts
  console.log("\n=== Running matrix ===");
  const cells = await runMatrix(baselineResults);

  const tally: Record<Outcome, number> = { PASS: 0, PARTIAL: 0, FAIL_DETECT: 0, FAIL_PARSE: 0, "N/A": 0 };
  for (const c of cells) tally[c.outcome] += 1;
  console.log(`Total: ${cells.length} cells`);
  console.log(`  PASS:        ${tally.PASS}`);
  console.log(`  PARTIAL:     ${tally.PARTIAL}`);
  console.log(`  FAIL_DETECT: ${tally.FAIL_DETECT}`);
  console.log(`  FAIL_PARSE:  ${tally.FAIL_PARSE}`);
  console.log(`  N/A:         ${tally["N/A"]}`);
```

- [ ] **Step 3: Run and eyeball the tallies**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected (exact PASS/FAIL counts will depend on real parser behaviour):
```
=== Running matrix ===
Total: 60 cells
  PASS:        <some number>
  PARTIAL:     <some number>
  FAIL_DETECT: <some number>
  FAIL_PARSE:  <some number>
  N/A:         <0 or more>
```

Sanity check: `PASS + PARTIAL + FAIL_DETECT + FAIL_PARSE + N/A` must equal 60.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-csv-parsers.ts
git commit -m "chore(audit): matrix runner with outcome classification"
```

---

## Task 6: Report writer — assemble markdown

**Files:**
- Modify: `scripts/audit-csv-parsers.ts`

Turn the cell array into a markdown document with:
- Title + date + one-paragraph summary
- Matrix table (rows = variants, columns = shapes)
- Per-shape findings section (list of non-PASS outcomes with details)
- Punch-list section (prioritised list of failures to fix)

- [ ] **Step 1: Add the report renderer**

Add above `async function main()`:

```ts
const OUTCOME_LABEL: Record<Outcome, string> = {
  PASS: "✓",
  PARTIAL: "~",
  FAIL_DETECT: "✗D",
  FAIL_PARSE: "✗P",
  "N/A": "–",
};

function renderMatrix(cells: Cell[]): string {
  const byVariant = new Map<string, Map<Shape, Cell>>();
  for (const c of cells) {
    if (!byVariant.has(c.variantId)) byVariant.set(c.variantId, new Map());
    byVariant.get(c.variantId)!.set(c.shape, c);
  }
  const lines: string[] = [];
  lines.push(`| Variant | Description | ${SHAPES.join(" | ")} |`);
  lines.push(`|---------|-------------|${SHAPES.map(() => "---").join("|")}|`);
  for (const variant of ALL_VARIANTS) {
    const row = byVariant.get(variant.id)!;
    const cells = SHAPES.map((s) => OUTCOME_LABEL[row.get(s)!.outcome]);
    lines.push(`| ${variant.id} | ${variant.description} | ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

function renderPerShapeFindings(cells: Cell[]): string {
  const parts: string[] = [];
  for (const shape of SHAPES) {
    parts.push(`### ${shape}\n`);
    const shapeCells = cells.filter((c) => c.shape === shape);
    const failures = shapeCells.filter((c) => c.outcome !== "PASS" && c.outcome !== "N/A");
    if (failures.length === 0) {
      parts.push("All applicable variants PASS. No gaps.\n");
      continue;
    }
    parts.push(`Failures: ${failures.length}\n`);
    for (const f of failures) {
      parts.push(`- **${f.variantId}** (${f.outcome}) — ${f.description}. ${f.detail}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

function renderPunchList(cells: Cell[]): string {
  // Group failing cells by shape; list shapes by failure count descending.
  const failuresByShape: Record<Shape, Cell[]> = { variance: [], ar: [], gl: [], sub_ledger: [], fx: [] };
  for (const c of cells) {
    if (c.outcome === "FAIL_DETECT" || c.outcome === "FAIL_PARSE" || c.outcome === "PARTIAL") {
      failuresByShape[c.shape].push(c);
    }
  }
  const ranked = SHAPES
    .map((s) => ({ shape: s, count: failuresByShape[s].length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) return "No failures. The parsers handle every tested variant.";

  const lines: string[] = [];
  for (const { shape, count } of ranked) {
    lines.push(`- \`${shape}\`: ${count} failing variant${count === 1 ? "" : "s"} — ${
      failuresByShape[shape].map((c) => c.variantId).join(", ")
    }`);
  }
  return lines.join("\n");
}

function renderReport(cells: Cell[]): string {
  const tally: Record<Outcome, number> = { PASS: 0, PARTIAL: 0, FAIL_DETECT: 0, FAIL_PARSE: 0, "N/A": 0 };
  for (const c of cells) tally[c.outcome] += 1;
  const applicable = cells.length - tally["N/A"];
  const passRate = `${tally.PASS}/${applicable}`;

  return `# CSV Format Robustness Audit — 2026-04-23

Generated by \`scripts/audit-csv-parsers.ts\`. Re-run to regenerate.

## Summary

Ran ${ALL_VARIANTS.length} CSV variants against ${SHAPES.length} shape parsers. ${passRate} applicable (shape, variant) pairs produce output semantically equivalent to the baseline. PARTIAL: ${tally.PARTIAL}, FAIL_DETECT: ${tally.FAIL_DETECT}, FAIL_PARSE: ${tally.FAIL_PARSE}, N/A: ${tally["N/A"]}.

Cell legend: \`✓\` PASS · \`~\` PARTIAL · \`✗D\` FAIL_DETECT · \`✗P\` FAIL_PARSE · \`–\` N/A.

## Matrix

${renderMatrix(cells)}

## Per-shape findings

${renderPerShapeFindings(cells)}

## Punch-list

Shapes ordered by failing-variant count. Each listed variant is a concrete target for a future robustness fix.

${renderPunchList(cells)}

## How to interpret

- **PASS** means the parser produced output with the same row count and the same key field as the baseline (variance=account, ar=invoiceNumber, gl/sub=reference, fx=fromCurrency).
- **PARTIAL** means the parser returned output but with a different row count or key field. For most shapes this is the \`skipped[]\` array path (rows that couldn't be parsed get collected there). For FX it's a silent drop because \`fx-rates-parser.ts:16\` continues on bad rows without tracking them.
- **FAIL_DETECT** means \`detectFastPath\` returned the wrong shape for the mutated headers. The audit does not exercise the LLM fallback; in production an LLM inference would attempt recovery.
- **FAIL_PARSE** means the parser threw.
`;
}
```

- [ ] **Step 2: Wire the report into `main()`**

Append after the tallies output block in `main()`:

```ts
  const reportPath = "docs/audits/2026-04-23-csv-format-robustness.md";
  const report = renderReport(cells);
  writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to ${reportPath}`);
```

- [ ] **Step 3: Ensure the output directory exists**

Run: `mkdir -p docs/audits`

- [ ] **Step 4: Run the full audit**

Run: `npx tsx scripts/audit-csv-parsers.ts`

Expected: tallies print + "Report written to docs/audits/2026-04-23-csv-format-robustness.md".

Eyeball the report:

Run: `cat docs/audits/2026-04-23-csv-format-robustness.md | head -30`

Expected: the title and summary are present.

- [ ] **Step 5: Commit the script + the generated report**

```bash
git add scripts/audit-csv-parsers.ts docs/audits/2026-04-23-csv-format-robustness.md
git commit -m "docs(audit): CSV format robustness matrix + per-shape findings"
```

---

## Task 7: Final push + handoff

**Files:** none

- [ ] **Step 1: Confirm tsc still clean**

Run: `npx tsc --noEmit`

Expected: no output.

- [ ] **Step 2: Confirm the existing test suite still passes**

Run: `npx vitest run`

Expected: all tests pass (no change to test count — the audit script has no tests and no production code was touched).

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Summarise report findings to the user**

Read `docs/audits/2026-04-23-csv-format-robustness.md` and summarise in 5-10 lines: which shapes have the most failing variants, the top 3 gaps from the punch-list, and a one-sentence recommendation for whether a fix pass is warranted. Don't over-commit; the punch-list is the source of truth.

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task(s) |
|---|---|
| Inline baselines per shape | Task 1 |
| Baseline verification before variants | Task 2 |
| Six Category A variants | Task 3 |
| Six Category B variants | Task 4 |
| Per-shape synonym map for A2 | Task 3 (`A2_SYNONYMS` constant) |
| Per-shape optional-column list for A6 | Task 3 (`A6_DROP_COL` constant) |
| N/A handling for non-applicable variants | Tasks 3, 4 (nullable `apply` return) |
| Shape detector exercised for Category A only | Task 5 (`needsDetect` check) |
| Comparator: row count + key field | Task 5 (`classify`) |
| Four outcome labels + N/A | Task 5 (`Outcome` type) |
| Matrix output | Task 6 (`renderMatrix`) |
| Per-shape findings with source-line references in non-PASS cells | Task 6 (`renderPerShapeFindings`) |
| Punch-list prioritised by failure count | Task 6 (`renderPunchList`) |
| Report written to `docs/audits/2026-04-23-csv-format-robustness.md` | Task 6 |
| Zero production changes | Enforced by plan — no edits under `lib/`, `app/`, `prisma/` |
| No LLM calls | Task 2 explicitly uses regex-only paths (`autoDetectColumns`, never `inferColumnMapping`) |
| No DB writes | Task 2 passes `[]` rates to GL/Sub; no Prisma imports in the script |
| No vitest tests | Script is standalone; Task 7 confirms test count unchanged |

All covered.

**2. Placeholders:** None. Every code block is complete; every "run this command" has concrete expected output.

**3. Type consistency:** `Shape`, `Csv`, `Variant`, `Outcome`, `RunResult`, `Cell` — each defined once and used consistently. `runShapeOnce` defined in Task 2 used in Task 5. `classify` defined in Task 5 used in the same task's `runMatrix`. `ALL_VARIANTS` defined in Task 4, used in Tasks 5 and 6. No drift.

**4. Execution risks:**

- `npx tsx` needs to resolve the `@/` path alias the imports use. Same alias the rest of the repo uses (confirmed via `tsconfig.json`); `tsx` reads it. If it doesn't, symptom is an import-resolution error at Task 1 Step 2; fallback is using relative imports (`../lib/csv/detect-shape`) instead.
- `parseArCsv` is marked `async` and calls `callLlm` internally. Task 2 needs to confirm the AR baseline doesn't hit the LLM fallback. Looking at `lib/csv/ar-parser.ts:42-64`, the regex auto-detect covers the baseline headers we chose (`invoice_number`, `customer`, `customer_email`, `amount`, `invoice_date`, `due_date`), so the LLM path won't fire. Audit is clean.
- Variant A6 (drop optional column) depends on the parser actually treating the dropped column as optional. If the AR parser silently requires `customer_email`, A6 will show as FAIL_PARSE — which is itself a finding worth reporting.
