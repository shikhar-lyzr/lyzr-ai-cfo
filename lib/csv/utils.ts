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

  // Reject European formats BEFORE stripping commas:
  // - "1.234,56" → dot-thousands with comma-decimal
  // - "1 234,56" → space-thousands with comma-decimal
  // A comma followed by 1-2 digits at end of string is a decimal comma.
  if (/,\d{1,2}$/.test(inner)) return null;

  const stripped = inner.replace(AMOUNT_STRIP_RE, "");

  // Any remaining comma means an unusual/unsupported format.
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
