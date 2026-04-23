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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
