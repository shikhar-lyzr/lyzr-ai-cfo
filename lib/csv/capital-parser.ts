export const KNOWN_COMPONENTS = [
  "cet1_capital",
  "additional_tier1",
  "tier2",
  "goodwill",
  "dta",
  "other_deduction",
  "total_rwa",
] as const;

export type KnownComponent = (typeof KNOWN_COMPONENTS)[number];

export const KNOWN_RISK_TYPES = ["credit", "market", "operational"] as const;
export type KnownRiskType = (typeof KNOWN_RISK_TYPES)[number];

export type SkippedRow = { row: number; reason: string };

export type CapitalComponentRow = {
  periodKey: string;
  component: KnownComponent;
  amount: number;
  currency: string;
};

export type RwaLineRow = {
  periodKey: string;
  riskType: KnownRiskType;
  exposureClass: string;
  exposureAmount: number;
  riskWeight: number;
  rwa: number;
};

const PERIOD_PATTERN = /^\d{4}(-(0[1-9]|1[0-2]|Q[1-4]))?$/;

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s-]+/g, "_").trim();
}

function findCol(headers: string[], ...wanted: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const w of wanted) {
    const idx = normalized.indexOf(normalizeHeader(w));
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeComponent(raw: string): KnownComponent | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((KNOWN_COMPONENTS as readonly string[]).includes(key)) {
    return key as KnownComponent;
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseRiskWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const percent = trimmed.endsWith("%");
  const body = percent ? trimmed.slice(0, -1) : trimmed;
  const n = Number(body.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return percent ? n / 100 : n;
}

export function parseCapitalComponents(
  headers: string[],
  rows: string[][],
): { components: CapitalComponentRow[]; skipped: SkippedRow[] } {
  const iPeriod = findCol(headers, "period");
  const iComponent = findCol(headers, "component");
  const iAmount = findCol(headers, "amount");
  const iCurrency = findCol(headers, "currency");

  const missing: string[] = [];
  if (iPeriod < 0) missing.push("period");
  if (iComponent < 0) missing.push("component");
  if (iAmount < 0) missing.push("amount");
  if (missing.length > 0) {
    throw new Error(`capital_components CSV missing required headers: ${missing.join(", ")}`);
  }

  const components: CapitalComponentRow[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, idx) => {
    const periodRaw = row[iPeriod]?.trim() ?? "";
    if (!PERIOD_PATTERN.test(periodRaw)) {
      skipped.push({ row: idx + 2, reason: `invalid period "${periodRaw}"` });
      return;
    }
    const amount = parseAmount(row[iAmount] ?? "");
    if (amount === null) {
      skipped.push({ row: idx + 2, reason: "unparseable amount" });
      return;
    }
    if (amount < 0) {
      skipped.push({ row: idx + 2, reason: "negative amount not allowed" });
      return;
    }

    const normalized = normalizeComponent(row[iComponent] ?? "");
    let component: KnownComponent;
    if (normalized) {
      component = normalized;
    } else {
      component = "other_deduction";
      skipped.push({
        row: idx + 2,
        reason: `unknown component "${row[iComponent]}" — mapped to other_deduction`,
      });
    }

    const currency = iCurrency >= 0 ? (row[iCurrency]?.trim() || "USD") : "USD";

    components.push({ periodKey: periodRaw, component, amount, currency });
  });

  return { components, skipped };
}

export function parseRwaBreakdown(
  headers: string[],
  rows: string[][],
): { lines: RwaLineRow[]; skipped: SkippedRow[] } {
  const iPeriod = findCol(headers, "period");
  const iRiskType = findCol(headers, "risk_type", "risk type", "risk-type");
  const iExposureClass = findCol(headers, "exposure_class", "exposure class", "exposure-class");
  const iExposureAmount = findCol(headers, "exposure_amount", "exposure amount", "exposure-amount");
  const iRiskWeight = findCol(headers, "risk_weight", "risk weight", "risk-weight");
  const iRwa = findCol(headers, "rwa");

  const missing: string[] = [];
  if (iPeriod < 0) missing.push("period");
  if (iRiskType < 0) missing.push("risk_type");
  if (iExposureClass < 0) missing.push("exposure_class");
  if (iExposureAmount < 0) missing.push("exposure_amount");
  if (iRiskWeight < 0) missing.push("risk_weight");
  if (iRwa < 0) missing.push("rwa");
  if (missing.length > 0) {
    throw new Error(`rwa_breakdown CSV missing required headers: ${missing.join(", ")}`);
  }

  const lines: RwaLineRow[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, idx) => {
    const periodRaw = row[iPeriod]?.trim() ?? "";
    if (!PERIOD_PATTERN.test(periodRaw)) {
      skipped.push({ row: idx + 2, reason: `invalid period "${periodRaw}"` });
      return;
    }

    const riskTypeRaw = (row[iRiskType] ?? "").trim().toLowerCase();
    if (!(KNOWN_RISK_TYPES as readonly string[]).includes(riskTypeRaw)) {
      skipped.push({ row: idx + 2, reason: `unknown risk_type "${row[iRiskType]}"` });
      return;
    }

    const exposureAmount = parseAmount(row[iExposureAmount] ?? "");
    const riskWeight = parseRiskWeight(row[iRiskWeight] ?? "");
    const rwa = parseAmount(row[iRwa] ?? "");
    if (exposureAmount === null || riskWeight === null || rwa === null) {
      skipped.push({ row: idx + 2, reason: "unparseable numeric field" });
      return;
    }
    if (exposureAmount < 0 || rwa < 0) {
      skipped.push({ row: idx + 2, reason: "negative amount not allowed" });
      return;
    }

    lines.push({
      periodKey: periodRaw,
      riskType: riskTypeRaw as KnownRiskType,
      exposureClass: (row[iExposureClass] ?? "").trim() || "unknown",
      exposureAmount,
      riskWeight,
      rwa,
    });
  });

  return { lines, skipped };
}
