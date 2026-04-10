/**
 * AR aging CSV parser.
 *
 * Parses invoice-shaped CSVs into structured Invoice data for Prisma insertion.
 * Supports regex auto-detect for standard headers and LLM fallback for
 * non-standard ones. Collects unparseable rows into `skipped[]` rather than
 * silently dropping them.
 */

import { callLlm, extractJson } from "./llm-mapper";

export interface ParsedInvoice {
  invoiceNumber: string;
  customer: string;
  customerEmail?: string;
  amount: number;
  invoiceDate: Date;
  dueDate: Date;
}

export interface SkipReason {
  row: number;
  reason: "missing_required_field" | "unparseable_date" | "negative_amount" | "invalid_amount";
  detail: string;
}

export interface ArParseResult {
  invoices: ParsedInvoice[];
  skipped: SkipReason[];
}

const AR_FIELDS = [
  "invoiceNumber",
  "customer",
  "customerEmail",
  "amount",
  "invoiceDate",
  "dueDate",
] as const;

/** Auto-detect AR column indices from headers using regex. */
export function autoDetectArColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (/invoice[_\s-]?(no|num|number|id|#)|inv[_\s-]?(no|num|number|id|#)/i.test(h)) {
      mapping.invoiceNumber = i;
    } else if (/customer[_\s-]?email|email/i.test(h)) {
      // Must check email before customer — "customer email" should match here
      mapping.customerEmail = i;
    } else if (/customer|client|debtor|buyer|company/i.test(h)) {
      mapping.customer = i;
    } else if (/amount[_\s-]?(due|outstanding|owed)?|balance|total[_\s-]?due|receivable/i.test(h)) {
      mapping.amount = i;
    } else if (/invoice[_\s-]?date|issue[_\s-]?date/i.test(h)) {
      mapping.invoiceDate = i;
    } else if (/due[_\s-]?date|payment[_\s-]?due/i.test(h)) {
      mapping.dueDate = i;
    }
  }

  return mapping;
}

