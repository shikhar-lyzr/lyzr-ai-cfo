# Regulatory Capital Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static mock regulatory-capital page into a real, period-aware, upload-driven Basel III Pillar 1 flow (ratios + RWA breakdown), matching the pattern already used by monthly-close and financial-reconciliation.

**Architecture:** Four new Prisma models (`CapitalPeriod`, `CapitalComponent`, `RwaLine`, `CapitalSnapshot`). Two new CSV shapes (`capital_components`, `rwa_breakdown`) added to the existing `/api/upload` handler. A new `lib/capital/` module with period/persist/stats/minimums. A new journey-context builder so the AI agent sees the same snapshot the user sees. The regulatory-capital page is rewritten from static to server component.

**Tech Stack:** Next.js 15 (App Router), Prisma + Postgres, Vitest, gitclaw SDK (for the agent).

**Spec:** [docs/superpowers/specs/2026-04-23-regulatory-capital-flow-design.md](../specs/2026-04-23-regulatory-capital-flow-design.md)

---

## File structure overview

**Created (11 files):**
- `lib/capital/minimums.ts` — Basel III minimums constant + `effectiveMinimum()`
- `lib/capital/period.ts` — `listCapitalPeriods`, `resolveActivePeriod`, `safely`
- `lib/capital/stats.ts` — snapshot computation, breaches, RWA breakdown
- `lib/capital/persist.ts` — `ingestCapitalComponents`, `ingestRwaBreakdown`
- `lib/capital/index.ts` — barrel exports
- `lib/capital/__tests__/stats.test.ts` — stats unit tests
- `lib/csv/capital-parser.ts` — `parseCapitalComponents`, `parseRwaBreakdown`
- `lib/csv/__tests__/capital-parser.test.ts` — parser unit tests
- `lib/agent/journey-context/regulatory-capital.ts` — context builder
- `app/(shell)/regulatory-capital/period-picker.tsx` — client component (copy pattern)
- `app/(shell)/regulatory-capital/explain-button.tsx` — client component (copy pattern)
- `app/api/capital/periods/route.ts` — period listing for the picker

**Modified (7 files):**
- `prisma/schema.prisma` — four new models + User/DataSource relations
- `lib/csv/detect-shape.ts` — add two new shapes
- `app/api/upload/route.ts` — add two new shape branches
- `app/(shell)/data-sources/page.tsx` — add `capital` tab
- `components/data-sources/link-sheet-area.tsx` — extend shape union
- `app/(shell)/regulatory-capital/page.tsx` — full rewrite
- `lib/agent/journey-context/index.ts` — register builder
- `lib/agent/journey-context/__tests__/registry.test.ts` — add test cases

**One Prisma migration** created by `prisma migrate dev`.

---

## Task 1: Add Prisma models for capital-flow data

**Files:**
- Modify: `prisma/schema.prisma` (add four models, two User relations, two DataSource relations)

- [ ] **Step 1: Add the four new models at the end of `prisma/schema.prisma`**

Append to the end of `prisma/schema.prisma`:

```prisma
model CapitalPeriod {
  id        String   @id @default(cuid())
  userId    String
  periodKey String
  status    String   @default("open")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([userId, periodKey])
  @@index([userId, createdAt])
}

model CapitalComponent {
  id           String   @id @default(cuid())
  dataSourceId String
  periodKey    String
  component    String
  amount       Float
  currency     String   @default("USD")
  createdAt    DateTime @default(now())

  dataSource DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@index([dataSourceId, periodKey])
  @@index([periodKey, component])
}

model RwaLine {
  id             String   @id @default(cuid())
  dataSourceId   String
  periodKey      String
  riskType       String
  exposureClass  String
  exposureAmount Float
  riskWeight     Float
  rwa            Float
  createdAt      DateTime @default(now())

  dataSource DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@index([dataSourceId, periodKey])
  @@index([periodKey, riskType])
}

model CapitalSnapshot {
  id           String   @id @default(cuid())
  userId       String
  periodKey    String
  cet1Ratio    Float
  tier1Ratio   Float
  totalRatio   Float
  cet1Capital  Float
  tier1Capital Float
  totalCapital Float
  totalRwa     Float
  computedAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([userId, periodKey])
  @@index([userId, computedAt])
}
```

- [ ] **Step 2: Add the back-relations on `User` and `DataSource`**

In the existing `User` model block, append these two lines to the existing relation list (immediately after `reconPeriods       ReconPeriod[]`):

```prisma
  capitalPeriods     CapitalPeriod[]
  capitalSnapshots   CapitalSnapshot[]
```

In the existing `DataSource` model block, append these two lines to the existing relation list (immediately after `subLedgerEntries SubLedgerEntry[]`):

```prisma
  capitalComponents CapitalComponent[]
  rwaLines          RwaLine[]
```

- [ ] **Step 3: Create migration**

Run:

```bash
npx prisma migrate dev --name add_capital_models
```

Expected output: migration file generated under `prisma/migrations/<timestamp>_add_capital_models/migration.sql`, Prisma Client regenerated.

- [ ] **Step 4: Verify the schema compiles and client types regenerate**

Run:

```bash
npx prisma validate
```

Expected output: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(capital): add Prisma models for capital flow

CapitalPeriod, CapitalComponent, RwaLine, CapitalSnapshot —
four tables backing the Basel III Pillar 1 regulatory-capital
journey. Schema shaped to accept C-phase additions (leverage,
buffers) as additive column/value changes."
```

---

## Task 2: Minimums constant + effectiveMinimum()

**Files:**
- Create: `lib/capital/minimums.ts`
- Test: `lib/capital/__tests__/minimums.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/capital/__tests__/minimums.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BASEL_III_MINIMUMS, effectiveMinimum } from "../minimums";

