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

type Shape = "variance" | "ar" | "gl" | "sub_ledger" | "fx";
const SHAPES: Shape[] = ["variance", "ar", "gl", "sub_ledger", "fx"];

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
    const rowCells = SHAPES.map((s) => OUTCOME_LABEL[row.get(s)!.outcome]);
    lines.push(`| ${variant.id} | ${variant.description} | ${rowCells.join(" | ")} |`);
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

  const reportPath = "docs/audits/2026-04-23-csv-format-robustness.md";
  const report = renderReport(cells);
  writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