/** Parse a date string in YYYY-MM-DD, MM/DD/YYYY, or DD-MMM-YYYY format. */
export function parseDate(value: string): Date | null {
  const trimmed = value.trim();

  // YYYY-MM-DD
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD-MMM-YYYY (e.g. 15-Jan-2025)
  const dmy = trimmed.match(/^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})$/i);
  if (dmy) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const mon = months[dmy[2].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Number(dmy[3]), mon, Number(dmy[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/** Parse amount string, stripping $ and commas. */
function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num;
}

const REQUIRED_AR_FIELDS = ["invoiceNumber", "customer", "amount", "invoiceDate", "dueDate"] as const;

/**
 * Parse AR aging CSV rows into structured invoices.
 *
 * Uses regex auto-detect first, falls back to LLM column mapping if required
 * fields are missing. Returns both parsed invoices and skipped rows with reasons.
 */
export async function parseArCsv(
  headers: string[],
  rows: string[][]
): Promise<ArParseResult> {
  let mapping = autoDetectArColumns(headers);

  // Check if we have the required fields
  const missingRequired = REQUIRED_AR_FIELDS.filter((f) => mapping[f] === undefined);

  if (missingRequired.length > 0) {
    // Try LLM fallback — reuse the AR field names in the mapping prompt
    const llmMapping = await inferArColumnMapping(headers, rows);
    if (llmMapping) {
      mapping = llmMapping;
    } else {
      return {
        invoices: [],
        skipped: [
          {
            row: 0,
            reason: "missing_required_field",
            detail: `Could not map required columns: ${missingRequired.join(", ")}`,
          },
        ],
      };
    }
  }

  const invoices: ParsedInvoice[] = [];
  const skipped: SkipReason[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Extract values
    const invoiceNumber = row[mapping.invoiceNumber]?.trim();
    const customer = row[mapping.customer]?.trim();
    const amountRaw = row[mapping.amount]?.trim();
    const invoiceDateRaw = row[mapping.invoiceDate]?.trim();
    const dueDateRaw = row[mapping.dueDate]?.trim();
    const customerEmail = mapping.customerEmail !== undefined
      ? row[mapping.customerEmail]?.trim() || undefined
      : undefined;

    // Validate required fields
    if (!invoiceNumber || !customer) {
      skipped.push({
        row: rowNum,
        reason: "missing_required_field",
        detail: `Missing ${!invoiceNumber ? "invoiceNumber" : "customer"}`,
      });
      continue;
    }

    if (!amountRaw) {
      skipped.push({
        row: rowNum,
        reason: "missing_required_field",
        detail: "Missing amount",
      });
      continue;
    }

    const amount = parseAmount(amountRaw);
    if (amount === null) {
      skipped.push({
        row: rowNum,
        reason: "invalid_amount",
        detail: `Unparseable amount: "${amountRaw}"`,
      });
      continue;
    }

    if (amount < 0) {
      skipped.push({
        row: rowNum,
        reason: "negative_amount",
        detail: `Negative amount: ${amount}`,
      });
      continue;
    }

    if (!invoiceDateRaw) {
      skipped.push({
        row: rowNum,
        reason: "missing_required_field",
        detail: "Missing invoiceDate",
      });
      continue;
    }

    const invoiceDate = parseDate(invoiceDateRaw);
    if (!invoiceDate) {
      skipped.push({
        row: rowNum,
        reason: "unparseable_date",
        detail: `Unparseable invoiceDate: "${invoiceDateRaw}"`,
      });
      continue;
    }

    if (!dueDateRaw) {
      skipped.push({
        row: rowNum,
        reason: "missing_required_field",
        detail: "Missing dueDate",
      });
      continue;
    }

    const dueDate = parseDate(dueDateRaw);
    if (!dueDate) {
      skipped.push({
        row: rowNum,
        reason: "unparseable_date",
        detail: `Unparseable dueDate: "${dueDateRaw}"`,
      });
      continue;
    }

    invoices.push({
      invoiceNumber,
      customer,
      customerEmail,
      amount,
      invoiceDate,
      dueDate,
    });
  }

  return { invoices, skipped };
}

/**
 * LLM column mapping fallback for AR CSVs.
 * Reuses the Lyzr/Gemini call infrastructure from llm-mapper.ts.
 */
async function inferArColumnMapping(
  headers: string[],
  rows: string[][]
): Promise<Record<string, number> | null> {
  const headerLine = headers.map((h, i) => `${i}: ${h}`).join("\n");
  const sample = rows
    .slice(0, 5)
    .map((r, i) => `row ${i}: ${r.join(" | ")}`)
    .join("\n");

  const prompt = `You are a CSV schema mapper for an accounts receivable aging tool. Map the columns of this CSV to a known schema by returning column indices.

Schema fields:
- invoiceNumber (REQUIRED): invoice ID or number (e.g. "INV-1847", "1234")
- customer (REQUIRED): customer or client name
- amount (REQUIRED): the amount due or outstanding, parsed as a number
- invoiceDate (REQUIRED): the date the invoice was issued
- dueDate (REQUIRED): the payment due date
- customerEmail (optional): the customer's email address

CSV headers (index: name):
${headerLine}

Sample rows:
${sample}

Respond with ONLY a JSON object mapping each schema field to its column index. Example: {"invoiceNumber": 0, "customer": 1, "amount": 2, "invoiceDate": 3, "dueDate": 4, "customerEmail": 5}. If you cannot identify the required fields, return an empty object {}.`;

  const text = await callLlm(prompt);
  if (!text) return null;

  const obj = extractJson(text);
  if (!obj) return null;

  const mapping: Record<string, number> = {};
  for (const field of AR_FIELDS) {
    const v = obj[field];
    if (
      typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v < headers.length
    ) {
      mapping[field] = v;
    }
  }

  // Check required fields
  for (const f of REQUIRED_AR_FIELDS) {
    if (mapping[f] === undefined) return null;
  }

  return mapping;
}