describe("capital minimums", () => {
  it("exports hardcoded Basel III Pillar 1 minimums", () => {
    expect(BASEL_III_MINIMUMS.cet1).toBe(0.045);
    expect(BASEL_III_MINIMUMS.tier1).toBe(0.060);
    expect(BASEL_III_MINIMUMS.total).toBe(0.080);
  });

  it("effectiveMinimum returns the same as BASEL_III_MINIMUMS in B-phase", () => {
    expect(effectiveMinimum("cet1")).toBe(0.045);
    expect(effectiveMinimum("tier1")).toBe(0.060);
    expect(effectiveMinimum("total")).toBe(0.080);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capital/__tests__/minimums.test.ts`
Expected: FAIL — module `"../minimums"` cannot be resolved.

- [ ] **Step 3: Create the minimums module**

Create `lib/capital/minimums.ts`:

```ts
/**
 * Basel III Pillar 1 minimum capital ratios.
 *
 * Callers read these via effectiveMinimum() rather than the constant
 * directly — so the C-phase (CCB / CCyB / G-SIB buffers) can return
 * "minimum + required_buffer" from here without changing any caller.
 */
export const BASEL_III_MINIMUMS = {
  cet1: 0.045,
  tier1: 0.060,
  total: 0.080,
} as const;

export type RatioKey = keyof typeof BASEL_III_MINIMUMS;

export function effectiveMinimum(key: RatioKey): number {
  return BASEL_III_MINIMUMS[key];
}

export type RatioStatus = "above_buffer" | "above_minimum" | "below_minimum";

export function ratioStatus(value: number, key: RatioKey): RatioStatus {
  // B-phase: only above_buffer and below_minimum are reachable. The
  // above_minimum tier exists so C-phase can insert buffer-aware logic
  // here without changing the type or callers.
  return value < effectiveMinimum(key) ? "below_minimum" : "above_buffer";
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/capital/__tests__/minimums.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/capital/minimums.ts lib/capital/__tests__/minimums.test.ts
git commit -m "feat(capital): Basel III minimums + ratio status"
```

---

## Task 3: Period module

**Files:**
- Create: `lib/capital/period.ts`
- Test: `lib/capital/__tests__/period.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/capital/__tests__/period.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveActivePeriod, safely } from "../period";

describe("resolveActivePeriod", () => {
  it("returns null when no periods exist", () => {
    expect(resolveActivePeriod([], "2026-Q1")).toBeNull();
  });

  it("returns requested periodKey when it exists", () => {
    const periods = [{ periodKey: "2026-Q1" }, { periodKey: "2025-Q4" }];
    expect(resolveActivePeriod(periods, "2025-Q4")).toBe("2025-Q4");
  });

  it("falls back to newest (first in list) when requested is invalid", () => {
    const periods = [{ periodKey: "2026-Q1" }, { periodKey: "2025-Q4" }];
    expect(resolveActivePeriod(periods, "2024-Q1")).toBe("2026-Q1");
  });

  it("falls back to newest when requested is undefined", () => {
    const periods = [{ periodKey: "2026-Q1" }];
    expect(resolveActivePeriod(periods, undefined)).toBe("2026-Q1");
  });
});

describe("safely", () => {
  it("returns producer value when it resolves", async () => {
    const result = await safely(async () => 42, 0);
    expect(result).toBe(42);
  });

  it("returns fallback when producer throws", async () => {
    const result = await safely(async () => {
      throw new Error("boom");
    }, 99);
    expect(result).toBe(99);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capital/__tests__/period.test.ts`
Expected: FAIL — module `"../period"` cannot be resolved.

- [ ] **Step 3: Create the period module**

Create `lib/capital/period.ts`:

```ts
import { prisma } from "@/lib/db";

export async function safely<T>(producer: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await producer();
  } catch (err) {
    console.error("[capital] safely() caught:", err);
    return fallback;
  }
}

export type CapitalPeriodSummary = { periodKey: string };

export function resolveActivePeriod(
  periods: { periodKey: string }[],
  requested: string | undefined
): string | null {
  if (periods.length === 0) return null;
  if (requested && periods.some((p) => p.periodKey === requested)) return requested;
  return periods[0].periodKey;
}

export async function listCapitalPeriods(userId: string): Promise<CapitalPeriodSummary[]> {
  const rows = await prisma.capitalPeriod.findMany({
    where: { userId },
    select: { periodKey: true },
    orderBy: [{ createdAt: "desc" }, { periodKey: "desc" }],
  });
  return rows;
}

export async function upsertCapitalPeriod(userId: string, periodKey: string): Promise<void> {
  await prisma.capitalPeriod.upsert({
    where: { userId_periodKey: { userId, periodKey } },
    create: { userId, periodKey, status: "open" },
    update: {},
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/capital/__tests__/period.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/capital/period.ts lib/capital/__tests__/period.test.ts
git commit -m "feat(capital): period list + resolver + safely wrapper"
```

---

## Task 4: CSV parser for capital components

**Files:**
- Create: `lib/csv/capital-parser.ts`
- Test: `lib/csv/__tests__/capital-parser.test.ts`

- [ ] **Step 1: Write the failing tests for component parsing**

Create `lib/csv/__tests__/capital-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseCapitalComponents,
  parseRwaBreakdown,
  KNOWN_COMPONENTS,
} from "../capital-parser";

describe("parseCapitalComponents", () => {
  const headers = ["period", "component", "amount", "currency"];

  it("parses a happy-path file", () => {
    const rows = [
      ["2026-Q1", "cet1_capital", "12400000000", "USD"],
      ["2026-Q1", "additional_tier1", "1500000000", "USD"],
      ["2026-Q1", "tier2", "2500000000", "USD"],
      ["2026-Q1", "total_rwa", "93900000000", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(4);
    expect(out.components[0]).toEqual({
      periodKey: "2026-Q1",
      component: "cet1_capital",
      amount: 12400000000,
      currency: "USD",
    });
    expect(out.skipped).toEqual([]);
  });

  it("normalizes component names (case / whitespace / underscores)", () => {
    const rows = [
      ["2026-Q1", "  CET1 Capital  ", "100", "USD"],
      ["2026-Q1", "Additional-Tier1", "50", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components[0].component).toBe("cet1_capital");
    expect(out.components[1].component).toBe("additional_tier1");
  });

  it("maps unknown component names to other_deduction with skipped note", () => {
    const rows = [
      ["2026-Q1", "some_custom_bucket", "100", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(1);
    expect(out.components[0].component).toBe("other_deduction");
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0]).toMatchObject({
      row: 0,
      reason: expect.stringContaining("unknown component"),
    });
  });

  it("rejects negative amounts (skipped, not errored)", () => {
    const rows = [
      ["2026-Q1", "cet1_capital", "-100", "USD"],
      ["2026-Q1", "tier2", "500", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(1);
    expect(out.components[0].component).toBe("tier2");
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0].reason).toContain("negative");
  });

  it("skips rows with unparseable amount", () => {
    const rows = [
      ["2026-Q1", "cet1_capital", "not-a-number", "USD"],
      ["2026-Q1", "tier2", "", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(0);
    expect(out.skipped).toHaveLength(2);
  });

  it("defaults currency to USD when column missing", () => {
    const out = parseCapitalComponents(
      ["period", "component", "amount"],
      [["2026-Q1", "cet1_capital", "100"]],
    );
    expect(out.components[0].currency).toBe("USD");
  });

  it("skips rows with invalid period format", () => {
    const rows = [
      ["not-a-period", "cet1_capital", "100", "USD"],
      ["2026-13", "cet1_capital", "100", "USD"],
      ["2026-Q1", "cet1_capital", "100", "USD"],
    ];
    const out = parseCapitalComponents(headers, rows);
    expect(out.components).toHaveLength(1);
    expect(out.skipped).toHaveLength(2);
  });

  it("exports the known-component list for tests and UI hints", () => {
    expect(KNOWN_COMPONENTS).toContain("cet1_capital");
    expect(KNOWN_COMPONENTS).toContain("total_rwa");
    expect(KNOWN_COMPONENTS).toContain("goodwill");
  });
});

describe("parseRwaBreakdown", () => {
  const headers = ["period", "risk_type", "exposure_class", "exposure_amount", "risk_weight", "rwa"];

  it("parses a happy-path file", () => {
    const rows = [
      ["2026-Q1", "credit", "corporate", "50000000", "1.0", "50000000"],
      ["2026-Q1", "market", "trading_book", "20000000", "0.5", "10000000"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0]).toEqual({
      periodKey: "2026-Q1",
      riskType: "credit",
      exposureClass: "corporate",
      exposureAmount: 50000000,
      riskWeight: 1.0,
      rwa: 50000000,
    });
  });

  it("accepts risk_weight as a percent string", () => {
    const rows = [
      ["2026-Q1", "credit", "retail", "100", "50%", "50"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines[0].riskWeight).toBe(0.5);
  });

  it("skips unknown riskType", () => {
    const rows = [
      ["2026-Q1", "ozymandias", "x", "100", "1.0", "100"],
      ["2026-Q1", "credit", "corp", "100", "1.0", "100"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines).toHaveLength(1);
    expect(out.skipped).toHaveLength(1);
  });

  it("accepts case-insensitive riskType", () => {
    const rows = [
      ["2026-Q1", "Credit", "corp", "100", "1.0", "100"],
      ["2026-Q1", "OPERATIONAL", "foo", "100", "1.0", "100"],
    ];
    const out = parseRwaBreakdown(headers, rows);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0].riskType).toBe("credit");
    expect(out.lines[1].riskType).toBe("operational");
  });

  it("accepts header variants with spaces or hyphens", () => {
    const headerVariants = ["period", "risk type", "exposure-class", "exposure amount", "risk weight", "rwa"];
    const rows = [["2026-Q1", "credit", "corp", "100", "1.0", "100"]];
    const out = parseRwaBreakdown(headerVariants, rows);
    expect(out.lines).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/csv/__tests__/capital-parser.test.ts`
Expected: FAIL — `"../capital-parser"` cannot be resolved.

- [ ] **Step 3: Create the parser**

Create `lib/csv/capital-parser.ts`:

```ts
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

  if (iPeriod < 0 || iComponent < 0 || iAmount < 0) {
    return { components: [], skipped: [] };
  }

  const components: CapitalComponentRow[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, idx) => {
    const periodRaw = row[iPeriod]?.trim() ?? "";
    if (!PERIOD_PATTERN.test(periodRaw)) {
      skipped.push({ row: idx, reason: `invalid period "${periodRaw}"` });
      return;
    }
    const amount = parseAmount(row[iAmount] ?? "");
    if (amount === null) {
      skipped.push({ row: idx, reason: "unparseable amount" });
      return;
    }
    if (amount < 0) {
      skipped.push({ row: idx, reason: "negative amount not allowed" });
      return;
    }

    const normalized = normalizeComponent(row[iComponent] ?? "");
    let component: KnownComponent;
    if (normalized) {
      component = normalized;
    } else {
      component = "other_deduction";
      skipped.push({
        row: idx,
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

  if (
    iPeriod < 0 ||
    iRiskType < 0 ||
    iExposureClass < 0 ||
    iExposureAmount < 0 ||
    iRiskWeight < 0 ||
    iRwa < 0
  ) {
    return { lines: [], skipped: [] };
  }

  const lines: RwaLineRow[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, idx) => {
    const periodRaw = row[iPeriod]?.trim() ?? "";
    if (!PERIOD_PATTERN.test(periodRaw)) {
      skipped.push({ row: idx, reason: `invalid period "${periodRaw}"` });
      return;
    }

    const riskTypeRaw = (row[iRiskType] ?? "").trim().toLowerCase();
    if (!(KNOWN_RISK_TYPES as readonly string[]).includes(riskTypeRaw)) {
      skipped.push({ row: idx, reason: `unknown risk_type "${row[iRiskType]}"` });
      return;
    }

    const exposureAmount = parseAmount(row[iExposureAmount] ?? "");
    const riskWeight = parseRiskWeight(row[iRiskWeight] ?? "");
    const rwa = parseAmount(row[iRwa] ?? "");
    if (exposureAmount === null || riskWeight === null || rwa === null) {
      skipped.push({ row: idx, reason: "unparseable numeric field" });
      return;
    }
    if (exposureAmount < 0 || rwa < 0) {
      skipped.push({ row: idx, reason: "negative amount not allowed" });
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/csv/__tests__/capital-parser.test.ts`
Expected: PASS (all test cases).

- [ ] **Step 5: Commit**

```bash
git add lib/csv/capital-parser.ts lib/csv/__tests__/capital-parser.test.ts
git commit -m "feat(capital): CSV parsers for components + RWA breakdown"
```

---

## Task 5: Shape detection for capital uploads

**Files:**
- Modify: `lib/csv/detect-shape.ts`
- Test: `lib/csv/__tests__/detect-shape.test.ts` (create if missing, otherwise extend)

- [ ] **Step 1: Write the failing test**

Check whether `lib/csv/__tests__/detect-shape.test.ts` already exists:

```bash
ls lib/csv/__tests__/detect-shape.test.ts 2>/dev/null || echo "missing"
```

If **missing**, create `lib/csv/__tests__/detect-shape.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectFastPath } from "../detect-shape";

describe("detectFastPath", () => {
  it("detects capital_components from component+amount+period headers", () => {
    expect(detectFastPath(["period", "component", "amount", "currency"]))
      .toBe("capital_components");
    expect(detectFastPath(["Period", "Component", "Amount"]))
      .toBe("capital_components");
  });

  it("detects rwa_breakdown from risk_type header", () => {
    expect(detectFastPath([
      "period", "risk_type", "exposure_class", "exposure_amount", "risk_weight", "rwa",
    ])).toBe("rwa_breakdown");
    expect(detectFastPath([
      "period", "risk type", "exposure class", "exposure amount", "risk weight", "rwa",
    ])).toBe("rwa_breakdown");
  });

  it("rwa_breakdown wins over capital_components when both component and risk_type present", () => {
    // Hypothetical malformed file — risk_type is the more specific signal.
    expect(detectFastPath(["period", "component", "amount", "risk_type", "rwa"]))
      .toBe("rwa_breakdown");
  });

  it("does NOT classify a GL/sub-ledger CSV as capital", () => {
    expect(detectFastPath(["entry_date", "account", "debit_credit", "amount"]))
      .toBe("gl");
  });
});
```

If **exists**, append the above four `it` blocks to the existing `describe("detectFastPath", ...)` block.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/csv/__tests__/detect-shape.test.ts`
Expected: FAIL — the new shapes aren't detected yet (test expects `capital_components` / `rwa_breakdown`, got `unknown`).

- [ ] **Step 3: Extend detect-shape.ts**

In `lib/csv/detect-shape.ts`, replace lines 10 and 26-52:

Replace line 10:

```ts
export type CsvShape = "variance" | "ar" | "gl" | "sub_ledger" | "fx" | "capital_components" | "rwa_breakdown" | "unknown";
```

Replace the body of `detectFastPath` (line 26 to end). The full new function:

```ts
export function detectFastPath(headers: string[]): CsvShape {
  const joined = headers.map((h) => h.toLowerCase()).join(" | ");

  // FX-rates: from_currency + to_currency + rate
  if (/from[_\s-]?currency/i.test(joined) && /to[_\s-]?currency/i.test(joined) && /\brate\b/i.test(joined)) return "fx";

  // GL and sub-ledger have unique header signals — check first.
  if (/debit[_\s-]?credit/i.test(joined)) return "gl";
  if (/source[_\s-]?module/i.test(joined)) return "sub_ledger";

  // Capital-flow shapes. risk_type is the most-specific RWA signal, so it
  // wins over capital_components in the ambiguous case.
  const hasRiskType = /risk[_\s-]?type/i.test(joined);
  const hasExposureClass = /exposure[_\s-]?class/i.test(joined);
  if (hasRiskType && hasExposureClass) return "rwa_breakdown";

  const hasComponent = /\bcomponent\b/i.test(joined);
  const hasAmountCol = /\bamount\b/i.test(joined);
  const hasPeriod = /\bperiod\b/i.test(joined);
  if (hasComponent && hasAmountCol && hasPeriod) return "capital_components";

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

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/csv/__tests__/detect-shape.test.ts`
Expected: PASS.

Also run the broader CSV test suite to confirm no regression:

Run: `npx vitest run lib/csv/__tests__/`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv/detect-shape.ts lib/csv/__tests__/detect-shape.test.ts
git commit -m "feat(capital): detect capital_components and rwa_breakdown shapes"
```

---

## Task 6: Stats module — snapshot computation

**Files:**
- Create: `lib/capital/stats.ts`
- Test: `lib/capital/__tests__/stats.test.ts`

This task implements pure computation functions that operate on in-memory arrays. Prisma access comes in Task 7 (recompute wired to DB). Keeping this layer pure means we can test the ratio math without touching the database.

- [ ] **Step 1: Write the failing tests**

Create `lib/capital/__tests__/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeSnapshot,
  dedupeComponents,
  type ComponentInput,
  type RwaLineInput,
} from "../stats";

describe("dedupeComponents", () => {
  it("drops exact duplicates on (periodKey, component, amount, currency)", () => {
    const rows: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 50, currency: "USD" },
    ];
    expect(dedupeComponents(rows)).toHaveLength(2);
  });

  it("keeps legitimate multi-row entries (same component, different amounts)", () => {
    const rows: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "goodwill", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "goodwill", amount: 200, currency: "USD" },
    ];
    expect(dedupeComponents(rows)).toHaveLength(2);
  });
});

describe("computeSnapshot", () => {
  const baseComponents: ComponentInput[] = [
    { periodKey: "2026-Q1", component: "cet1_capital", amount: 12_400_000_000, currency: "USD" },
    { periodKey: "2026-Q1", component: "additional_tier1", amount: 1_500_000_000, currency: "USD" },
    { periodKey: "2026-Q1", component: "tier2", amount: 2_500_000_000, currency: "USD" },
    { periodKey: "2026-Q1", component: "total_rwa", amount: 93_900_000_000, currency: "USD" },
  ];

  it("computes ratios on the happy path (no deductions, no RWA lines)", () => {
    const snap = computeSnapshot(baseComponents, []);
    expect(snap.hasData).toBe(true);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.cet1Capital).toBe(12_400_000_000);
    expect(snap.tier1Capital).toBe(13_900_000_000);
    expect(snap.totalCapital).toBe(16_400_000_000);
    expect(snap.totalRwa).toBe(93_900_000_000);
    expect(snap.cet1Ratio).toBeCloseTo(0.132, 4);
    expect(snap.tier1Ratio).toBeCloseTo(0.148, 4);
    expect(snap.totalRatio).toBeCloseTo(0.1747, 4);
    expect(snap.rwaMismatch).toBeNull();
  });

  it("subtracts deductions from CET1", () => {
    const with_deductions: ComponentInput[] = [
      ...baseComponents,
      { periodKey: "2026-Q1", component: "goodwill", amount: 800_000_000, currency: "USD" },
      { periodKey: "2026-Q1", component: "dta", amount: 300_000_000, currency: "USD" },
    ];
    const snap = computeSnapshot(with_deductions, []);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.cet1Capital).toBe(12_400_000_000 - 800_000_000 - 300_000_000);
    expect(snap.tier1Capital).toBe(snap.cet1Capital + 1_500_000_000);
  });

  it("returns hasData:false when totalRwa is 0", () => {
    const noRwa: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
    ];
    expect(computeSnapshot(noRwa, []).hasData).toBe(false);
  });

  it("returns hasData:false when components list is empty", () => {
    expect(computeSnapshot([], []).hasData).toBe(false);
  });

  it("dedupes before aggregating", () => {
    const duplicated: ComponentInput[] = [
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "cet1_capital", amount: 100, currency: "USD" },
      { periodKey: "2026-Q1", component: "total_rwa", amount: 1000, currency: "USD" },
    ];
    const snap = computeSnapshot(duplicated, []);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.cet1Capital).toBe(100);
  });

  it("flags RWA mismatch > 1% when both sources disagree", () => {
    const rwaLines: RwaLineInput[] = [
      { periodKey: "2026-Q1", riskType: "credit", exposureClass: "x", exposureAmount: 0, riskWeight: 0, rwa: 80_000_000_000 },
      { periodKey: "2026-Q1", riskType: "market", exposureClass: "y", exposureAmount: 0, riskWeight: 0, rwa: 5_000_000_000 },
    ];
    // capital says 93.9B, rwa lines sum to 85B → ~9.5% gap.
    const snap = computeSnapshot(baseComponents, rwaLines);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.rwaMismatch).not.toBeNull();
    expect(snap.rwaMismatch!.capitalTotal).toBe(93_900_000_000);
    expect(snap.rwaMismatch!.rwaLineTotal).toBe(85_000_000_000);
    expect(snap.rwaMismatch!.deltaPct).toBeGreaterThan(0.09);
  });

  it("does NOT flag mismatch when sources agree within 1%", () => {
    const rwaLines: RwaLineInput[] = [
      { periodKey: "2026-Q1", riskType: "credit", exposureClass: "x", exposureAmount: 0, riskWeight: 0, rwa: 93_500_000_000 },
    ];
    // 93.5B vs 93.9B → 0.43% gap — below threshold.
    const snap = computeSnapshot(baseComponents, rwaLines);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.rwaMismatch).toBeNull();
  });

  it("always prefers capital_components total_rwa for ratios, ignoring RWA lines", () => {
    const rwaLines: RwaLineInput[] = [
      { periodKey: "2026-Q1", riskType: "credit", exposureClass: "x", exposureAmount: 0, riskWeight: 0, rwa: 50_000_000_000 },
    ];
    const snap = computeSnapshot(baseComponents, rwaLines);
    if (!snap.hasData) throw new Error("unreachable");
    expect(snap.totalRwa).toBe(93_900_000_000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capital/__tests__/stats.test.ts`
Expected: FAIL — `"../stats"` does not export `computeSnapshot` or `dedupeComponents`.

- [ ] **Step 3: Create the stats module**

Create `lib/capital/stats.ts`:

```ts
import { prisma } from "@/lib/db";
import { effectiveMinimum, type RatioKey } from "./minimums";

const RWA_MISMATCH_THRESHOLD = 0.01; // 1%

export type ComponentInput = {
  periodKey: string;
  component: string; // one of KNOWN_COMPONENTS at runtime
  amount: number;
  currency: string;
};

export type RwaLineInput = {
  periodKey: string;
  riskType: string;
  exposureClass: string;
  exposureAmount: number;
  riskWeight: number;
  rwa: number;
};

export type RwaMismatch = {
  capitalTotal: number;
  rwaLineTotal: number;
  deltaPct: number;
};

export type Snapshot =
  | { hasData: false }
  | {
      hasData: true;
      cet1Ratio: number;
      tier1Ratio: number;
      totalRatio: number;
      cet1Capital: number;
      tier1Capital: number;
      totalCapital: number;
      totalRwa: number;
      rwaMismatch: RwaMismatch | null;
    };

export function dedupeComponents(rows: ComponentInput[]): ComponentInput[] {
  const seen = new Set<string>();
  const out: ComponentInput[] = [];
  for (const r of rows) {
    const key = `${r.periodKey}|${r.component}|${r.amount}|${r.currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function computeSnapshot(
  components: ComponentInput[],
  rwaLines: RwaLineInput[],
): Snapshot {
  if (components.length === 0) return { hasData: false };

  const deduped = dedupeComponents(components);
  const sum = (name: string) =>
    deduped.filter((c) => c.component === name).reduce((s, c) => s + c.amount, 0);

  const cet1Gross = sum("cet1_capital");
  const at1 = sum("additional_tier1");
  const tier2 = sum("tier2");
  const goodwill = sum("goodwill");
  const dta = sum("dta");
  const otherDeductions = sum("other_deduction");
  const totalRwa = sum("total_rwa");

  if (totalRwa <= 0) return { hasData: false };

  const deductions = goodwill + dta + otherDeductions;
  const cet1Capital = cet1Gross - deductions;
  const tier1Capital = cet1Capital + at1;
  const totalCapital = tier1Capital + tier2;

  const rwaLineTotal = rwaLines.reduce((s, l) => s + l.rwa, 0);
  let rwaMismatch: RwaMismatch | null = null;
  if (rwaLines.length > 0) {
    const deltaPct = Math.abs(totalRwa - rwaLineTotal) / Math.abs(totalRwa);
    if (deltaPct > RWA_MISMATCH_THRESHOLD) {
      rwaMismatch = { capitalTotal: totalRwa, rwaLineTotal, deltaPct };
    }
  }

  return {
    hasData: true,
    cet1Capital,
    tier1Capital,
    totalCapital,
    totalRwa,
    cet1Ratio: cet1Capital / totalRwa,
    tier1Ratio: tier1Capital / totalRwa,
    totalRatio: totalCapital / totalRwa,
    rwaMismatch,
  };
}

export type Breach =
  | {
      kind: "ratio_breach";
      ratio: RatioKey;
      value: number;
      minimum: number;
      gap: number;
    }
  | {
      kind: "missing_source";
      sourceType: "capital_components" | "rwa_breakdown";
    }
  | {
      kind: "rwa_mismatch";
      capitalTotal: number;
      rwaLineTotal: number;
      deltaPct: number;
    };

export type RwaBreakdownRow = {
  riskType: string;
  totalRwa: number;
  share: number;
  lineCount: number;
  lines: { exposureClass: string; exposureAmount: number; riskWeight: number; rwa: number }[];
};

// ── DB-backed read helpers. These pull rows for the period and delegate
//    to the pure functions above. Tested in persist.test.ts via integration.

export async function getCapitalSnapshot(
  userId: string,
  periodKey: string,
): Promise<Snapshot> {
  const row = await prisma.capitalSnapshot.findUnique({
    where: { userId_periodKey: { userId, periodKey } },
  });
  if (!row) return { hasData: false };

  // Also refresh rwaMismatch from current RwaLine rows, since the snapshot
  // itself only persists the numbers — the mismatch flag is derived.
  const rwaLines = await prisma.rwaLine.findMany({
    where: { periodKey, dataSource: { userId, status: "ready" } },
    select: { rwa: true },
  });
  const rwaLineTotal = rwaLines.reduce((s, l) => s + l.rwa, 0);
  let rwaMismatch: RwaMismatch | null = null;
  if (rwaLines.length > 0 && row.totalRwa > 0) {
    const deltaPct = Math.abs(row.totalRwa - rwaLineTotal) / Math.abs(row.totalRwa);
    if (deltaPct > RWA_MISMATCH_THRESHOLD) {
      rwaMismatch = { capitalTotal: row.totalRwa, rwaLineTotal, deltaPct };
    }
  }

  return {
    hasData: true,
    cet1Ratio: row.cet1Ratio,
    tier1Ratio: row.tier1Ratio,
    totalRatio: row.totalRatio,
    cet1Capital: row.cet1Capital,
    tier1Capital: row.tier1Capital,
    totalCapital: row.totalCapital,
    totalRwa: row.totalRwa,
    rwaMismatch,
  };
}

export async function getRwaBreakdown(
  userId: string,
  periodKey: string,
): Promise<RwaBreakdownRow[]> {
  const lines = await prisma.rwaLine.findMany({
    where: { periodKey, dataSource: { userId, status: "ready" } },
    select: {
      riskType: true,
      exposureClass: true,
      exposureAmount: true,
      riskWeight: true,
      rwa: true,
    },
  });
  if (lines.length === 0) return [];

  const total = lines.reduce((s, l) => s + l.rwa, 0);
  const byType = new Map<string, RwaBreakdownRow>();
  for (const l of lines) {
    const existing = byType.get(l.riskType) ?? {
      riskType: l.riskType,
      totalRwa: 0,
      share: 0,
      lineCount: 0,
      lines: [],
    };
    existing.totalRwa += l.rwa;
    existing.lineCount += 1;
    existing.lines.push({
      exposureClass: l.exposureClass,
      exposureAmount: l.exposureAmount,
      riskWeight: l.riskWeight,
      rwa: l.rwa,
    });
    byType.set(l.riskType, existing);
  }
  for (const row of byType.values()) {
    row.share = total === 0 ? 0 : row.totalRwa / total;
  }
  return [...byType.values()].sort((a, b) => b.totalRwa - a.totalRwa);
}

export async function getCapitalBreaches(
  userId: string,
  periodKey: string,
): Promise<Breach[]> {
  const breaches: Breach[] = [];
  const snap = await getCapitalSnapshot(userId, periodKey);

  // Detect which uploads are present for this period (scoped to this user).
  const [compCount, rwaCount] = await Promise.all([
    prisma.capitalComponent.count({
      where: { periodKey, dataSource: { userId, status: "ready" } },
    }),
    prisma.rwaLine.count({
      where: { periodKey, dataSource: { userId, status: "ready" } },
    }),
  ]);

  if (compCount === 0) {
    breaches.push({ kind: "missing_source", sourceType: "capital_components" });
  }
  if (rwaCount === 0) {
    breaches.push({ kind: "missing_source", sourceType: "rwa_breakdown" });
  }

  if (snap.hasData) {
    const checks: RatioKey[] = ["cet1", "tier1", "total"];
    for (const key of checks) {
      const value =
        key === "cet1" ? snap.cet1Ratio : key === "tier1" ? snap.tier1Ratio : snap.totalRatio;
      const minimum = effectiveMinimum(key);
      if (value < minimum) {
        breaches.push({
          kind: "ratio_breach",
          ratio: key,
          value,
          minimum,
          gap: minimum - value,
        });
      }
    }
    if (snap.rwaMismatch) {
      breaches.push({ kind: "rwa_mismatch", ...snap.rwaMismatch });
    }
  }

  return breaches;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/capital/__tests__/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/capital/stats.ts lib/capital/__tests__/stats.test.ts
git commit -m "feat(capital): snapshot + breaches + RWA breakdown computation"
```

---

## Task 7: Persist module — ingest and recompute snapshot

**Files:**
- Create: `lib/capital/persist.ts`
- Test: `lib/capital/__tests__/persist.test.ts`

The persist functions are DB-bound and hardest to unit test. We test the recompute-snapshot function end-to-end against a live Prisma instance in a test database — same pattern as `lib/reconciliation/__tests__/persist.test.ts`. If that test infrastructure isn't already established, skip the test for this task and rely on integration coverage in Task 9.

- [ ] **Step 1: Check if DB-bound tests already exist**

Run:

```bash
cat lib/reconciliation/__tests__/persist.test.ts | head -40
```

If the file imports `prisma` directly and has live Prisma calls, the test infrastructure supports DB tests — proceed with Step 2. If it mocks prisma or the file does not exist, skip to Step 4 (no test for this task; coverage comes in Task 9).

- [ ] **Step 2: Write the failing test (only if DB infrastructure supports it)**

Create `lib/capital/__tests__/persist.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  ingestCapitalComponents,
  ingestRwaBreakdown,
  recomputeCapitalSnapshot,
} from "../persist";

describe("capital persist", () => {
  let userId: string;

  beforeEach(async () => {
    await prisma.capitalSnapshot.deleteMany({});
    await prisma.rwaLine.deleteMany({});
    await prisma.capitalComponent.deleteMany({});
    await prisma.capitalPeriod.deleteMany({});
    const user = await prisma.user.create({
      data: {
        lyzrAccountId: `test-${Date.now()}`,
        email: `test-${Date.now()}@ex.com`,
        name: "T",
      },
    });
    userId = user.id;
  });

  it("ingests capital components and creates a snapshot", async () => {
    const headers = ["period", "component", "amount", "currency"];
    const rows = [
      ["2026-Q1", "cet1_capital", "10000", "USD"],
      ["2026-Q1", "additional_tier1", "1500", "USD"],
      ["2026-Q1", "tier2", "2500", "USD"],
      ["2026-Q1", "total_rwa", "100000", "USD"],
    ];

    const result = await ingestCapitalComponents(userId, "components.csv", headers, rows, "hash-a");
    expect(result.periodsTouched).toContain("2026-Q1");

    const snap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    expect(snap).not.toBeNull();
    expect(snap!.cet1Ratio).toBeCloseTo(0.1, 4);
    expect(snap!.tier1Ratio).toBeCloseTo(0.115, 4);
    expect(snap!.totalRatio).toBeCloseTo(0.14, 4);
  });

  it("recompute picks up newly-uploaded RWA lines without changing ratios", async () => {
    await ingestCapitalComponents(
      userId,
      "components.csv",
      ["period", "component", "amount", "currency"],
      [
        ["2026-Q1", "cet1_capital", "10000", "USD"],
        ["2026-Q1", "total_rwa", "100000", "USD"],
      ],
      "hash-c",
    );

    await ingestRwaBreakdown(
      userId,
      "rwa.csv",
      ["period", "risk_type", "exposure_class", "exposure_amount", "risk_weight", "rwa"],
      [
        ["2026-Q1", "credit", "corp", "100000", "1.0", "80000"],
        ["2026-Q1", "market", "tb", "10000", "0.5", "5000"],
        ["2026-Q1", "operational", "op", "0", "0", "15000"],
      ],
      "hash-r",
    );

    const snap = await prisma.capitalSnapshot.findUnique({
      where: { userId_periodKey: { userId, periodKey: "2026-Q1" } },
    });
    // ratios are unchanged — capital_components drives the denominator.
    expect(snap!.totalRwa).toBe(100_000);

    const lines = await prisma.rwaLine.count({ where: { periodKey: "2026-Q1" } });
    expect(lines).toBe(3);
  });

  it("upserts CapitalPeriod rows for every touched period", async () => {
    await ingestCapitalComponents(
      userId,
      "m.csv",
      ["period", "component", "amount"],
      [
        ["2026-Q1", "cet1_capital", "100"],
        ["2026-Q1", "total_rwa", "1000"],
        ["2026-Q2", "cet1_capital", "200"],
        ["2026-Q2", "total_rwa", "2000"],
      ],
      "hash-multi",
    );
    const periods = await prisma.capitalPeriod.findMany({ where: { userId } });
    expect(periods.map((p) => p.periodKey).sort()).toEqual(["2026-Q1", "2026-Q2"]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/capital/__tests__/persist.test.ts`
Expected: FAIL — module `"../persist"` not found.

- [ ] **Step 4: Create the persist module**

Create `lib/capital/persist.ts`:

```ts
import { prisma } from "@/lib/db";
import {
  parseCapitalComponents,
  parseRwaBreakdown,
  type SkippedRow,
} from "@/lib/csv/capital-parser";
import { computeSnapshot, type ComponentInput, type RwaLineInput } from "./stats";
import { upsertCapitalPeriod } from "./period";

export async function ingestCapitalComponents(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][],
  contentHash: string,
): Promise<{
  dataSource: { id: string; name: string; recordCount: number };
  skipped: SkippedRow[];
  periodsTouched: string[];
}> {
  const { components, skipped } = parseCapitalComponents(headers, rows);

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "capital_components",
      name: fileName,
      status: "processing",
      metadata: JSON.stringify({ headers, shape: "capital_components" }),
      contentHash,
    },
  });

  if (components.length > 0) {
    await prisma.capitalComponent.createMany({
      data: components.map((c) => ({
        dataSourceId: dataSource.id,
        periodKey: c.periodKey,
        component: c.component,
        amount: c.amount,
        currency: c.currency,
      })),
    });
  }

  const periodsTouched = [...new Set(components.map((c) => c.periodKey))];
  for (const pk of periodsTouched) {
    await upsertCapitalPeriod(userId, pk);
  }

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: { status: "ready", recordCount: components.length },
  });

  for (const pk of periodsTouched) {
    await recomputeCapitalSnapshot(userId, pk);
  }

  return {
    dataSource: { id: dataSource.id, name: dataSource.name, recordCount: components.length },
    skipped,
    periodsTouched,
  };
}

export async function ingestRwaBreakdown(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][],
  contentHash: string,
): Promise<{
  dataSource: { id: string; name: string; recordCount: number };
  skipped: SkippedRow[];
  periodsTouched: string[];
}> {
  const { lines, skipped } = parseRwaBreakdown(headers, rows);

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: "rwa_breakdown",
      name: fileName,
      status: "processing",
      metadata: JSON.stringify({ headers, shape: "rwa_breakdown" }),
      contentHash,
    },
  });

  if (lines.length > 0) {
    await prisma.rwaLine.createMany({
      data: lines.map((l) => ({
        dataSourceId: dataSource.id,
        periodKey: l.periodKey,
        riskType: l.riskType,
        exposureClass: l.exposureClass,
        exposureAmount: l.exposureAmount,
        riskWeight: l.riskWeight,
        rwa: l.rwa,
      })),
    });
  }

  const periodsTouched = [...new Set(lines.map((l) => l.periodKey))];
  for (const pk of periodsTouched) {
    await upsertCapitalPeriod(userId, pk);
  }

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: { status: "ready", recordCount: lines.length },
  });

  for (const pk of periodsTouched) {
    await recomputeCapitalSnapshot(userId, pk);
  }

  return {
    dataSource: { id: dataSource.id, name: dataSource.name, recordCount: lines.length },
    skipped,
    periodsTouched,
  };
}

export async function recomputeCapitalSnapshot(
  userId: string,
  periodKey: string,
): Promise<void> {
  const [compRows, rwaRows] = await Promise.all([
    prisma.capitalComponent.findMany({
      where: { periodKey, dataSource: { userId, status: "ready" } },
      select: { periodKey: true, component: true, amount: true, currency: true },
    }),
    prisma.rwaLine.findMany({
      where: { periodKey, dataSource: { userId, status: "ready" } },
      select: {
        periodKey: true,
        riskType: true,
        exposureClass: true,
        exposureAmount: true,
        riskWeight: true,
        rwa: true,
      },
    }),
  ]);

  const snap = computeSnapshot(
    compRows as ComponentInput[],
    rwaRows as RwaLineInput[],
  );

  if (!snap.hasData) {
    // Remove stale snapshot if one exists (e.g., a prior upload was deleted
    // and there's no longer enough data to compute ratios).
    await prisma.capitalSnapshot.deleteMany({
      where: { userId, periodKey },
    });
    return;
  }

  await prisma.capitalSnapshot.upsert({
    where: { userId_periodKey: { userId, periodKey } },
    create: {
      userId,
      periodKey,
      cet1Ratio: snap.cet1Ratio,
      tier1Ratio: snap.tier1Ratio,
      totalRatio: snap.totalRatio,
      cet1Capital: snap.cet1Capital,
      tier1Capital: snap.tier1Capital,
      totalCapital: snap.totalCapital,
      totalRwa: snap.totalRwa,
    },
    update: {
      cet1Ratio: snap.cet1Ratio,
      tier1Ratio: snap.tier1Ratio,
      totalRatio: snap.totalRatio,
      cet1Capital: snap.cet1Capital,
      tier1Capital: snap.tier1Capital,
      totalCapital: snap.totalCapital,
      totalRwa: snap.totalRwa,
      computedAt: new Date(),
    },
  });
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run lib/capital/__tests__/persist.test.ts`
Expected: PASS (or skipped if Step 1 determined no DB infra).

- [ ] **Step 6: Commit**

```bash
git add lib/capital/persist.ts
# Only add the test file if Step 2 was executed
git add lib/capital/__tests__/persist.test.ts 2>/dev/null || true
git commit -m "feat(capital): ingest + recompute snapshot"
```

---

## Task 8: Barrel exports + API route for periods

**Files:**
- Create: `lib/capital/index.ts`
- Create: `app/api/capital/periods/route.ts`

- [ ] **Step 1: Create the barrel**

Create `lib/capital/index.ts`:

```ts
export { BASEL_III_MINIMUMS, effectiveMinimum, ratioStatus } from "./minimums";
export type { RatioKey, RatioStatus } from "./minimums";
export { listCapitalPeriods, resolveActivePeriod, safely, upsertCapitalPeriod } from "./period";
export type { CapitalPeriodSummary } from "./period";
export {
  computeSnapshot,
  dedupeComponents,
  getCapitalSnapshot,
  getRwaBreakdown,
  getCapitalBreaches,
} from "./stats";
export type {
  Snapshot,
  Breach,
  RwaBreakdownRow,
  RwaMismatch,
  ComponentInput,
  RwaLineInput,
} from "./stats";
export { ingestCapitalComponents, ingestRwaBreakdown, recomputeCapitalSnapshot } from "./persist";
```

- [ ] **Step 2: Create the periods API route**

Create `app/api/capital/periods/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCapitalPeriods, safely } from "@/lib/capital/period";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const periods = await safely(() => listCapitalPeriods(session.userId), []);
  return NextResponse.json({ periods });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add lib/capital/index.ts app/api/capital/periods/route.ts
git commit -m "feat(capital): barrel exports + periods API route"
```

---

## Task 9: Wire capital shapes into the upload route

**Files:**
- Modify: `app/api/upload/route.ts`
- Test: `app/api/upload/route.test.ts` (extend)

- [ ] **Step 1: Read the existing upload route test to see the test style**

Run:

```bash
cat app/api/upload/route.test.ts
```

The style mirrors the existing `gl` / `sub_ledger` / `fx` cases. You'll add two new cases: `capital_components` and `rwa_breakdown`.

- [ ] **Step 2: Write the failing test**

Append these tests to the existing `describe` block in `app/api/upload/route.test.ts` (do not replace existing content — find the closing `})` of the final existing test and insert before it):

```ts
  it("routes a capital_components CSV to the capital ingest branch", async () => {
    const csv = [
      "period,component,amount,currency",
      "2026-Q1,cet1_capital,10000,USD",
      "2026-Q1,total_rwa,100000,USD",
    ].join("\n");
    const formData = new FormData();
    formData.append(
      "file",
      new File([csv], "components.csv", { type: "text/csv" }),
    );
    formData.append("userId", userId);

    const req = new NextRequest("http://x/api/upload", { method: "POST", body: formData });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("capital_components");
    expect(body.periodsTouched).toContain("2026-Q1");
  });

  it("routes an rwa_breakdown CSV to the RWA ingest branch", async () => {
    const csv = [
      "period,risk_type,exposure_class,exposure_amount,risk_weight,rwa",
      "2026-Q1,credit,corp,100000,1.0,100000",
    ].join("\n");
    const formData = new FormData();
    formData.append("file", new File([csv], "rwa.csv", { type: "text/csv" }));
    formData.append("userId", userId);

    const req = new NextRequest("http://x/api/upload", { method: "POST", body: formData });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("rwa_breakdown");
  });
```

If the existing tests use different helpers (e.g. a pre-made user fixture), adapt the `userId` / `FormData` setup to match the surrounding style.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run app/api/upload/route.test.ts`
Expected: FAIL — the two new shapes route to the "unknown" branch and return 400.

- [ ] **Step 4: Add the two new branches in the upload route**

In `app/api/upload/route.ts`:

Add this import at the top (alongside existing imports from `@/lib/reconciliation/persist`):

```ts
import { ingestCapitalComponents, ingestRwaBreakdown } from "@/lib/capital";
```

Then, after the existing `if (shape === "sub_ledger") { ... }` branch (around line 76), insert:

```ts
  if (shape === "capital_components") {
    const { dataSource, skipped, periodsTouched } = await ingestCapitalComponents(
      userId, file.name, headers, rows, contentHash,
    );
    return NextResponse.json({
      kind: "capital_components",
      dataSource,
      skipped: skipped.length,
      periodsTouched,
    });
  }
  if (shape === "rwa_breakdown") {
    const { dataSource, skipped, periodsTouched } = await ingestRwaBreakdown(
      userId, file.name, headers, rows, contentHash,
    );
    return NextResponse.json({
      kind: "rwa_breakdown",
      dataSource,
      skipped: skipped.length,
      periodsTouched,
    });
  }
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run app/api/upload/route.test.ts`
Expected: PASS for all cases (existing + two new).

- [ ] **Step 6: Commit**

```bash
git add app/api/upload/route.ts app/api/upload/route.test.ts
git commit -m "feat(capital): route capital and RWA CSVs through /api/upload"
```

---

## Task 10: Journey-context builder

**Files:**
- Create: `lib/agent/journey-context/regulatory-capital.ts`
- Modify: `lib/agent/journey-context/index.ts`
- Modify: `lib/agent/journey-context/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing registry test cases**

Append these `describe` and `it` blocks to `lib/agent/journey-context/__tests__/registry.test.ts` (before the final closing `})` of the outer describe):

```ts
  describe("regulatory-capital context", () => {
    afterEach(() => vi.restoreAllMocks());

    it("returns live snapshot + breaches, NOT the placeholder", async () => {
      const capitalStats = await import("@/lib/capital/stats");
      vi.spyOn(capitalStats, "getCapitalSnapshot").mockResolvedValue({
        hasData: true,
        cet1Ratio: 0.132,
        tier1Ratio: 0.151,
        totalRatio: 0.178,
        cet1Capital: 12_400_000_000,
        tier1Capital: 13_900_000_000,
        totalCapital: 16_400_000_000,
        totalRwa: 93_900_000_000,
        rwaMismatch: null,
      } as any);
      vi.spyOn(capitalStats, "getCapitalBreaches").mockResolvedValue([] as any);
      vi.spyOn(capitalStats, "getRwaBreakdown").mockResolvedValue([
        { riskType: "credit", totalRwa: 78_000_000_000, share: 0.83, lineCount: 4, lines: [] },
        { riskType: "market", totalRwa: 9_100_000_000, share: 0.097, lineCount: 2, lines: [] },
        { riskType: "operational", totalRwa: 6_800_000_000, share: 0.072, lineCount: 1, lines: [] },
      ] as any);

      const out = await buildJourneyContext("user-1", "regulatory-capital", "2026-Q1");

      expect(out).toContain("Regulatory Capital");
      expect(out).toContain("2026-Q1");
      expect(out).toContain("CET1");
      expect(out).toContain("13.2%");
      expect(out).toContain("credit");
      expect(out).not.toContain("demo placeholder");
    });

    it("empty-state message when no capital data for the period", async () => {
      const capitalStats = await import("@/lib/capital/stats");
      vi.spyOn(capitalStats, "getCapitalSnapshot").mockResolvedValue({ hasData: false } as any);
      vi.spyOn(capitalStats, "getCapitalBreaches").mockResolvedValue([
        { kind: "missing_source", sourceType: "capital_components" },
      ] as any);
      vi.spyOn(capitalStats, "getRwaBreakdown").mockResolvedValue([] as any);

      const out = await buildJourneyContext("user-1", "regulatory-capital", "2026-Q1");

      expect(out).toContain("Regulatory Capital");
      expect(out).toContain("2026-Q1");
      expect(out).toContain("/data-sources?tab=capital");
      expect(out).not.toContain("demo placeholder");
    });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/agent/journey-context/__tests__/registry.test.ts`
Expected: FAIL — the registry still returns the placeholder for `regulatory-capital`.

- [ ] **Step 3: Create the builder**

Create `lib/agent/journey-context/regulatory-capital.ts`:

```ts
import {
  getCapitalSnapshot,
  getCapitalBreaches,
  getRwaBreakdown,
  type Breach,
  type Snapshot,
  type RwaBreakdownRow,
} from "@/lib/capital/stats";
import { effectiveMinimum } from "@/lib/capital/minimums";

export async function buildCapitalContext(
  userId: string,
  periodKey: string,
): Promise<string> {
  const [snap, breaches, rwa] = await Promise.all([
    getCapitalSnapshot(userId, periodKey),
    getCapitalBreaches(userId, periodKey),
    getRwaBreakdown(userId, periodKey),
  ]);

  const header = `## Current Journey: Regulatory Capital — period ${periodKey}`;

  if (!snap.hasData) {
    return (
      `${header}\n` +
      `No capital data yet for ${periodKey}. ` +
      `Tell the user to upload a capital components CSV at /data-sources?tab=capital.`
    );
  }

  const snapshotBlock = formatSnapshot(snap);
  const breachBlock =
    breaches.length === 0
      ? "No breaches or warnings."
      : breaches.map(formatBreach).join("\n");
  const rwaBlock =
    rwa.length === 0
      ? "No RWA breakdown uploaded for this period."
      : rwa.map((r) => formatRwaRow(r)).join("\n");

  return [
    header,
    "",
    "### Snapshot",
    snapshotBlock,
    "",
    `### Breaches / warnings (${breaches.length})`,
    breachBlock,
    "",
    "### RWA breakdown",
    rwaBlock,
  ].join("\n");
}

function formatSnapshot(snap: Extract<Snapshot, { hasData: true }>): string {
  const lines: string[] = [];
  lines.push(
    `CET1 ratio: ${(snap.cet1Ratio * 100).toFixed(2)}% (min ${(effectiveMinimum("cet1") * 100).toFixed(1)}%)`,
  );
  lines.push(
    `Tier 1 ratio: ${(snap.tier1Ratio * 100).toFixed(2)}% (min ${(effectiveMinimum("tier1") * 100).toFixed(1)}%)`,
  );
  lines.push(
    `Total Capital ratio: ${(snap.totalRatio * 100).toFixed(2)}% (min ${(effectiveMinimum("total") * 100).toFixed(1)}%)`,
  );
  lines.push(`CET1 capital (net of deductions): $${snap.cet1Capital.toLocaleString()}`);
  lines.push(`Tier 1 capital: $${snap.tier1Capital.toLocaleString()}`);
  lines.push(`Total capital: $${snap.totalCapital.toLocaleString()}`);
  lines.push(`Total RWA: $${snap.totalRwa.toLocaleString()}`);
  return lines.join("\n");
}

function formatBreach(b: Breach): string {
  if (b.kind === "ratio_breach") {
    return `- [BREACH] ${b.ratio.toUpperCase()} is ${(b.value * 100).toFixed(2)}%, below ${(b.minimum * 100).toFixed(1)}% minimum (gap ${(b.gap * 100).toFixed(2)}%)`;
  }
  if (b.kind === "missing_source") {
    return `- [MISSING] ${b.sourceType}`;
  }
  return `- [RWA MISMATCH] capital components report $${b.capitalTotal.toLocaleString()}, RWA lines sum to $${b.rwaLineTotal.toLocaleString()} (${(b.deltaPct * 100).toFixed(2)}% gap)`;
}

function formatRwaRow(r: RwaBreakdownRow): string {
  return `- ${r.riskType}: $${r.totalRwa.toLocaleString()} (${(r.share * 100).toFixed(1)}%) across ${r.lineCount} exposure class${r.lineCount === 1 ? "" : "es"}`;
}
```

- [ ] **Step 4: Register the builder**

In `lib/agent/journey-context/index.ts`, modify the imports and the `BUILDERS` map:

Add import at the top:

```ts
import { buildCapitalContext } from "./regulatory-capital";
```

In the `BUILDERS` object (currently lines 16-19), add the capital builder:

```ts
const BUILDERS: Record<string, JourneyContextBuilder> = {
  "financial-reconciliation": buildReconciliationContext,
  "monthly-close": buildMonthlyCloseContext,
  "regulatory-capital": buildCapitalContext,
};
```

Also extend the newest-period fallback logic in `buildJourneyContext`. Replace the current `if (journeyId === "financial-reconciliation" && !resolvedPeriodKey)` block (around line 31-37) with:

```ts
    let resolvedPeriodKey = periodKey ?? "";
    if (!resolvedPeriodKey) {
      if (journeyId === "financial-reconciliation") {
        const newest = await prisma.reconPeriod.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        resolvedPeriodKey = newest?.periodKey ?? "";
      } else if (journeyId === "regulatory-capital") {
        const newest = await prisma.capitalPeriod.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        resolvedPeriodKey = newest?.periodKey ?? "";
      }
    }
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run lib/agent/journey-context/__tests__/registry.test.ts`
Expected: PASS for all cases (including the new regulatory-capital ones).

- [ ] **Step 6: Commit**

```bash
git add lib/agent/journey-context/regulatory-capital.ts lib/agent/journey-context/index.ts lib/agent/journey-context/__tests__/registry.test.ts
git commit -m "feat(capital): journey-context builder for regulatory-capital"
```

---

## Task 11: Period picker and ExplainButton client components

**Files:**
- Create: `app/(shell)/regulatory-capital/period-picker.tsx`
- Create: `app/(shell)/regulatory-capital/explain-button.tsx`

These are straight copies of the monthly-close components adapted for the capital API route. No tests — they're pure UI glue.

- [ ] **Step 1: Create the period picker**

Create `app/(shell)/regulatory-capital/period-picker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Period = { periodKey: string };

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("period") ?? "";
  const [periods, setPeriods] = useState<Period[]>([]);

  useEffect(() => {
    fetch("/api/capital/periods")
      .then((r) => r.json())
      .then((d) => setPeriods(d.periods ?? []))
      .catch(() => setPeriods([]));
  }, []);

  if (periods.length === 0) {
    return <span className="text-xs text-muted-foreground">no periods</span>;
  }

  return (
    <select
      value={active || periods[0].periodKey}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("period", e.target.value);
        router.push(`?${next.toString()}`);
      }}
      className="text-xs bg-secondary border border-border rounded px-2 py-1"
    >
      {periods.map((p) => (
        <option key={p.periodKey} value={p.periodKey}>
          {p.periodKey}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Create the explain button**

Create `app/(shell)/regulatory-capital/explain-button.tsx`:

```tsx
"use client";

import { openAskAi } from "@/components/journey/journey-chat-bridge";

export function ExplainButton({ prompt, label = "Ask AI" }: { prompt: string; label?: string }) {
  return (
    <button
      onClick={() => openAskAi(prompt)}
      className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/regulatory-capital/period-picker.tsx" "app/(shell)/regulatory-capital/explain-button.tsx"
git commit -m "feat(capital): period picker + explain button client components"
```

---

## Task 12: Rewrite the regulatory-capital page

**Files:**
- Modify (rewrite): `app/(shell)/regulatory-capital/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `app/(shell)/regulatory-capital/page.tsx` with:

```tsx
import { Suspense } from "react";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { JourneyPage } from "@/components/journey/journey-page";
import { getSession } from "@/lib/auth";
import {
  listCapitalPeriods,
  resolveActivePeriod,
  safely,
  getCapitalSnapshot,
  getCapitalBreaches,
  getRwaBreakdown,
  effectiveMinimum,
  ratioStatus,
  type RatioKey,
  type Breach,
  type Snapshot,
  type RwaBreakdownRow,
} from "@/lib/capital";
import { PeriodPicker } from "./period-picker";
import { ExplainButton } from "./explain-button";

const JOURNEY_PROPS = {
  id: "regulatory-capital",
  title: "Regulatory Capital",
  description: "CET1, RWA, leverage ratios & Basel III compliance assessment",
  icon: Landmark,
  nudges: ["Are we above minimums?", "What drives RWA?", "CET1 trend"],
};

export default async function RegulatoryCapitalPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: requested } = await searchParams;
  const session = await getSession();
  const userId = session?.userId ?? null;

  if (!userId) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">Sign in to see your regulatory capital position.</p>
        </div>
      </JourneyPage>
    );
  }

  const periods = await listCapitalPeriods(userId);
  const active = resolveActivePeriod(periods, requested);

  if (!active) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">
            Upload a capital components CSV to see your Basel III ratios.
          </p>
          <Link href="/data-sources?tab=capital" className="underline">
            Go to Data Sources
          </Link>
        </div>
      </JourneyPage>
    );
  }

  const [snapshot, breaches, rwa] = await Promise.all([
    safely(() => getCapitalSnapshot(userId, active), { hasData: false as const }),
    safely(() => getCapitalBreaches(userId, active), [] as Breach[]),
    safely(() => getRwaBreakdown(userId, active), [] as RwaBreakdownRow[]),
  ]);

  const header = (
    <div className="flex items-center justify-between gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Period:</span>
        <Suspense fallback={<span className="text-xs text-muted-foreground">loading…</span>}>
          <PeriodPicker />
        </Suspense>
      </div>
    </div>
  );

  return (
    <JourneyPage {...JOURNEY_PROPS} periodKey={active}>
      {header}

      {/* Ratio cards */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <RatioCard
          label="CET1"
          ratioKey="cet1"
          snapshot={snapshot}
          period={active}
        />
        <RatioCard
          label="Tier 1"
          ratioKey="tier1"
          snapshot={snapshot}
          period={active}
        />
        <RatioCard
          label="Total Capital"
          ratioKey="total"
          snapshot={snapshot}
          period={active}
        />
      </div>

      {/* Breaches section */}
      {breaches.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
            Breaches & warnings
          </h3>
          <div className="bg-card border border-border rounded-[var(--radius)] p-4 mb-6">
            <ul className="space-y-2 text-sm">
              {breaches.map((b, i) => (
                <BreachRow key={i} breach={b} period={active} />
              ))}
            </ul>
          </div>
        </>
      )}

      {/* RWA breakdown */}
      {rwa.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
            RWA breakdown
          </h3>
          <RwaBreakdownTable rows={rwa} period={active} />
        </>
      )}

      {/* Hint when RWA not uploaded but snapshot exists */}
      {rwa.length === 0 && snapshot.hasData && (
        <div className="text-xs text-muted-foreground mt-4">
          Upload an RWA breakdown CSV at{" "}
          <Link href="/data-sources?tab=capital" className="underline">
            Data Sources
          </Link>{" "}
          to see what drives your RWA.
        </div>
      )}
    </JourneyPage>
  );
}

function RatioCard({
  label,
  ratioKey,
  snapshot,
  period,
}: {
  label: string;
  ratioKey: RatioKey;
  snapshot: Snapshot;
  period: string;
}) {
  const minimum = effectiveMinimum(ratioKey);
  const value = snapshot.hasData
    ? ratioKey === "cet1"
      ? snapshot.cet1Ratio
      : ratioKey === "tier1"
        ? snapshot.tier1Ratio
        : snapshot.totalRatio
    : null;
  const status = value !== null ? ratioStatus(value, ratioKey) : "below_minimum";
  const barColor =
    status === "above_buffer"
      ? "bg-success"
      : status === "above_minimum"
        ? "bg-amber-500"
        : "bg-danger";
  const displayValue = value !== null ? `${(value * 100).toFixed(2)}%` : "—";
  const displayMin = `${(minimum * 100).toFixed(1)}%`;
  const barPct = value !== null ? Math.min((value / 0.20) * 100, 100) : 0;

  return (
    <div className="bg-card border border-border rounded-[var(--radius)] p-6 text-center">
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {value !== null && (
          <ExplainButton
            prompt={`Explain why the ${label} ratio is ${displayValue} for period ${period}`}
          />
        )}
      </div>
      <div
        className="text-3xl font-semibold text-foreground"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {displayValue}
      </div>
      <div className="text-xs text-muted-foreground mt-2">Min. required: {displayMin}</div>
      <div className="w-full bg-border/50 rounded-full h-2 mt-3">
        <div className={`${barColor} rounded-full h-2`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}

function BreachRow({ breach, period }: { breach: Breach; period: string }) {
  if (breach.kind === "ratio_breach") {
    return (
      <li className="flex items-center justify-between gap-3">
        <span>
          <span className="font-medium uppercase">{breach.ratio}</span> is{" "}
          {(breach.value * 100).toFixed(2)}% — below {(breach.minimum * 100).toFixed(1)}% minimum
          (gap: {(breach.gap * 100).toFixed(2)}%)
        </span>
        <ExplainButton
          prompt={`Why is ${breach.ratio.toUpperCase()} below the regulatory minimum for ${period}? Suggest actions to restore it.`}
        />
      </li>
    );
  }
  if (breach.kind === "missing_source") {
    const label =
      breach.sourceType === "capital_components" ? "capital components" : "RWA breakdown";
    return (
      <li className="flex items-center justify-between gap-3">
        <span>No {label} uploaded for {period}</span>
        <Link href="/data-sources?tab=capital" className="text-xs underline">
          Upload
        </Link>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3">
      <span>
        Capital components report ${breach.capitalTotal.toLocaleString()} RWA, RWA breakdown sums
        to ${breach.rwaLineTotal.toLocaleString()} ({(breach.deltaPct * 100).toFixed(2)}% gap)
      </span>
      <ExplainButton
        prompt={`The capital components file shows $${breach.capitalTotal.toLocaleString()} total RWA but the RWA breakdown sums to $${breach.rwaLineTotal.toLocaleString()}. What could explain the discrepancy?`}
      />
    </li>
  );
}

function RwaBreakdownTable({
  rows,
  period,
}: {
  rows: RwaBreakdownRow[];
  period: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-0 px-4 py-2.5 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        <div>Risk Type</div>
        <div className="text-right">Total RWA</div>
        <div className="text-right">Share</div>
        <div className="text-right"># classes</div>
        <div />
      </div>
      {rows.map((r) => (
        <RwaBreakdownRow key={r.riskType} row={r} period={period} />
      ))}
    </div>
  );
}

// Each row is a native <details> element. Collapsed by default; clicking the
// summary row expands it in-place to show the exposure-class lines. No client
// state — works with plain HTML. One-expanded-at-a-time behavior is not
// enforced (would require JS state); the design is expand-many-if-you-want,
// which matches <details> semantics and is simpler than wiring a client
// component for mutual-exclusion.
function RwaBreakdownRow({ row, period }: { row: RwaBreakdownRow; period: string }) {
  return (
    <details className="border-b border-border last:border-b-0 group">
      <summary className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-0 px-4 py-2.5 text-sm cursor-pointer hover:bg-secondary/30 list-none [&::-webkit-details-marker]:hidden">
        <div className="font-medium capitalize flex items-center gap-2">
          <span className="text-muted-foreground group-open:rotate-90 transition-transform">›</span>
          {row.riskType}
        </div>
        <div className="text-right font-semibold">${row.totalRwa.toLocaleString()}</div>
        <div className="text-right text-muted-foreground">
          {(row.share * 100).toFixed(1)}%
        </div>
        <div className="text-right text-muted-foreground">{row.lineCount}</div>
        <div className="text-right" onClick={(e) => e.stopPropagation()}>
          <ExplainButton
            prompt={`What drives ${row.riskType} RWA for ${period}? Which exposure classes contribute most?`}
          />
        </div>
      </summary>
      <div className="bg-secondary/20 px-8 py-3">
        {row.lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exposure-class detail.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Exposure Class</th>
                <th className="text-right py-1">Exposure</th>
                <th className="text-right py-1">Weight</th>
                <th className="text-right py-1">RWA</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-1">{l.exposureClass}</td>
                  <td className="py-1 text-right">${l.exposureAmount.toLocaleString()}</td>
                  <td className="py-1 text-right">{(l.riskWeight * 100).toFixed(1)}%</td>
                  <td className="py-1 text-right font-medium">${l.rwa.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(shell)/regulatory-capital/page.tsx"
git commit -m "feat(capital): rewrite regulatory-capital page as data-driven"
```

---

## Task 13: Data-sources tab — add capital

**Files:**
- Modify: `app/(shell)/data-sources/page.tsx`
- Modify: `components/data-sources/link-sheet-area.tsx`

- [ ] **Step 1: Extend the LinkSheetArea shape union**

In `components/data-sources/link-sheet-area.tsx`, change line 7 from:

```ts
  shape: "variance" | "ar" | "gl" | "sub_ledger" | "fx";
```

to:

```ts
  shape: "variance" | "ar" | "gl" | "sub_ledger" | "fx" | "capital_components" | "rwa_breakdown";
```

If the file has a `switch` or `if/else` rendering hint text based on shape (lines 33-37), add a branch:

```tsx
          : shape === "capital_components" || shape === "rwa_breakdown"
          ? " Sheet should be a capital components or RWA breakdown export — we auto-detect the shape."
```

Place this branch before the final `else` / default. Use the file's existing prose pattern.

- [ ] **Step 2: Extend the TabShape type and tabs array**

In `app/(shell)/data-sources/page.tsx`:

Change line 11 from:

```ts
type TabShape = "variance" | "ar" | "reconciliation";
```

to:

```ts
type TabShape = "variance" | "ar" | "reconciliation" | "capital";
```

Extend the initial-tab parser (around line 30):

```ts
    if (tab === "reconciliation" || tab === "ar" || tab === "capital") return tab;
```

Extend the tabs array at line 192 from:

```ts
          {(["variance", "ar", "reconciliation"] as const).map((tab) => (
```

to:

```ts
          {(["variance", "ar", "reconciliation", "capital"] as const).map((tab) => (
```

Extend the label ternary at line 206 from:

```ts
              {tab === "variance" ? "Variance / P&L" : tab === "ar" ? "AR / Invoices" : "Reconciliation"}
```

to:

```ts
              {tab === "variance"
                ? "Variance / P&L"
                : tab === "ar"
                  ? "AR / Invoices"
                  : tab === "reconciliation"
                    ? "Reconciliation"
                    : "Regulatory Capital"}
```

Extend the filter logic at lines 61-71 from the current block to:

```ts
  const filteredSources = sources.filter((s) => {
    if (activeTab === "reconciliation") {
      return s.type === "gl" || s.type === "sub_ledger" || s.type === "fx";
    }
    if (activeTab === "capital") {
      return s.type === "capital_components" || s.type === "rwa_breakdown";
    }
    try {
      const meta = typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata;
      return meta?.shape === activeTab;
    } catch {
      return false;
    }
  });
```

Extend the upload-success redirect (`handleUpload`, around lines 112-121) to handle the new shapes. Add a branch after the reconciliation shape block (after line 121):

```ts
        // Capital shapes: redirect to the regulatory-capital page
        if (result.kind === "capital_components" || result.kind === "rwa_breakdown") {
          const kindLabel = result.kind === "capital_components" ? "capital components" : "RWA breakdown";
          setUploadResult(`${kindLabel} uploaded. ${result.dataSource?.recordCount ?? 0} records ingested. Redirecting…`);
          fetchSources();
          setTimeout(() => router.push("/regulatory-capital"), 1500);
          return;
        }
```

Extend the upload-area hint at line 217 from:

```ts
              activeTab === "reconciliation"
                ? "Upload a GL CSV, sub-ledger CSV, or FX-rates CSV — we auto-detect the shape"
                : undefined
```

to:

```ts
              activeTab === "reconciliation"
                ? "Upload a GL CSV, sub-ledger CSV, or FX-rates CSV — we auto-detect the shape"
                : activeTab === "capital"
                  ? "Upload a capital components CSV or RWA breakdown CSV — we auto-detect the shape"
                  : undefined
```

Extend the LinkSheetArea shape prop at lines 151 and 223 from:

```ts
      const shapeForApi = activeTab === "reconciliation" ? "gl" : activeTab;
```

to:

```ts
      const shapeForApi: "variance" | "ar" | "gl" | "capital_components" =
        activeTab === "reconciliation"
          ? "gl"
          : activeTab === "capital"
            ? "capital_components"
            : activeTab;
```

And line 223 from:

```ts
            shape={activeTab === "reconciliation" ? "gl" : activeTab}
```

to:

```ts
            shape={
              activeTab === "reconciliation"
                ? "gl"
                : activeTab === "capital"
                  ? "capital_components"
                  : activeTab
            }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Smoke-test the dev server**

Run (foreground, watch for errors):

```bash
npm run dev
```

Open `http://localhost:3000/data-sources?tab=capital` in a browser. Verify:
- The "Regulatory Capital" tab is visible and selectable.
- Tab hint text reads "Upload a capital components CSV or RWA breakdown CSV — we auto-detect the shape".
- Connected Sources list is empty (no capital data yet).

Kill the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/data-sources/page.tsx" components/data-sources/link-sheet-area.tsx
git commit -m "feat(capital): add Regulatory Capital tab to data-sources"
```

---

## Task 14: End-to-end verification

**Files:** (none modified)

- [ ] **Step 1: Prepare test CSVs**

Save these two files somewhere outside the repo (or under a gitignored path like `tmp/`):

`capital-components.csv`:

```
period,component,amount,currency
2026-Q1,cet1_capital,12400000000,USD
2026-Q1,additional_tier1,1500000000,USD
2026-Q1,tier2,2500000000,USD
2026-Q1,goodwill,800000000,USD
2026-Q1,dta,300000000,USD
2026-Q1,total_rwa,93900000000,USD
```

`rwa-breakdown.csv`:

```
period,risk_type,exposure_class,exposure_amount,risk_weight,rwa
2026-Q1,credit,corporate,50000000000,1.0,50000000000
2026-Q1,credit,retail_mortgage,40000000000,0.5,20000000000
2026-Q1,credit,sovereign,15000000000,0.0,0
2026-Q1,market,trading_book,18200000000,0.5,9100000000
2026-Q1,operational,business_lines,0,0,6800000000
```

- [ ] **Step 2: Run through the flow in a browser**

Start dev server:

```bash
npm run dev
```

Steps:
1. Sign in as the demo user.
2. Go to `/data-sources`, click the **Regulatory Capital** tab.
3. Upload `capital-components.csv`. Verify the success message; verify redirect to `/regulatory-capital`.
4. On `/regulatory-capital`, verify:
   - Three real ratio cards: CET1 ≈ 12.06% (green), Tier 1 ≈ 13.66% (green), Total ≈ 16.29% (green).
     - (12,400 − 800 − 300) / 93,900 = 11,300 / 93,900 ≈ 12.03% CET1.
   - Period picker shows `2026-Q1`.
   - Breaches section shows one row: "No RWA breakdown uploaded for 2026-Q1" with an Upload link.
   - RWA breakdown table is hidden. A small "Upload an RWA breakdown…" hint is visible.
5. Go back to `/data-sources?tab=capital`, upload `rwa-breakdown.csv`. Verify redirect.
6. On `/regulatory-capital`, verify:
   - Breaches section is now empty or shows only an RWA mismatch warning (depending on whether 93.9B vs 85.9B diverges by > 1% — it does, so a mismatch row should appear).
   - RWA breakdown table is visible with three rows (credit / market / operational).
7. Click the **Ask AI** button on the CET1 card. Verify the chat side-panel opens with the CET1 prompt pre-filled.

- [ ] **Step 3: Kill the dev server**

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit (if any cleanup needed)**

If the e2e walkthrough surfaced any bugs, fix them and commit. If everything passed, no commit needed; this is a verification checkpoint.

---

## Spec-coverage summary

Cross-checking the plan against the spec:

- **Prisma schema (four new models)** — Task 1 ✓
- **`lib/capital/minimums.ts`** — Task 2 ✓
- **`lib/capital/period.ts`** — Task 3 ✓
- **`lib/csv/capital-parser.ts`** — Task 4 ✓
- **`lib/csv/detect-shape.ts` extension** — Task 5 ✓
- **`lib/capital/stats.ts` (compute + getCapitalSnapshot + getRwaBreakdown + getCapitalBreaches)** — Task 6 ✓
- **`lib/capital/persist.ts` (ingest + recomputeSnapshot)** — Task 7 ✓
- **`lib/capital/index.ts` barrel + periods API** — Task 8 ✓
- **Upload route extension** — Task 9 ✓
- **`lib/agent/journey-context/regulatory-capital.ts` + registration** — Task 10 ✓
- **Period-picker + ExplainButton components** — Task 11 ✓
- **Page rewrite** — Task 12 ✓
- **Data-sources tab** — Task 13 ✓
- **End-to-end verification** — Task 14 ✓

**Spec sections NOT requiring plan tasks** (already a no-op):
- Chat/actions API registration: confirmed `journeyId` passes through `/api/chat` unchanged with no allowlist; `/api/actions` does not use `journeyId`. No code change.
- Agent tools (the spec explicitly says none for B-phase).

**Open questions from the spec that resolve in the plan:**
- **Sign convention for deductions** — Parser rejects negatives with a skipped-row note (Task 4), stats adds deductions with explicit subtraction (Task 6). If a bank's export uses negative deductions, we'll need to detect + normalize; covered by the skipped-row list for user visibility.
- **Ratio decimals vs percentages** — Persisted as decimals (Task 1 schema, Task 6 compute), formatted as `(x * 100).toFixed(...)` at every display boundary (Task 10 context builder, Task 12 page, Task 14 e2e expectations).
- **CET1 trend nudge** — Plan does NOT extend the context builder to include prior-period snapshots. This is consciously out of scope for the B-phase. If the user asks about trends in practice and the agent can't answer well, a small follow-up would add recent snapshots to `buildCapitalContext`.
- **Currency** — Single-currency assumption stands. Parser accepts a currency column but ignores it in aggregation. Explicit multi-currency normalization is out of scope.
