# Financial Reconciliation Pilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an end-to-end agentic Financial Reconciliation journey: GL + sub-ledger ingestion with FX, multi-strategy matching, break ageing, agent tools + skill, adjustment writeback, auto-escalation to the Actions feed, and live widgets on `/financial-reconciliation`.

**Architecture:** Pure library (`lib/reconciliation/`) holds all matching/ageing/FX math with zero Prisma. A thin adapter (`persist.ts`) owns all writes. The upload handler calls the adapter synchronously after ingest so the page lights up. Agent tools wrap the same adapter. Live widgets read from server helpers. Everything is user-scoped through `DataSource`.

**Tech Stack:** Next.js 16 App Router (Turbopack), Prisma 6 + Postgres, Vitest, `gitclaw` SDK for agent tools/skills, Recharts + local `DonutChart` for widgets.

**Source spec:** `docs/superpowers/specs/2026-04-16-agentic-journeys-reconciliation-pilot-design.md`

---

## File structure at a glance

```
prisma/
  schema.prisma                         # +8 models, +2 User relations
  migrations/<ts>_reconciliation/…      # generated

lib/reconciliation/
  types.ts                              # all public types
  fx.ts                                 # convert(), loadRates()
  ageing.ts                             # ageBucket(), severity()
  strategies/
    exact.ts                            # reference equality
    tolerance.ts                        # amount±δ, date±d, counterparty
    fuzzy.ts                            # Jaro-Winkler memo + amount proximity
  match-engine.ts                       # runMatchRun() orchestrator
  persist.ts                            # Prisma adapter (saveMatchRun, etc.)
  escalation.ts                         # break → Action auto-create
  stats.ts                              # server page helpers
  index.ts                              # barrel export
  __tests__/fx.test.ts
  __tests__/ageing.test.ts
  __tests__/strategies/exact.test.ts
  __tests__/strategies/tolerance.test.ts
  __tests__/strategies/fuzzy.test.ts
  __tests__/match-engine.test.ts
  __tests__/persist.test.ts

lib/csv/
  gl-parser.ts                          # CSV → GLEntryInput[]
  sub-ledger-parser.ts                  # CSV → SubLedgerEntryInput[]
  fx-rates-parser.ts                    # CSV → FXRateInput[]
  detect-shape.ts                       # +"gl" and "sub_ledger" shapes

lib/agent/
  tools/reconciliation.ts               # createReconciliationTools(userId)
  index.ts                              # register reconciliation tools

lib/seed/
  reconciliation.ts                     # load sample CSVs into a user

public/samples/
  sample-gl.csv
  sample-sub-ledger.csv
  sample-fx-rates.csv

agent/skills/financial-reconciliation/SKILL.md
agent/workflows/financial-reconciliation.yaml
agent/knowledge/reconciliation-thresholds.md
agent/knowledge/index.yaml              # register thresholds

app/api/upload/route.ts                 # handle gl/sub_ledger shapes + auto-match
app/api/seed-demo/route.ts              # accept scenario: "variance" | "reconciliation"
app/(shell)/financial-reconciliation/page.tsx  # async server component
```

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_reconciliation/migration.sql` (generated)

- [ ] **Step 1: Append the 8 new models to `prisma/schema.prisma`**

Paste this at the bottom of the file:

```prisma
model GLEntry {
  id           String   @id @default(cuid())
  dataSourceId String
  entryDate    DateTime
  postingDate  DateTime
  account      String
  reference    String
  memo         String?
  amount       Float
  txnCurrency  String
  baseAmount   Float
  debitCredit  String
  counterparty String?
  matchStatus  String   @default("unmatched")
  createdAt    DateTime @default(now())

  dataSource DataSource  @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)
  matches    MatchLink[]

  @@index([dataSourceId, matchStatus])
  @@index([reference])
}

model SubLedgerEntry {
  id           String   @id @default(cuid())
  dataSourceId String
  sourceModule String
  entryDate    DateTime
  account      String
  reference    String
  memo         String?
  amount       Float
  txnCurrency  String
  baseAmount   Float
  counterparty String?
  matchStatus  String   @default("unmatched")
  createdAt    DateTime @default(now())

  dataSource DataSource  @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)
  matches    MatchLink[]

  @@index([dataSourceId, matchStatus])
  @@index([reference])
}

model MatchRun {
  id             String    @id @default(cuid())
  userId         String
  triggeredBy    String
  strategyConfig Json
  totalGL        Int
  totalSub       Int
  matched        Int
  partial        Int
  unmatched      Int
  startedAt      DateTime  @default(now())
  completedAt    DateTime?

  user   User        @relation(fields: [userId], references: [id])
  links  MatchLink[]
  breaks Break[]

  @@index([userId, startedAt])
}

model MatchLink {
  id          String @id @default(cuid())
  matchRunId  String
  glEntryId   String
  subEntryId  String
  strategy    String
  confidence  Float
  amountDelta Float
  dateDelta   Int

  matchRun MatchRun       @relation(fields: [matchRunId], references: [id], onDelete: Cascade)
  glEntry  GLEntry        @relation(fields: [glEntryId], references: [id], onDelete: Cascade)
  subEntry SubLedgerEntry @relation(fields: [subEntryId], references: [id], onDelete: Cascade)

  @@index([matchRunId])
}

model Break {
  id          String  @id @default(cuid())
  matchRunId  String
  side        String
  entryId     String
  amount      Float
  baseAmount  Float
  txnCurrency String
  ageDays     Int
  ageBucket   String
  severity    String
  status      String  @default("open")
  actionId    String?

  matchRun  MatchRun             @relation(fields: [matchRunId], references: [id], onDelete: Cascade)
  proposals AdjustmentProposal[]

  @@index([matchRunId, status])
  @@index([ageBucket, severity])
}

model AdjustmentProposal {
  id              String   @id @default(cuid())
  breakId         String
  proposedBy      String
  description     String
  debitAccount    String
  creditAccount   String
  amount          Float
  baseAmount      Float
  currency        String
  journalDate     DateTime
  status          String   @default("pending")
  approvedBy      String?
  approvedAt      DateTime?
  postedJournalId String?
  createdAt       DateTime @default(now())

  break Break @relation(fields: [breakId], references: [id], onDelete: Cascade)

  @@index([breakId])
}

model JournalAdjustment {
  id         String   @id @default(cuid())
  userId     String
  proposalId String   @unique
  entryDate  DateTime
  lines      Json
  postedAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

model FXRate {
  id           String   @id @default(cuid())
  fromCurrency String
  toCurrency   String
  rate         Float
  asOf         DateTime

  @@unique([fromCurrency, toCurrency, asOf])
  @@index([asOf])
}
```

- [ ] **Step 2: Add reciprocal relations on `User` and `DataSource`**

In the existing `User` model, inside the block, add these lines next to the other relations:

```prisma
  matchRuns          MatchRun[]
  journalAdjustments JournalAdjustment[]
```

In the existing `DataSource` model, inside the block, add these lines next to the other relations:

```prisma
  glEntries       GLEntry[]
  subLedgerEntries SubLedgerEntry[]
```

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Generate migration**

Run: `npx prisma migrate dev --name reconciliation`
Expected: creates `prisma/migrations/<timestamp>_reconciliation/migration.sql`, applies it, regenerates the client.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add reconciliation models (GL/SubLedger/MatchRun/Break/Adjustment/FX)"
```

---

## Task 2: Shared types module

**Files:**
- Create: `lib/reconciliation/types.ts`

- [ ] **Step 1: Write `lib/reconciliation/types.ts`**

```ts
export type Strategy = "exact" | "tolerance" | "fuzzy";

export type Side = "gl_only" | "sub_only";

export type AgeBucket = "0-30" | "31-60" | "60+";

export type Severity = "low" | "medium" | "high";

export type StrategyConfig = {
  exact: boolean;
  tolerance: {
    enabled: boolean;
    amount: number;
    daysPlus: number;
    daysMinus: number;
  };
  fuzzy: {
    enabled: boolean;
    threshold: number;
  };
};

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  exact: true,
  tolerance: { enabled: true, amount: 1.0, daysPlus: 2, daysMinus: 2 },
  fuzzy: { enabled: true, threshold: 0.85 },
};

export type GLEntryInput = {
  id: string;
  entryDate: Date;
  postingDate: Date;
  account: string;
  reference: string;
  memo?: string;
  amount: number;
  txnCurrency: string;
  baseAmount: number;
  debitCredit: "DR" | "CR";
  counterparty?: string;
};

export type SubLedgerEntryInput = {
  id: string;
  sourceModule: "AP" | "AR" | "FA";
  entryDate: Date;
  account: string;
  reference: string;
  memo?: string;
  amount: number;
  txnCurrency: string;
  baseAmount: number;
  counterparty?: string;
};

export type MatchLinkResult = {
  glId: string;
  subId: string;
  strategy: Strategy;
  confidence: number;
  amountDelta: number;
  dateDelta: number;
  partial: boolean;
};

export type BreakResult = {
  side: Side;
  entryId: string;
};

export type MatchStats = {
  totalGL: number;
  totalSub: number;
  matched: number;
  partial: number;
  unmatched: number;
};

export type MatchResult = {
  links: MatchLinkResult[];
  breaks: BreakResult[];
  stats: MatchStats;
};

export type FXRateInput = {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  asOf: Date;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/reconciliation/types.ts
git commit -m "feat(reconciliation): shared types and default strategy config"
```

---

## Task 3: FX conversion library (TDD)

**Files:**
- Create: `lib/reconciliation/fx.ts`
- Create: `lib/reconciliation/__tests__/fx.test.ts`

- [ ] **Step 1: Write failing tests `lib/reconciliation/__tests__/fx.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { convert } from "../fx";
import type { FXRateInput } from "../types";

const RATES: FXRateInput[] = [
  { fromCurrency: "EUR", toCurrency: "USD", rate: 1.1, asOf: new Date("2026-01-01") },
  { fromCurrency: "EUR", toCurrency: "USD", rate: 1.08, asOf: new Date("2026-03-01") },
  { fromCurrency: "GBP", toCurrency: "USD", rate: 1.25, asOf: new Date("2026-01-01") },
];

describe("convert", () => {
  it("returns the same amount when fromCurrency === toCurrency", () => {
    expect(convert(100, "USD", "USD", new Date("2026-02-01"), RATES)).toBe(100);
  });

  it("converts EUR→USD using the nearest earlier rate", () => {
    expect(convert(100, "EUR", "USD", new Date("2026-02-01"), RATES)).toBeCloseTo(110);
    expect(convert(100, "EUR", "USD", new Date("2026-03-15"), RATES)).toBeCloseTo(108);
  });

  it("throws when no rate exists on or before asOf", () => {
    expect(() => convert(100, "EUR", "USD", new Date("2025-12-01"), RATES))
      .toThrow(/no FX rate/i);
  });

  it("throws when currency pair is unknown", () => {
    expect(() => convert(100, "JPY", "USD", new Date("2026-02-01"), RATES))
      .toThrow(/no FX rate/i);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/fx.test.ts`
Expected: FAIL — cannot find module `../fx`.

- [ ] **Step 3: Implement `lib/reconciliation/fx.ts`**

```ts
import type { FXRateInput } from "./types";

export function convert(
  amount: number,
  from: string,
  to: string,
  asOf: Date,
  rates: FXRateInput[]
): number {
  if (from === to) return amount;

  const candidates = rates
    .filter((r) => r.fromCurrency === from && r.toCurrency === to && r.asOf <= asOf)
    .sort((a, b) => b.asOf.getTime() - a.asOf.getTime());

  if (candidates.length === 0) {
    throw new Error(`no FX rate for ${from}→${to} on or before ${asOf.toISOString()}`);
  }

  return amount * candidates[0].rate;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run lib/reconciliation/__tests__/fx.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/fx.ts lib/reconciliation/__tests__/fx.test.ts
git commit -m "feat(reconciliation): FX conversion with nearest-earlier rate lookup"
```

---

## Task 4: Ageing library (TDD)

**Files:**
- Create: `lib/reconciliation/ageing.ts`
- Create: `lib/reconciliation/__tests__/ageing.test.ts`

- [ ] **Step 1: Write failing tests `lib/reconciliation/__tests__/ageing.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ageDays, ageBucket, severity } from "../ageing";

const today = new Date("2026-04-16");

describe("ageDays", () => {
  it("returns whole-day difference", () => {
    expect(ageDays(new Date("2026-04-01"), today)).toBe(15);
    expect(ageDays(today, today)).toBe(0);
  });
});

describe("ageBucket", () => {
  it("classifies boundaries correctly", () => {
    expect(ageBucket(0)).toBe("0-30");
    expect(ageBucket(30)).toBe("0-30");
    expect(ageBucket(31)).toBe("31-60");
    expect(ageBucket(60)).toBe("31-60");
    expect(ageBucket(61)).toBe("60+");
  });
});

describe("severity", () => {
  it("is high when age > 60 OR |amount| > 10000", () => {
    expect(severity(61, 100)).toBe("high");
    expect(severity(5, 20000)).toBe("high");
    expect(severity(100, 15000)).toBe("high");
  });
  it("is medium when age > 30 OR |amount| > 1000 (and not high)", () => {
    expect(severity(31, 100)).toBe("medium");
    expect(severity(5, 5000)).toBe("medium");
  });
  it("is low otherwise", () => {
    expect(severity(10, 500)).toBe("low");
    expect(severity(0, 0)).toBe("low");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/ageing.test.ts`
Expected: FAIL — cannot find module `../ageing`.

- [ ] **Step 3: Implement `lib/reconciliation/ageing.ts`**

```ts
import type { AgeBucket, Severity } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageDays(entryDate: Date, today: Date): number {
  return Math.floor((today.getTime() - entryDate.getTime()) / DAY_MS);
}

export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export function severity(days: number, baseAmount: number): Severity {
  const abs = Math.abs(baseAmount);
  if (days > 60 || abs > 10_000) return "high";
  if (days > 30 || abs > 1_000) return "medium";
  return "low";
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run lib/reconciliation/__tests__/ageing.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/ageing.ts lib/reconciliation/__tests__/ageing.test.ts
git commit -m "feat(reconciliation): age buckets and severity thresholds"
```

---

## Task 5: Exact-match strategy (TDD)

**Files:**
- Create: `lib/reconciliation/strategies/exact.ts`
- Create: `lib/reconciliation/__tests__/strategies/exact.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { exactMatch } from "../../strategies/exact";
import type { GLEntryInput, SubLedgerEntryInput } from "../../types";

function gl(id: string, reference: string, baseAmount: number): GLEntryInput {
  return {
    id, reference, baseAmount,
    entryDate: new Date("2026-04-01"),
    postingDate: new Date("2026-04-01"),
    account: "2100-AP",
    amount: baseAmount, txnCurrency: "USD",
    debitCredit: "DR",
  };
}

function sub(id: string, reference: string, baseAmount: number): SubLedgerEntryInput {
  return {
    id, reference, baseAmount,
    sourceModule: "AP",
    entryDate: new Date("2026-04-01"),
    account: "2100-AP",
    amount: baseAmount, txnCurrency: "USD",
  };
}

describe("exactMatch", () => {
  it("links entries sharing the same reference", () => {
    const gls = [gl("g1", "INV-001", 100), gl("g2", "INV-002", 200)];
    const subs = [sub("s1", "INV-001", 100), sub("s2", "INV-002", 200)];
    const { links, residualGL, residualSub } = exactMatch(gls, subs);
    expect(links).toHaveLength(2);
    expect(residualGL).toHaveLength(0);
    expect(residualSub).toHaveLength(0);
    expect(links[0]).toMatchObject({
      strategy: "exact", confidence: 1, amountDelta: 0, dateDelta: 0, partial: false,
    });
  });

  it("returns residuals for non-matching entries", () => {
    const gls = [gl("g1", "INV-001", 100)];
    const subs = [sub("s1", "INV-999", 100)];
    const { links, residualGL, residualSub } = exactMatch(gls, subs);
    expect(links).toHaveLength(0);
    expect(residualGL.map((e) => e.id)).toEqual(["g1"]);
    expect(residualSub.map((e) => e.id)).toEqual(["s1"]);
  });

  it("is one-to-one when multiple subs share a reference (first wins)", () => {
    const gls = [gl("g1", "INV-001", 100)];
    const subs = [sub("s1", "INV-001", 100), sub("s2", "INV-001", 100)];
    const { links, residualSub } = exactMatch(gls, subs);
    expect(links).toHaveLength(1);
    expect(residualSub.map((e) => e.id)).toEqual(["s2"]);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/strategies/exact.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `lib/reconciliation/strategies/exact.ts`**

```ts
import type { GLEntryInput, SubLedgerEntryInput, MatchLinkResult } from "../types";

export function exactMatch(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[]
): {
  links: MatchLinkResult[];
  residualGL: GLEntryInput[];
  residualSub: SubLedgerEntryInput[];
} {
  const subByRef = new Map<string, SubLedgerEntryInput[]>();
  for (const s of sub) {
    const arr = subByRef.get(s.reference) ?? [];
    arr.push(s);
    subByRef.set(s.reference, arr);
  }

  const links: MatchLinkResult[] = [];
  const matchedSubIds = new Set<string>();
  const residualGL: GLEntryInput[] = [];

  for (const g of gl) {
    const candidates = subByRef.get(g.reference);
    const pick = candidates?.find((s) => !matchedSubIds.has(s.id));
    if (pick) {
      matchedSubIds.add(pick.id);
      links.push({
        glId: g.id,
        subId: pick.id,
        strategy: "exact",
        confidence: 1,
        amountDelta: pick.baseAmount - g.baseAmount,
        dateDelta: Math.floor(
          (pick.entryDate.getTime() - g.entryDate.getTime()) / 86_400_000
        ),
        partial: false,
      });
    } else {
      residualGL.push(g);
    }
  }

  const residualSub = sub.filter((s) => !matchedSubIds.has(s.id));
  return { links, residualGL, residualSub };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run lib/reconciliation/__tests__/strategies/exact.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/strategies/exact.ts lib/reconciliation/__tests__/strategies/exact.test.ts
git commit -m "feat(reconciliation): exact-reference match strategy"
```

---

## Task 6: Tolerance-match strategy (TDD)

**Files:**
- Create: `lib/reconciliation/strategies/tolerance.ts`
- Create: `lib/reconciliation/__tests__/strategies/tolerance.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/strategies/tolerance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/reconciliation/strategies/tolerance.ts`**

```ts
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  MatchLinkResult,
  StrategyConfig,
} from "../types";

const DAY_MS = 86_400_000;

export function toleranceMatch(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  cfg: StrategyConfig["tolerance"]
): {
  links: MatchLinkResult[];
  residualGL: GLEntryInput[];
  residualSub: SubLedgerEntryInput[];
} {
  if (!cfg.enabled) {
    return { links: [], residualGL: gl, residualSub: sub };
  }

  const links: MatchLinkResult[] = [];
  const usedSub = new Set<string>();
  const residualGL: GLEntryInput[] = [];

  for (const g of gl) {
    let best: { s: SubLedgerEntryInput; amountDelta: number; dateDelta: number } | null = null;

    for (const s of sub) {
      if (usedSub.has(s.id)) continue;
      if ((g.counterparty ?? "") !== (s.counterparty ?? "")) continue;

      const amountDelta = s.baseAmount - g.baseAmount;
      if (Math.abs(amountDelta) > cfg.amount) continue;

      const dateDelta = Math.floor(
        (s.entryDate.getTime() - g.entryDate.getTime()) / DAY_MS
      );
      if (dateDelta > cfg.daysPlus || dateDelta < -cfg.daysMinus) continue;

      if (
        !best ||
        Math.abs(amountDelta) + Math.abs(dateDelta) <
          Math.abs(best.amountDelta) + Math.abs(best.dateDelta)
      ) {
        best = { s, amountDelta, dateDelta };
      }
    }

    if (best) {
      usedSub.add(best.s.id);
      const maxDays = Math.max(cfg.daysPlus, cfg.daysMinus, 1);
      const confidence =
        1 -
        (Math.abs(best.amountDelta) / Math.max(cfg.amount, 0.0001) +
          Math.abs(best.dateDelta) / maxDays) /
          2;
      links.push({
        glId: g.id,
        subId: best.s.id,
        strategy: "tolerance",
        confidence: Math.max(0, Math.min(1, confidence)),
        amountDelta: best.amountDelta,
        dateDelta: best.dateDelta,
        partial: Math.abs(best.amountDelta) > 0.0001,
      });
    } else {
      residualGL.push(g);
    }
  }

  const residualSub = sub.filter((s) => !usedSub.has(s.id));
  return { links, residualGL, residualSub };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/reconciliation/__tests__/strategies/tolerance.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/strategies/tolerance.ts lib/reconciliation/__tests__/strategies/tolerance.test.ts
git commit -m "feat(reconciliation): tolerance match strategy with amount/date/counterparty gates"
```

---

## Task 7: Fuzzy-match strategy (TDD)

**Files:**
- Create: `lib/reconciliation/strategies/fuzzy.ts`
- Create: `lib/reconciliation/__tests__/strategies/fuzzy.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/strategies/fuzzy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/reconciliation/strategies/fuzzy.ts`**

```ts
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  MatchLinkResult,
  StrategyConfig,
} from "../types";

export function jaroWinkler(s1: string, s2: string): number {
  const a = (s1 || "").toLowerCase();
  const b = (s2 || "").toLowerCase();
  if (a === b) return a.length === 0 ? 0 : 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions = transpositions / 2;

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

const DAY_MS = 86_400_000;

export function fuzzyMatch(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  cfg: StrategyConfig["fuzzy"]
): {
  links: MatchLinkResult[];
  residualGL: GLEntryInput[];
  residualSub: SubLedgerEntryInput[];
} {
  if (!cfg.enabled) {
    return { links: [], residualGL: gl, residualSub: sub };
  }

  const links: MatchLinkResult[] = [];
  const usedSub = new Set<string>();
  const residualGL: GLEntryInput[] = [];

  for (const g of gl) {
    let best: {
      s: SubLedgerEntryInput;
      memoSim: number;
      amountProx: number;
      confidence: number;
    } | null = null;

    for (const s of sub) {
      if (usedSub.has(s.id)) continue;
      const biggest = Math.max(Math.abs(g.baseAmount), Math.abs(s.baseAmount));
      if (biggest === 0) continue;
      const amountProx = 1 - Math.abs(s.baseAmount - g.baseAmount) / biggest;
      if (amountProx < 0.95) continue;

      const memoSim = jaroWinkler(g.memo ?? "", s.memo ?? "");
      if (memoSim < cfg.threshold) continue;

      const confidence = memoSim * 0.7 + amountProx * 0.3;
      if (!best || confidence > best.confidence) {
        best = { s, memoSim, amountProx, confidence };
      }
    }

    if (best) {
      usedSub.add(best.s.id);
      links.push({
        glId: g.id,
        subId: best.s.id,
        strategy: "fuzzy",
        confidence: best.confidence,
        amountDelta: best.s.baseAmount - g.baseAmount,
        dateDelta: Math.floor(
          (best.s.entryDate.getTime() - g.entryDate.getTime()) / DAY_MS
        ),
        partial: Math.abs(best.s.baseAmount - g.baseAmount) > 0.0001,
      });
    } else {
      residualGL.push(g);
    }
  }

  const residualSub = sub.filter((s) => !usedSub.has(s.id));
  return { links, residualGL, residualSub };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/reconciliation/__tests__/strategies/fuzzy.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/strategies/fuzzy.ts lib/reconciliation/__tests__/strategies/fuzzy.test.ts
git commit -m "feat(reconciliation): fuzzy match using Jaro-Winkler on memo + amount proximity"
```

---

## Task 8: Match engine orchestrator (TDD)

**Files:**
- Create: `lib/reconciliation/match-engine.ts`
- Create: `lib/reconciliation/__tests__/match-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { runMatchRun } from "../match-engine";
import { DEFAULT_STRATEGY_CONFIG } from "../types";
import type { GLEntryInput, SubLedgerEntryInput } from "../types";

function gl(
  id: string, ref: string, amount: number, date: string,
  memo = "", counterparty: string | undefined = "Acme"
): GLEntryInput {
  return {
    id, reference: ref,
    entryDate: new Date(date), postingDate: new Date(date),
    account: "2100", memo, amount, txnCurrency: "USD", baseAmount: amount,
    debitCredit: "DR", counterparty,
  };
}
function sub(
  id: string, ref: string, amount: number, date: string,
  memo = "", counterparty: string | undefined = "Acme"
): SubLedgerEntryInput {
  return {
    id, reference: ref, sourceModule: "AP",
    entryDate: new Date(date), account: "2100", memo,
    amount, txnCurrency: "USD", baseAmount: amount, counterparty,
  };
}

describe("runMatchRun", () => {
  it("matches exact first, then tolerance, then fuzzy; no double-matching", () => {
    // g3/s3 share amount+date but have different counterparties so tolerance
    // skips (gate) and fuzzy wins on memo similarity.
    const gls = [
      gl("g1", "INV-001", 100, "2026-04-01"),                            // exact
      gl("g2", "INV-002", 200.5, "2026-04-01"),                          // tolerance (amount)
      gl("g3", "INV-003", 300, "2026-04-01", "Acme pmt", "AcmeCo"),      // fuzzy
      gl("g4", "INV-004", 400, "2026-04-01"),                            // gl-only
    ];
    const subs = [
      sub("s1", "INV-001", 100, "2026-04-01"),
      sub("s2", "INV-OTHER", 200, "2026-04-02"),
      sub("s3", "INV-OTHER2", 300, "2026-04-01", "Acme payment", "Acme, Inc."),
      sub("s5", "INV-999", 999, "2026-04-01"),                           // sub-only
    ];
    const res = runMatchRun(gls, subs, DEFAULT_STRATEGY_CONFIG);

    expect(res.links.find((l) => l.strategy === "exact")?.glId).toBe("g1");
    expect(res.links.find((l) => l.strategy === "tolerance")?.glId).toBe("g2");
    expect(res.links.find((l) => l.strategy === "fuzzy")?.glId).toBe("g3");
    expect(res.links).toHaveLength(3);

    expect(res.breaks).toContainEqual({ side: "gl_only", entryId: "g4" });
    expect(res.breaks).toContainEqual({ side: "sub_only", entryId: "s5" });
    expect(res.breaks).toHaveLength(2);

    expect(res.stats).toEqual({ totalGL: 4, totalSub: 4, matched: 2, partial: 1, unmatched: 2 });
  });

  it("honours disabled strategies", () => {
    const gls = [gl("g1", "INV-001", 100, "2026-04-01")];
    const subs = [sub("s1", "INV-001", 100, "2026-04-01")];
    const res = runMatchRun(gls, subs, {
      exact: false,
      tolerance: { enabled: false, amount: 1, daysPlus: 2, daysMinus: 2 },
      fuzzy: { enabled: false, threshold: 0.85 },
    });
    expect(res.links).toHaveLength(0);
    expect(res.breaks).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/match-engine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/reconciliation/match-engine.ts`**

```ts
import { exactMatch } from "./strategies/exact";
import { toleranceMatch } from "./strategies/tolerance";
import { fuzzyMatch } from "./strategies/fuzzy";
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  StrategyConfig,
  MatchResult,
  MatchLinkResult,
  BreakResult,
} from "./types";

export function runMatchRun(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  config: StrategyConfig
): MatchResult {
  const totalGL = gl.length;
  const totalSub = sub.length;

  let residualGL = gl;
  let residualSub = sub;
  const links: MatchLinkResult[] = [];

  if (config.exact) {
    const r = exactMatch(residualGL, residualSub);
    links.push(...r.links);
    residualGL = r.residualGL;
    residualSub = r.residualSub;
  }

  if (config.tolerance.enabled) {
    const r = toleranceMatch(residualGL, residualSub, config.tolerance);
    links.push(...r.links);
    residualGL = r.residualGL;
    residualSub = r.residualSub;
  }

  if (config.fuzzy.enabled) {
    const r = fuzzyMatch(residualGL, residualSub, config.fuzzy);
    links.push(...r.links);
    residualGL = r.residualGL;
    residualSub = r.residualSub;
  }

  const breaks: BreakResult[] = [
    ...residualGL.map((e) => ({ side: "gl_only" as const, entryId: e.id })),
    ...residualSub.map((e) => ({ side: "sub_only" as const, entryId: e.id })),
  ];

  const matched = links.filter((l) => !l.partial).length;
  const partial = links.filter((l) => l.partial).length;

  return {
    links,
    breaks,
    stats: {
      totalGL,
      totalSub,
      matched,
      partial,
      unmatched: breaks.length,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/reconciliation/__tests__/match-engine.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Add barrel export `lib/reconciliation/index.ts`**

```ts
export * from "./types";
export * from "./fx";
export * from "./ageing";
export { runMatchRun } from "./match-engine";
```

- [ ] **Step 6: Run full library test suite**

Run: `npx vitest run lib/reconciliation`
Expected: all tests from tasks 3-8 pass.

- [ ] **Step 7: Commit**

```bash
git add lib/reconciliation/match-engine.ts lib/reconciliation/__tests__/match-engine.test.ts lib/reconciliation/index.ts
git commit -m "feat(reconciliation): match engine orchestrator with strategy ordering + stats"
```

---

## Task 9: Prisma adapter — persist layer

**Files:**
- Create: `lib/reconciliation/persist.ts`
- Create: `lib/reconciliation/__tests__/persist.test.ts`

This layer owns every write: creates `MatchRun`, `MatchLink`, `Break` rows; flips `matchStatus` on entries; computes ageing for each break. It does NOT escalate to `Action` — that is Task 13.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { saveMatchRun, loadLedgerEntries } from "../persist";
import { DEFAULT_STRATEGY_CONFIG } from "../types";

describe("persist layer", () => {
  let userId = "";
  let glDsId = "";
  let subDsId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    const glDs = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    const subDs = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "test-sub.csv", status: "ready" },
    });
    glDsId = glDs.id;
    subDsId = subDs.id;

    await prisma.gLEntry.create({
      data: {
        dataSourceId: glDsId,
        entryDate: new Date("2026-04-01"), postingDate: new Date("2026-04-01"),
        account: "2100", reference: "INV-001",
        amount: 100, txnCurrency: "USD", baseAmount: 100,
        debitCredit: "DR", counterparty: "Acme",
      },
    });
    await prisma.subLedgerEntry.create({
      data: {
        dataSourceId: subDsId, sourceModule: "AP",
        entryDate: new Date("2026-04-01"),
        account: "2100", reference: "INV-001",
        amount: 100, txnCurrency: "USD", baseAmount: 100, counterparty: "Acme",
      },
    });
    await prisma.gLEntry.create({
      data: {
        dataSourceId: glDsId,
        entryDate: new Date("2026-01-01"), postingDate: new Date("2026-01-01"),
        account: "2100", reference: "INV-OLD",
        amount: 20000, txnCurrency: "USD", baseAmount: 20000,
        debitCredit: "DR", counterparty: "OldVendor",
      },
    });
  });

  it("loadLedgerEntries returns inputs for matching", async () => {
    const { gl, sub } = await loadLedgerEntries(userId);
    expect(gl).toHaveLength(2);
    expect(sub).toHaveLength(1);
    expect(gl[0].baseAmount).toBe(100);
  });

  it("saveMatchRun persists run, links, breaks, and flips entry status", async () => {
    const { gl, sub } = await loadLedgerEntries(userId);
    const runId = await saveMatchRun(userId, gl, sub, DEFAULT_STRATEGY_CONFIG, "manual");

    const run = await prisma.matchRun.findUnique({
      where: { id: runId },
      include: { links: true, breaks: true },
    });
    expect(run?.matched).toBe(1);
    expect(run?.unmatched).toBe(1);
    expect(run?.links).toHaveLength(1);
    expect(run?.breaks).toHaveLength(1);

    const matchedGL = await prisma.gLEntry.findFirst({ where: { reference: "INV-001" } });
    expect(matchedGL?.matchStatus).toBe("matched");

    const breakRow = run?.breaks[0];
    expect(breakRow?.side).toBe("gl_only");
    expect(breakRow?.severity).toBe("high"); // >60d OR >10k
    expect(breakRow?.ageBucket).toBe("60+");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run lib/reconciliation/__tests__/persist.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `lib/reconciliation/persist.ts`**

```ts
import { prisma } from "@/lib/db";
import { runMatchRun } from "./match-engine";
import { ageDays, ageBucket, severity } from "./ageing";
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  StrategyConfig,
} from "./types";

export async function loadLedgerEntries(userId: string): Promise<{
  gl: GLEntryInput[];
  sub: SubLedgerEntryInput[];
}> {
  const gl = await prisma.gLEntry.findMany({
    where: { dataSource: { userId, status: "ready" } },
  });
  const sub = await prisma.subLedgerEntry.findMany({
    where: { dataSource: { userId, status: "ready" } },
  });

  return {
    gl: gl.map((g) => ({
      id: g.id,
      entryDate: g.entryDate,
      postingDate: g.postingDate,
      account: g.account,
      reference: g.reference,
      memo: g.memo ?? undefined,
      amount: g.amount,
      txnCurrency: g.txnCurrency,
      baseAmount: g.baseAmount,
      debitCredit: g.debitCredit as "DR" | "CR",
      counterparty: g.counterparty ?? undefined,
    })),
    sub: sub.map((s) => ({
      id: s.id,
      sourceModule: s.sourceModule as "AP" | "AR" | "FA",
      entryDate: s.entryDate,
      account: s.account,
      reference: s.reference,
      memo: s.memo ?? undefined,
      amount: s.amount,
      txnCurrency: s.txnCurrency,
      baseAmount: s.baseAmount,
      counterparty: s.counterparty ?? undefined,
    })),
  };
}

export async function saveMatchRun(
  userId: string,
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  config: StrategyConfig,
  triggeredBy: "upload" | "agent" | "manual"
): Promise<string> {
  const result = runMatchRun(gl, sub, config);

  const run = await prisma.matchRun.create({
    data: {
      userId,
      triggeredBy,
      strategyConfig: JSON.stringify(config),
      totalGL: result.stats.totalGL,
      totalSub: result.stats.totalSub,
      matched: result.stats.matched,
      partial: result.stats.partial,
      unmatched: result.stats.unmatched,
      completedAt: new Date(),
    },
  });

  if (result.links.length > 0) {
    await prisma.matchLink.createMany({
      data: result.links.map((l) => ({
        matchRunId: run.id,
        glEntryId: l.glId,
        subEntryId: l.subId,
        strategy: l.strategy,
        confidence: l.confidence,
        amountDelta: l.amountDelta,
        dateDelta: l.dateDelta,
      })),
    });

    const matchedGL = result.links.filter((l) => !l.partial).map((l) => l.glId);
    const partialGL = result.links.filter((l) => l.partial).map((l) => l.glId);
    const matchedSub = result.links.filter((l) => !l.partial).map((l) => l.subId);
    const partialSub = result.links.filter((l) => l.partial).map((l) => l.subId);

    if (matchedGL.length > 0) {
      await prisma.gLEntry.updateMany({
        where: { id: { in: matchedGL } },
        data: { matchStatus: "matched" },
      });
    }
    if (partialGL.length > 0) {
      await prisma.gLEntry.updateMany({
        where: { id: { in: partialGL } },
        data: { matchStatus: "partial" },
      });
    }
    if (matchedSub.length > 0) {
      await prisma.subLedgerEntry.updateMany({
        where: { id: { in: matchedSub } },
        data: { matchStatus: "matched" },
      });
    }
    if (partialSub.length > 0) {
      await prisma.subLedgerEntry.updateMany({
        where: { id: { in: partialSub } },
        data: { matchStatus: "partial" },
      });
    }
  }

  if (result.breaks.length > 0) {
    const today = new Date();
    const glMap = new Map(gl.map((e) => [e.id, e]));
    const subMap = new Map(sub.map((e) => [e.id, e]));

    await prisma.break.createMany({
      data: result.breaks.map((b) => {
        const entry =
          b.side === "gl_only" ? glMap.get(b.entryId)! : subMap.get(b.entryId)!;
        const days = ageDays(entry.entryDate, today);
        return {
          matchRunId: run.id,
          side: b.side,
          entryId: b.entryId,
          amount: entry.amount,
          baseAmount: entry.baseAmount,
          txnCurrency: entry.txnCurrency,
          ageDays: days,
          ageBucket: ageBucket(days),
          severity: severity(days, entry.baseAmount),
          status: "open",
        };
      }),
    });
  }

  return run.id;
}

export async function reAgeOpenBreaks(userId: string): Promise<number> {
  const today = new Date();
  const openBreaks = await prisma.break.findMany({
    where: { status: "open", matchRun: { userId } },
  });

  let updated = 0;
  for (const b of openBreaks) {
    const entry =
      b.side === "gl_only"
        ? await prisma.gLEntry.findUnique({ where: { id: b.entryId } })
        : await prisma.subLedgerEntry.findUnique({ where: { id: b.entryId } });
    if (!entry) continue;
    const days = ageDays(entry.entryDate, today);
    await prisma.break.update({
      where: { id: b.id },
      data: {
        ageDays: days,
        ageBucket: ageBucket(days),
        severity: severity(days, entry.baseAmount),
      },
    });
    updated++;
  }
  return updated;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/reconciliation/__tests__/persist.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/persist.ts lib/reconciliation/__tests__/persist.test.ts
git commit -m "feat(reconciliation): Prisma adapter — saveMatchRun + loadLedgerEntries + reAge"
```

---

## Task 10: Sample CSVs + FX seeder

**Files:**
- Create: `public/samples/sample-gl.csv`
- Create: `public/samples/sample-sub-ledger.csv`
- Create: `public/samples/sample-fx-rates.csv`

The three files have 200/200/~270 rows. The content below shows the schema and a representative slice; copy-paste the headers verbatim and generate the bulk rows procedurally while matching the acceptance composition in the spec (§7.2).

- [ ] **Step 1: Create `public/samples/sample-gl.csv`**

Headers (use exactly):

```
entry_date,posting_date,account,reference,memo,amount,currency,debit_credit,counterparty
```

Composition (200 rows):
- Rows 1–160: clean matches. `reference` values `INV-001 … INV-160`, amounts randomised $100–$50,000 USD, dates spread Feb 1–Apr 15 2026, counterparties picked from `{Acme,Beta Ltd,Cirrus Inc,Delta Co,Elm & Co}`.
- Rows 161–165: amount mismatches within tolerance ($0.25–$0.95 delta). References `INV-161`–`INV-165`.
- Rows 166–170: date shifts within tolerance (±1–2 days). References `INV-166`–`INV-170`.
- Rows 171–175: memo mismatches for fuzzy (different reference `FZG-171`–`FZG-175`; memos like "Acme Corp payment 171"). Sub-side memos are "ACME PMT #171".
- Rows 176–185: GL-only breaks. References `INV-176`–`INV-185`, no counterpart on sub side.
- Rows 186–195: references `INV-186`–`INV-195` that the sub side WILL have — but only the sub side. Keep these out of GL so they become sub-only breaks. (Adjust row count accordingly to stay at 200.)
- Rows 196–200: FX entries in EUR and GBP. `amount` in foreign, `currency` EUR or GBP, sub side has matching entries with equivalent base amount.

- [ ] **Step 2: Create `public/samples/sample-sub-ledger.csv`**

Headers:

```
entry_date,account,source_module,reference,memo,amount,currency,counterparty
```

Mirror the GL composition so that:
- Rows 1–160 match GL exactly.
- Rows 161–170 match with tolerance deltas.
- Rows 171–175 have the fuzzy reference variants with similar memos.
- Rows 186–195 are sub-only (no GL counterpart).
- Rows 196–200 match FX entries.

`source_module` cycles through `AP`, `AR`, `FA`.

- [ ] **Step 3: Create `public/samples/sample-fx-rates.csv`**

Headers:

```
from_currency,to_currency,rate,as_of
```

Rows: 90 days of USD/EUR and USD/GBP pairs from 2026-01-16 to 2026-04-15. EUR→USD rates around 1.08–1.12, GBP→USD around 1.24–1.28, varying by ±0.01 day-over-day. Easiest is a script: write a short `tsx` helper under `scripts/gen-fx-rates.ts` that prints the CSV, then pipe into the file.

- [ ] **Step 4: Verify samples parse as CSV**

Run (bash):

```bash
wc -l public/samples/sample-gl.csv public/samples/sample-sub-ledger.csv public/samples/sample-fx-rates.csv
```

Expected: `201 201 181` (or similar; headers counted).

- [ ] **Step 5: Commit**

```bash
git add public/samples/sample-gl.csv public/samples/sample-sub-ledger.csv public/samples/sample-fx-rates.csv
git commit -m "feat(reconciliation): sample GL + sub-ledger + FX rate CSVs for demo"
```

---

## Task 11: CSV parsers (GL, sub-ledger, FX)

**Files:**
- Create: `lib/csv/gl-parser.ts`
- Create: `lib/csv/sub-ledger-parser.ts`
- Create: `lib/csv/fx-rates-parser.ts`
- Modify: `lib/csv/detect-shape.ts`

- [ ] **Step 1: Extend `lib/csv/detect-shape.ts`**

Read the current file, then add two new signatures for `"gl"` and `"sub_ledger"` shapes matching the headers used in Task 10 (`debit_credit` uniquely identifies GL; `source_module` uniquely identifies sub-ledger). Return `"gl" | "sub_ledger" | "variance" | "ar" | "unknown"`. Keep the existing LLM fallback.

- [ ] **Step 2: Implement `lib/csv/gl-parser.ts`**

```ts
import type { GLEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";

type ParsedGL = Omit<GLEntryInput, "id">;

export async function parseGlCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedGL[]; skipped: Array<{ row: number; reason: string }> }> {
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase().trim() === name);
  const iDate = idx("entry_date");
  const iPost = idx("posting_date");
  const iAcc = idx("account");
  const iRef = idx("reference");
  const iMemo = idx("memo");
  const iAmt = idx("amount");
  const iCur = idx("currency");
  const iDC = idx("debit_credit");
  const iCp = idx("counterparty");

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iDC < 0) {
    throw new Error("GL CSV missing required headers");
  }

  const entries: ParsedGL[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = new Date(r[iDate]);
      const postingDate = iPost >= 0 ? new Date(r[iPost]) : entryDate;
      const amount = Number(r[iAmt]);
      const cur = (r[iCur] || "USD").toUpperCase();
      if (!Number.isFinite(amount)) throw new Error(`non-numeric amount`);
      if (isNaN(entryDate.getTime())) throw new Error(`bad entry_date`);

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

- [ ] **Step 3: Implement `lib/csv/sub-ledger-parser.ts`**

Parallel shape to GL but pulls `source_module` and omits `debit_credit`/`posting_date`. Same FX handling.

```ts
import type { SubLedgerEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";

type ParsedSub = Omit<SubLedgerEntryInput, "id">;

export async function parseSubLedgerCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedSub[]; skipped: Array<{ row: number; reason: string }> }> {
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase().trim() === name);
  const iDate = idx("entry_date");
  const iAcc = idx("account");
  const iMod = idx("source_module");
  const iRef = idx("reference");
  const iMemo = idx("memo");
  const iAmt = idx("amount");
  const iCur = idx("currency");
  const iCp = idx("counterparty");

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iMod < 0) {
    throw new Error("Sub-ledger CSV missing required headers");
  }

  const entries: ParsedSub[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = new Date(r[iDate]);
      const amount = Number(r[iAmt]);
      const cur = (r[iCur] || "USD").toUpperCase();
      if (!Number.isFinite(amount)) throw new Error("non-numeric amount");
      if (isNaN(entryDate.getTime())) throw new Error("bad entry_date");

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

- [ ] **Step 4: Implement `lib/csv/fx-rates-parser.ts`**

```ts
import type { FXRateInput } from "@/lib/reconciliation/types";

export function parseFxRatesCsv(headers: string[], rows: string[][]): FXRateInput[] {
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase().trim() === name);
  const iFrom = idx("from_currency");
  const iTo = idx("to_currency");
  const iRate = idx("rate");
  const iAsOf = idx("as_of");
  if (iFrom < 0 || iTo < 0 || iRate < 0 || iAsOf < 0) {
    throw new Error("FX CSV missing required headers");
  }
  const out: FXRateInput[] = [];
  for (const r of rows) {
    const rate = Number(r[iRate]);
    const asOf = new Date(r[iAsOf]);
    if (!Number.isFinite(rate) || isNaN(asOf.getTime())) continue;
    out.push({
      fromCurrency: r[iFrom].toUpperCase(),
      toCurrency: r[iTo].toUpperCase(),
      rate,
      asOf,
    });
  }
  return out;
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/csv/gl-parser.ts lib/csv/sub-ledger-parser.ts lib/csv/fx-rates-parser.ts lib/csv/detect-shape.ts
git commit -m "feat(csv): GL, sub-ledger, and FX parsers with detect-shape entries"
```

---

## Task 12: Upload route integration + auto-match

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `lib/reconciliation/persist.ts` (add `ingestGl`, `ingestSubLedger`, `ingestFxRates` helpers)

- [ ] **Step 1: Add ingest helpers to `lib/reconciliation/persist.ts`**

Append these functions:

```ts
import { parseGlCsv } from "@/lib/csv/gl-parser";
import { parseSubLedgerCsv } from "@/lib/csv/sub-ledger-parser";
import { parseFxRatesCsv } from "@/lib/csv/fx-rates-parser";
import type { FXRateInput } from "./types";

export async function loadFxRates(): Promise<FXRateInput[]> {
  const rows = await prisma.fXRate.findMany();
  return rows.map((r) => ({
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: r.rate,
    asOf: r.asOf,
  }));
}

export async function ingestFxRates(csvHeaders: string[], csvRows: string[][]) {
  const rates = parseFxRatesCsv(csvHeaders, csvRows);
  for (const r of rates) {
    await prisma.fXRate.upsert({
      where: {
        fromCurrency_toCurrency_asOf: {
          fromCurrency: r.fromCurrency,
          toCurrency: r.toCurrency,
          asOf: r.asOf,
        },
      },
      create: r,
      update: { rate: r.rate },
    });
  }
  return rates.length;
}

export async function ingestGl(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
) {
  const rates = await loadFxRates();
  const { entries, skipped } = await parseGlCsv(headers, rows, rates);
  const ds = await prisma.dataSource.create({
    data: {
      userId, type: "gl", name: fileName, status: "processing",
      metadata: JSON.stringify({ headers }),
    },
  });
  if (entries.length > 0) {
    await prisma.gLEntry.createMany({
      data: entries.map((e) => ({ ...e, dataSourceId: ds.id })),
    });
  }
  await prisma.dataSource.update({
    where: { id: ds.id },
    data: { status: "ready", recordCount: entries.length },
  });
  return { dataSource: ds, skipped };
}

export async function ingestSubLedger(
  userId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
) {
  const rates = await loadFxRates();
  const { entries, skipped } = await parseSubLedgerCsv(headers, rows, rates);
  const ds = await prisma.dataSource.create({
    data: {
      userId, type: "sub_ledger", name: fileName, status: "processing",
      metadata: JSON.stringify({ headers }),
    },
  });
  if (entries.length > 0) {
    await prisma.subLedgerEntry.createMany({
      data: entries.map((e) => ({ ...e, dataSourceId: ds.id })),
    });
  }
  await prisma.dataSource.update({
    where: { id: ds.id },
    data: { status: "ready", recordCount: entries.length },
  });
  return { dataSource: ds, skipped };
}

export async function userHasBothLedgers(userId: string): Promise<boolean> {
  const [gl, sub] = await Promise.all([
    prisma.dataSource.count({ where: { userId, type: "gl", status: "ready" } }),
    prisma.dataSource.count({ where: { userId, type: "sub_ledger", status: "ready" } }),
  ]);
  return gl > 0 && sub > 0;
}
```

- [ ] **Step 2: Modify `app/api/upload/route.ts`**

After the existing `shape === "ar"` branch and before the variance branch, insert branches for `"gl"`, `"sub_ledger"`, and `"fx"` shapes. After a successful GL or sub-ledger ingest, check `userHasBothLedgers` and if true, await `saveMatchRun(userId, gl, sub, DEFAULT_STRATEGY_CONFIG, "upload")` with data loaded via `loadLedgerEntries`.

Concrete diff at the dispatch site:

```ts
if (shape === "fx") {
  const count = await ingestFxRates(headers, rows);
  return NextResponse.json({ kind: "fx", ratesLoaded: count });
}
if (shape === "gl") {
  const { dataSource, skipped } = await ingestGl(userId, file.name, headers, rows);
  await maybeAutoMatch(userId);
  return NextResponse.json({ kind: "gl", dataSource, skipped: skipped.length });
}
if (shape === "sub_ledger") {
  const { dataSource, skipped } = await ingestSubLedger(userId, file.name, headers, rows);
  await maybeAutoMatch(userId);
  return NextResponse.json({ kind: "sub_ledger", dataSource, skipped: skipped.length });
}
```

And at the bottom of the file:

```ts
async function maybeAutoMatch(userId: string) {
  const both = await userHasBothLedgers(userId);
  if (!both) return;
  const { gl, sub } = await loadLedgerEntries(userId);
  await saveMatchRun(userId, gl, sub, DEFAULT_STRATEGY_CONFIG, "upload");
}
```

Make sure to add the imports at the top:

```ts
import { DEFAULT_STRATEGY_CONFIG } from "@/lib/reconciliation/types";
import {
  ingestGl,
  ingestSubLedger,
  ingestFxRates,
  loadLedgerEntries,
  saveMatchRun,
  userHasBothLedgers,
} from "@/lib/reconciliation/persist";
```

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm run dev`
In browser or Postman:
- Upload `public/samples/sample-fx-rates.csv` to `/api/upload` — confirm `ratesLoaded` > 0.
- Upload `sample-gl.csv` — confirm `kind: "gl"`.
- Upload `sample-sub-ledger.csv` — confirm `kind: "sub_ledger"` AND that a `MatchRun` row now exists in the DB.

Query: `SELECT * FROM "MatchRun" ORDER BY "startedAt" DESC LIMIT 1;`
Expected: 1 row with `triggeredBy = "upload"`, `matched` populated, `unmatched` populated.

- [ ] **Step 4: Commit**

```bash
git add app/api/upload/route.ts lib/reconciliation/persist.ts
git commit -m "feat(reconciliation): upload route ingests GL/sub-ledger/FX and auto-matches on second upload"
```

---

## Task 13: Escalation — break → Action feed

**Files:**
- Create: `lib/reconciliation/escalation.ts`
- Modify: `lib/reconciliation/persist.ts` (call escalation from `saveMatchRun`)

- [ ] **Step 1: Implement `lib/reconciliation/escalation.ts`**

```ts
import { prisma } from "@/lib/db";

export async function escalateQualifyingBreaks(userId: string, matchRunId: string) {
  const breaks = await prisma.break.findMany({
    where: {
      matchRunId,
      actionId: null,
      status: "open",
      severity: "high",
      ageDays: { gt: 60 },
    },
  });

  for (const b of breaks) {
    const action = await prisma.action.create({
      data: {
        userId,
        type: "reconciliation_break",
        severity: "high",
        headline: `Unresolved break: ${b.side === "gl_only" ? "GL" : "Sub-ledger"} entry`,
        detail: `Age ${b.ageDays}d, ${b.baseAmount.toFixed(2)} ${b.txnCurrency}. Break #${b.id}.`,
        driver: "reconciliation",
        status: "pending",
        sourceDataSourceId: "",
      },
    });

    await prisma.break.update({
      where: { id: b.id },
      data: { actionId: action.id },
    });
  }

  return breaks.length;
}
```

Note: `sourceDataSourceId` on `Action` is required in the current schema — we set it to an empty string here. If that violates a FK, the fix is to make it optional in a follow-up migration. For the pilot, use an empty string and confirm no FK failure.

- [ ] **Step 2: Call escalation from `saveMatchRun`**

At the end of `saveMatchRun` in `lib/reconciliation/persist.ts`, before `return run.id;`:

```ts
const { escalateQualifyingBreaks } = await import("./escalation");
await escalateQualifyingBreaks(userId, run.id);
```

- [ ] **Step 3: Update `persist.test.ts` expectation**

In the second test, after the first `saveMatchRun`, expect the break to have `actionId` set (the INV-OLD break was seeded with old date and high amount to qualify).

Add:

```ts
const br = await prisma.break.findFirst({ where: { matchRunId: runId } });
expect(br?.actionId).not.toBeNull();

const act = await prisma.action.findUnique({ where: { id: br!.actionId! } });
expect(act?.type).toBe("reconciliation_break");
expect(act?.severity).toBe("high");
```

- [ ] **Step 4: Run persist tests**

Run: `npx vitest run lib/reconciliation/__tests__/persist.test.ts`
Expected: 2 passed (with new assertions).

- [ ] **Step 5: Check FK constraint on `Action.sourceDataSourceId`**

Run: `npx prisma studio` or inspect `schema.prisma` — if `Action.sourceDataSourceId` is a required relation with FK, the test will fail. If so: change the field to `String?` + optional relation in a second Prisma migration named `action_source_optional`, regenerate, re-run tests.

- [ ] **Step 6: Commit**

```bash
git add lib/reconciliation/escalation.ts lib/reconciliation/persist.ts lib/reconciliation/__tests__/persist.test.ts
# include prisma/schema.prisma + migration if step 5 needed
git commit -m "feat(reconciliation): auto-escalate >60d high-severity breaks to Actions feed"
```

---

## Task 14: Agent tools — read side

**Files:**
- Create: `lib/agent/tools/reconciliation.ts`

This task only implements the read tools: `search_ledger_entries`, `list_match_runs`, `list_breaks`, `reconciliation_summary`. Write tools come in Task 15.

- [ ] **Step 1: Implement read tools**

```ts
import { tool } from "gitclaw";
import { prisma } from "@/lib/db";

export function createReconciliationTools(userId: string) {
  const searchLedgerEntries = tool(
    "search_ledger_entries",
    "Query GL or sub-ledger entries by side, reference, account, counterparty, or status.",
    {
      type: "object",
      properties: {
        side: { type: "string", enum: ["gl", "sub_ledger"], description: "which ledger to search" },
        reference: { type: "string" },
        account: { type: "string" },
        counterparty: { type: "string" },
        status: { type: "string", description: "matchStatus filter" },
        limit: { type: "number" },
      },
      required: ["side"],
    },
    async (args) => {
      const limit = Math.min(args.limit ?? 25, 50);
      const where: Record<string, unknown> = {
        dataSource: { userId, status: "ready" },
      };
      if (args.reference) where.reference = { contains: args.reference };
      if (args.account) where.account = { contains: args.account };
      if (args.counterparty) where.counterparty = { contains: args.counterparty };
      if (args.status) where.matchStatus = args.status;

      const rows = args.side === "gl"
        ? await prisma.gLEntry.findMany({ where, take: limit })
        : await prisma.subLedgerEntry.findMany({ where, take: limit });

      return {
        text: `Found ${rows.length} ${args.side} entries.`,
        details: { count: rows.length, rows },
      };
    }
  );

  const listMatchRuns = tool(
    "list_match_runs",
    "Return recent reconciliation match runs with their stats.",
    {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
    async (args) => {
      const runs = await prisma.matchRun.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: Math.min(args.limit ?? 10, 25),
      });
      return {
        text: `${runs.length} match run(s).`,
        details: { runs },
      };
    }
  );

  const listBreaks = tool(
    "list_breaks",
    "Filter open (or closed) breaks by side, age, severity, status. Returns up to 50.",
    {
      type: "object",
      properties: {
        side: { type: "string" },
        ageBucket: { type: "string" },
        severity: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
    async (args) => {
      const where: Record<string, unknown> = { matchRun: { userId } };
      if (args.side) where.side = args.side;
      if (args.ageBucket) where.ageBucket = args.ageBucket;
      if (args.severity) where.severity = args.severity;
      where.status = args.status ?? "open";

      const breaks = await prisma.break.findMany({
        where,
        orderBy: [{ severity: "desc" }, { ageDays: "desc" }, { baseAmount: "desc" }],
        take: Math.min(args.limit ?? 25, 50),
      });
      return {
        text: `${breaks.length} breaks matching filter.`,
        details: { count: breaks.length, breaks },
      };
    }
  );

  const reconciliationSummary = tool(
    "reconciliation_summary",
    "Summary of the latest reconciliation state: match rate, break counts, top breaks.",
    { type: "object", properties: {}, required: [] },
    async () => {
      const lastRun = await prisma.matchRun.findFirst({
        where: { userId },
        orderBy: { startedAt: "desc" },
      });
      if (!lastRun) {
        return {
          text: "No reconciliation has been run. Upload GL and sub-ledger CSVs to start.",
          details: { lastRun: null },
        };
      }
      const openBreaks = await prisma.break.count({
        where: { matchRunId: lastRun.id, status: "open" },
      });
      const byBucket = await prisma.break.groupBy({
        by: ["ageBucket"],
        _count: true,
        where: { matchRunId: lastRun.id, status: "open" },
      });
      const topBreaks = await prisma.break.findMany({
        where: { matchRunId: lastRun.id, status: "open" },
        orderBy: [{ severity: "desc" }, { baseAmount: "desc" }],
        take: 5,
      });
      const matchRate = lastRun.totalGL + lastRun.totalSub === 0
        ? 0
        : (lastRun.matched + lastRun.partial) / (lastRun.totalGL + lastRun.totalSub);

      return {
        text:
          `Last run ${lastRun.startedAt.toISOString()}: match rate ${(matchRate * 100).toFixed(1)}%, ` +
          `${openBreaks} open breaks. Top breaks: ${topBreaks.map((b) => `$${b.baseAmount.toFixed(0)} (${b.ageBucket})`).join(", ")}.`,
        details: { lastRun, openBreaks, byBucket, topBreaks, matchRate },
      };
    }
  );

  return { searchLedgerEntries, listMatchRuns, listBreaks, reconciliationSummary };
}
```

- [ ] **Step 2: Register in `lib/agent/index.ts`**

Find where `createFinancialTools(userId)` is called and destructured, and add alongside it:

```ts
import { createReconciliationTools } from "./tools/reconciliation";

// ... inside the function where tools are assembled
const financialTools = createFinancialTools(userId);
const reconTools = createReconciliationTools(userId);
const allTools = [
  ...Object.values(financialTools),
  ...Object.values(reconTools),
];
```

Exact integration depends on how `buildAllowedTools` consumes these — inspect `lib/agent/allowed-tools.ts` and mirror the existing pattern.

- [ ] **Step 3: Commit**

```bash
git add lib/agent/tools/reconciliation.ts lib/agent/index.ts
git commit -m "feat(agent): reconciliation read tools — search, list runs/breaks, summary"
```

---

## Task 15: Agent tools — write side (matching, ageing, escalation, adjustments)

**Files:**
- Modify: `lib/agent/tools/reconciliation.ts`

- [ ] **Step 1: Append write tools**

```ts
import {
  loadLedgerEntries,
  saveMatchRun,
  reAgeOpenBreaks,
} from "@/lib/reconciliation/persist";
import { DEFAULT_STRATEGY_CONFIG } from "@/lib/reconciliation/types";
import { escalateQualifyingBreaks } from "@/lib/reconciliation/escalation";

// inside createReconciliationTools(), add:

const runMatching = tool(
  "run_matching",
  "Start a new reconciliation match run with the given strategy config. Auto-escalates qualifying breaks.",
  {
    type: "object",
    properties: {
      strategyConfig: {
        type: "object",
        description: "Override default; fields: exact (bool), tolerance {enabled,amount,daysPlus,daysMinus}, fuzzy {enabled,threshold}",
      },
    },
    required: [],
  },
  async (args) => {
    const { gl, sub } = await loadLedgerEntries(userId);
    if (gl.length === 0 && sub.length === 0) {
      return { text: "No ledger data loaded yet — upload GL and sub-ledger CSVs first.", details: {} };
    }
    const config = { ...DEFAULT_STRATEGY_CONFIG, ...(args.strategyConfig ?? {}) };
    const runId = await saveMatchRun(userId, gl, sub, config, "agent");
    return { text: `Match run ${runId} completed.`, details: { runId } };
  }
);

const ageBreaks = tool(
  "age_breaks",
  "Recompute ageing/severity for all currently open breaks as of today.",
  { type: "object", properties: {}, required: [] },
  async () => {
    const updated = await reAgeOpenBreaks(userId);
    return { text: `Re-aged ${updated} open breaks.`, details: { updated } };
  }
);

const escalateBreak = tool(
  "escalate_break",
  "Force-create an Action row for a specific break (use when auto-escalation did not pick it up).",
  {
    type: "object",
    properties: { breakId: { type: "string" } },
    required: ["breakId"],
  },
  async (args) => {
    const b = await prisma.break.findFirst({
      where: { id: args.breakId, matchRun: { userId } },
    });
    if (!b) return { text: `Break ${args.breakId} not found.`, details: {} };
    if (b.actionId) return { text: `Break already escalated to action ${b.actionId}.`, details: { actionId: b.actionId } };
    const action = await prisma.action.create({
      data: {
        userId, type: "reconciliation_break", severity: b.severity,
        headline: `Manual escalation: ${b.side === "gl_only" ? "GL" : "Sub-ledger"} break`,
        detail: `Age ${b.ageDays}d, ${b.baseAmount.toFixed(2)} ${b.txnCurrency}.`,
        driver: "reconciliation", status: "pending", sourceDataSourceId: "",
      },
    });
    await prisma.break.update({ where: { id: b.id }, data: { actionId: action.id } });
    return { text: `Escalated break ${b.id} → action ${action.id}.`, details: { actionId: action.id } };
  }
);

const proposeAdjustment = tool(
  "propose_adjustment",
  "Create an AdjustmentProposal for a break. Does not post until approved.",
  {
    type: "object",
    properties: {
      breakId: { type: "string" },
      debitAccount: { type: "string" },
      creditAccount: { type: "string" },
      amount: { type: "number" },
      description: { type: "string" },
    },
    required: ["breakId", "debitAccount", "creditAccount", "amount", "description"],
  },
  async (args) => {
    const b = await prisma.break.findFirst({
      where: { id: args.breakId, matchRun: { userId } },
    });
    if (!b) return { text: `Break ${args.breakId} not found.`, details: {} };
    const prop = await prisma.adjustmentProposal.create({
      data: {
        breakId: b.id,
        proposedBy: "agent",
        description: args.description,
        debitAccount: args.debitAccount,
        creditAccount: args.creditAccount,
        amount: args.amount,
        baseAmount: args.amount, // assume already in base unless override later
        currency: b.txnCurrency,
        journalDate: new Date(),
        status: "pending",
      },
    });
    return { text: `Proposal ${prop.id} pending. Ask user to approve before posting.`, details: { proposalId: prop.id, proposal: prop } };
  }
);

const approveAdjustment = tool(
  "approve_adjustment",
  "Approve a pending AdjustmentProposal. WITHOUT confirm:true, returns a preview only. WITH confirm:true, posts a JournalAdjustment and flips the break to adjusted.",
  {
    type: "object",
    properties: {
      proposalId: { type: "string" },
      confirm: { type: "boolean" },
    },
    required: ["proposalId"],
  },
  async (args) => {
    const p = await prisma.adjustmentProposal.findUnique({ where: { id: args.proposalId } });
    if (!p) return { text: `Proposal ${args.proposalId} not found.`, details: {} };
    if (p.status !== "pending") return { text: `Proposal already ${p.status}.`, details: { status: p.status } };

    if (!args.confirm) {
      return {
        text:
          `PREVIEW — not posted. DR ${p.debitAccount} / CR ${p.creditAccount} for ${p.amount} ${p.currency}. ` +
          `Description: "${p.description}". Call again with confirm:true to post.`,
        details: { proposal: p, preview: true },
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const journal = await tx.journalAdjustment.create({
        data: {
          userId,
          proposalId: p.id,
          entryDate: new Date(),
          lines: JSON.stringify([
            { account: p.debitAccount, dr: p.amount, cr: 0, baseAmount: p.baseAmount },
            { account: p.creditAccount, dr: 0, cr: p.amount, baseAmount: p.baseAmount },
          ]),
        },
      });
      await tx.adjustmentProposal.update({
        where: { id: p.id },
        data: {
          status: "posted",
          approvedBy: userId,
          approvedAt: new Date(),
          postedJournalId: journal.id,
        },
      });
      await tx.break.update({
        where: { id: p.breakId },
        data: { status: "adjusted" },
      });
      return journal.id;
    });

    return { text: `Posted journal ${result}. Break flipped to adjusted.`, details: { journalId: result } };
  }
);

return {
  searchLedgerEntries, listMatchRuns, listBreaks, reconciliationSummary,
  runMatching, ageBreaks, escalateBreak, proposeAdjustment, approveAdjustment,
};
```

Note: `prisma` is already imported at the top from Task 14.

- [ ] **Step 2: Write integration tests for write tools**

Create `lib/agent/tools/__tests__/reconciliation.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createReconciliationTools } from "../reconciliation";

describe("reconciliation write tools", () => {
  let userId = "";
  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "T",
      },
    });
    userId = u.id;
  });

  it("run_matching returns friendly message on empty DB", async () => {
    const t = createReconciliationTools(userId);
    const res = await t.runMatching.handler({});
    expect(res.text).toMatch(/no ledger/i);
  });

  it("approve_adjustment returns preview when confirm is not set", async () => {
    const ds = await prisma.dataSource.create({ data: { userId, type: "gl", name: "t", status: "ready" } });
    const run = await prisma.matchRun.create({
      data: { userId, triggeredBy: "manual", strategyConfig: "{}", totalGL: 0, totalSub: 0, matched: 0, partial: 0, unmatched: 1 },
    });
    const gl = await prisma.gLEntry.create({
      data: {
        dataSourceId: ds.id, entryDate: new Date(), postingDate: new Date(),
        account: "2100", reference: "X", amount: 50, txnCurrency: "USD", baseAmount: 50,
        debitCredit: "DR",
      },
    });
    const brk = await prisma.break.create({
      data: {
        matchRunId: run.id, side: "gl_only", entryId: gl.id,
        amount: 50, baseAmount: 50, txnCurrency: "USD",
        ageDays: 5, ageBucket: "0-30", severity: "low", status: "open",
      },
    });
    const t = createReconciliationTools(userId);
    const prop = await t.proposeAdjustment.handler({
      breakId: brk.id, debitAccount: "9900", creditAccount: "2100", amount: 50, description: "test",
    });
    const proposalId = (prop.details as { proposalId: string }).proposalId;

    const preview = await t.approveAdjustment.handler({ proposalId });
    expect(preview.text).toMatch(/preview/i);
    const after = await prisma.adjustmentProposal.findUnique({ where: { id: proposalId } });
    expect(after?.status).toBe("pending");
  });

  it("approve_adjustment with confirm posts and flips break", async () => {
    // setup as above (factor into a helper or repeat inline)
    // ... create proposal, then:
    // const posted = await t.approveAdjustment.handler({ proposalId, confirm: true });
    // expect(posted.text).toMatch(/posted journal/i);
    // expect(brk.status).toBe("adjusted") via re-fetch
  });
});
```

Note: `gitclaw` `tool()` returns an object; how the `.handler` is invoked depends on the SDK version. Inspect one existing test (e.g., any that exercises `createFinancialTools`) and mirror its calling convention. If no helper exists, the test should call the raw handler closure — may require exposing handlers for test.

- [ ] **Step 3: Run tool tests**

Run: `npx vitest run lib/agent/tools/__tests__/reconciliation.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add lib/agent/tools/reconciliation.ts lib/agent/tools/__tests__/reconciliation.test.ts
git commit -m "feat(agent): reconciliation write tools — matching, ageing, escalation, adjustments with posting safety"
```

---

## Task 16: Skill, workflow, knowledge

**Files:**
- Create: `agent/skills/financial-reconciliation/SKILL.md`
- Create: `agent/workflows/financial-reconciliation.yaml`
- Create: `agent/knowledge/reconciliation-thresholds.md`
- Modify: `agent/knowledge/index.yaml`

- [ ] **Step 1: Create `agent/skills/financial-reconciliation/SKILL.md`**

```markdown
---
name: financial-reconciliation
description: Match GL vs sub-ledger, investigate breaks, propose adjustments
confidence: 1
usage_count: 0
success_count: 0
failure_count: 0
negative_examples: []
---

# Financial Reconciliation

## When to Use
- User says "reconcile", "reconciliation", "break", "unmatched", "match rate", "GL vs sub-ledger"
- User asks why reconciliation numbers look off
- User has just uploaded GL + sub-ledger data sources

## Process

1. **Orient** — Call `reconciliation_summary`. Know match rate, break count, oldest unmatched, top breaks by $.
2. **Investigate drivers** — Call `list_breaks` with `severity: "high"`. For the top 3–5 by `baseAmount`, call `search_ledger_entries` on the other side using the entry's reference.
3. **Classify** — Group by probable cause:
   - Timing (appears on one side only, recent date) → `age_breaks` and revisit.
   - Amount mismatch (partial match outside tolerance) → `propose_adjustment` with the delta.
   - FX variance (same reference, different baseAmount) → note the rate used at posting.
   - Old unresolved (>60d) → `escalate_break`.
4. **Act** — Execute the proposals the user approves. Never call `approve_adjustment` with `confirm: true` without explicit user approval in the current turn. Show a preview first.
5. **Offer re-match** — If match rate <85%, offer `run_matching` with a different `strategyConfig`.
6. **Close the loop** — Summarise: adjusted, escalated, remaining.

## Posting Safety
NEVER call `approve_adjustment` with `confirm: true` unless the user explicitly approved that specific proposal in the current turn. Always show a preview first via `approve_adjustment` without `confirm`.
```

- [ ] **Step 2: Create `agent/workflows/financial-reconciliation.yaml`**

Mirror the shape of `agent/workflows/monthly-close.yaml`. Read that file first, then create the reconciliation workflow with stages `orient → investigate → classify → act → report`, each referencing the appropriate tool.

- [ ] **Step 3: Create `agent/knowledge/reconciliation-thresholds.md`**

```markdown
# Reconciliation Thresholds

## Age buckets
- 0–30 days: current
- 31–60 days: ageing
- 60+ days: stale (auto-escalates to Actions feed if severity=high)

## Severity
- high: age > 60 days OR |baseAmount| > $10,000
- medium: age > 30 days OR |baseAmount| > $1,000
- low: otherwise

## Default match tolerances
- amount: ±$1.00 (base currency)
- date: ±2 days
- fuzzy memo threshold: 0.85 (Jaro-Winkler)
- amount proximity for fuzzy: within 5%
```

- [ ] **Step 4: Register the knowledge file in `agent/knowledge/index.yaml`**

Add an entry under `entries:`:

```yaml
  - path: reconciliation-thresholds.md
    always_load: false
    tags: [reconciliation, thresholds, severity, matching]
    priority: high
```

- [ ] **Step 5: Commit**

```bash
git add agent/skills/financial-reconciliation/SKILL.md agent/workflows/financial-reconciliation.yaml agent/knowledge/reconciliation-thresholds.md agent/knowledge/index.yaml
git commit -m "feat(agent): financial-reconciliation skill, workflow, and thresholds knowledge"
```

---

## Task 17: Live widget wiring

**Files:**
- Create: `lib/reconciliation/stats.ts`
- Modify: `app/(shell)/financial-reconciliation/page.tsx`

- [ ] **Step 1: Implement `lib/reconciliation/stats.ts`**

```ts
import { prisma } from "@/lib/db";

export async function getReconciliationStats(userId: string) {
  const lastRun = await prisma.matchRun.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
  if (!lastRun) {
    return {
      hasData: false as const,
    };
  }
  const openBreaks = await prisma.break.findMany({
    where: { matchRunId: lastRun.id, status: "open" },
    select: { side: true, baseAmount: true, ageDays: true },
  });
  const totalEntries = lastRun.totalGL + lastRun.totalSub;
  const matchRate =
    totalEntries === 0 ? 0 : (lastRun.matched + lastRun.partial) / totalEntries;
  const sum = (arr: { baseAmount: number }[]) =>
    arr.reduce((acc, b) => acc + Math.abs(b.baseAmount), 0);
  return {
    hasData: true as const,
    matchRate,
    openBreakCount: openBreaks.length,
    openBreakValue: sum(openBreaks),
    oldestBreakDays: openBreaks.reduce((m, b) => Math.max(m, b.ageDays), 0),
    glOnly: openBreaks.filter((b) => b.side === "gl_only").length,
    subOnly: openBreaks.filter((b) => b.side === "sub_only").length,
    lastRunAt: lastRun.startedAt,
  };
}

export async function getTopBreaks(userId: string, limit = 10) {
  const lastRun = await prisma.matchRun.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
  if (!lastRun) return [];
  const breaks = await prisma.break.findMany({
    where: { matchRunId: lastRun.id, status: "open" },
    orderBy: [{ severity: "desc" }, { baseAmount: "desc" }],
    take: limit,
  });

  return Promise.all(
    breaks.map(async (b) => {
      const entry =
        b.side === "gl_only"
          ? await prisma.gLEntry.findUnique({ where: { id: b.entryId } })
          : await prisma.subLedgerEntry.findUnique({ where: { id: b.entryId } });
      return {
        id: b.id,
        ref: entry?.reference ?? "(missing)",
        amount: b.baseAmount,
        currency: b.txnCurrency,
        type: b.side === "gl_only" ? "GL-only" : "Sub-only",
        age: b.ageDays,
        counterparty: entry?.counterparty ?? "—",
        severity: b.severity,
      };
    })
  );
}
```

- [ ] **Step 2: Rewrite `app/(shell)/financial-reconciliation/page.tsx`**

```tsx
import { RefreshCw } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { JourneyPage } from "@/components/journey/journey-page";
import { MetricCard } from "@/components/shared/metric-card";
import { DonutChart } from "@/components/shared/donut-chart";
import { getReconciliationStats, getTopBreaks } from "@/lib/reconciliation/stats";

async function resolveUserId(): Promise<string | null> {
  const c = await cookies();
  return c.get("userId")?.value ?? null;
}

export default async function FinancialReconciliationPage() {
  const userId = await resolveUserId();
  const stats = userId ? await getReconciliationStats(userId) : { hasData: false as const };
  const topBreaks = userId && stats.hasData ? await getTopBreaks(userId, 10) : [];

  if (!stats.hasData) {
    return (
      <JourneyPage
        id="financial-reconciliation"
        title="Financial Reconciliation"
        description="GL vs sub-ledger matching, break identification & ageing analysis"
        icon={RefreshCw}
        nudges={[
          "Why is match rate below 90%?",
          "Show me breaks over $10K",
          "Propose adjustments for timing differences",
        ]}
      >
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">No reconciliation data yet.</p>
          <Link href="/data-sources" className="underline">
            Upload GL + sub-ledger CSVs
          </Link>
        </div>
      </JourneyPage>
    );
  }

  return (
    <JourneyPage
      id="financial-reconciliation"
      title="Financial Reconciliation"
      description="GL vs sub-ledger matching, break identification & ageing analysis"
      icon={RefreshCw}
      nudges={[
        "Why is match rate below 90%?",
        "Show me breaks over $10K",
        "Propose adjustments for timing differences",
      ]}
    >
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard value={`${(stats.matchRate * 100).toFixed(1)}%`} label="Match rate" />
        <MetricCard
          value={stats.openBreakCount.toLocaleString()}
          label="Open breaks"
          sublabel={`$${stats.openBreakValue.toLocaleString()}`}
        />
        <MetricCard value={`${stats.oldestBreakDays}d`} label="Oldest break" />
        <div className="flex items-center justify-center">
          <DonutChart
            data={[
              { label: "GL only", value: stats.glOnly },
              { label: "Sub only", value: stats.subOnly },
            ]}
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Top Exceptions
      </h3>
      <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ref</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Age</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Counterparty</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Severity</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {topBreaks.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 py-2.5 font-mono text-xs">{b.ref}</td>
                <td className="px-4 py-2.5 font-semibold">
                  ${Math.abs(b.amount).toLocaleString()} {b.currency}
                </td>
                <td className="px-4 py-2.5">{b.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{b.age}d</td>
                <td className="px-4 py-2.5 text-muted-foreground">{b.counterparty}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs uppercase ${b.severity === "high" ? "text-red-600" : b.severity === "medium" ? "text-amber-600" : "text-muted-foreground"}`}>
                    {b.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/agent-console?q=${encodeURIComponent(`investigate break ${b.id}`)}`}
                    className="text-xs underline"
                  >
                    Ask AI
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JourneyPage>
  );
}
```

Adjust `resolveUserId` to match whatever auth pattern the codebase actually uses — look at another server component that fetches the current user (e.g., the home page) and mirror it.

- [ ] **Step 3: Manual browser check**

Run: `npm run dev`
Navigate to `/financial-reconciliation`:
- Before any upload: empty state with Upload link.
- Upload all three sample CSVs via `/data-sources`.
- Return to `/financial-reconciliation`: metric cards populated with real numbers, top breaks table populated, "Ask AI" links work.

- [ ] **Step 4: Commit**

```bash
git add lib/reconciliation/stats.ts app/\(shell\)/financial-reconciliation/page.tsx
git commit -m "feat(reconciliation): live widgets on journey page — metrics, donut, top breaks"
```

---

## Task 18: Seed-demo route extension

**Files:**
- Modify: `app/api/seed-demo/route.ts`
- Create: `lib/seed/reconciliation.ts`

- [ ] **Step 1: Create `lib/seed/reconciliation.ts`**

```ts
import { readFileSync } from "fs";
import { join } from "path";
import { parseCSV } from "@/lib/csv/variance-parser";
import {
  ingestGl,
  ingestSubLedger,
  ingestFxRates,
  loadLedgerEntries,
  saveMatchRun,
  userHasBothLedgers,
} from "@/lib/reconciliation/persist";
import { DEFAULT_STRATEGY_CONFIG } from "@/lib/reconciliation/types";

export async function seedReconciliation(userId: string) {
  const samplesDir = join(process.cwd(), "public", "samples");
  const fx = parseCSV(readFileSync(join(samplesDir, "sample-fx-rates.csv"), "utf-8"));
  await ingestFxRates(fx.headers, fx.rows);

  const gl = parseCSV(readFileSync(join(samplesDir, "sample-gl.csv"), "utf-8"));
  await ingestGl(userId, "sample-gl.csv", gl.headers, gl.rows);

  const sub = parseCSV(readFileSync(join(samplesDir, "sample-sub-ledger.csv"), "utf-8"));
  await ingestSubLedger(userId, "sample-sub-ledger.csv", sub.headers, sub.rows);

  if (await userHasBothLedgers(userId)) {
    const { gl: glE, sub: subE } = await loadLedgerEntries(userId);
    await saveMatchRun(userId, glE, subE, DEFAULT_STRATEGY_CONFIG, "upload");
  }
}
```

- [ ] **Step 2: Modify `app/api/seed-demo/route.ts`**

Accept a `scenario` param in the body; default `"variance"` preserves existing behaviour. Add a `"reconciliation"` branch that calls `seedReconciliation(userId)`:

```ts
const { userId, scenario = "variance" } = body;
// ... existing variance logic gated on scenario === "variance"

if (scenario === "reconciliation") {
  const { seedReconciliation } = await import("@/lib/seed/reconciliation");
  await seedReconciliation(userId);
  return NextResponse.json({ scenario, ok: true });
}
```

- [ ] **Step 3: Smoke test**

```bash
curl -X POST http://localhost:3000/api/seed-demo \
  -H "Content-Type: application/json" \
  -d '{"userId":"<your-test-user-id>","scenario":"reconciliation"}'
```

Then query: `SELECT COUNT(*) FROM "GLEntry"; SELECT COUNT(*) FROM "SubLedgerEntry"; SELECT * FROM "MatchRun";`
Expected: ~200 rows each, 1 `MatchRun` row with `triggeredBy = "upload"`.

- [ ] **Step 4: Commit**

```bash
git add lib/seed/reconciliation.ts app/api/seed-demo/route.ts
git commit -m "feat(seed): reconciliation scenario loads sample CSVs and fires initial match run"
```

---

## Task 19: End-to-end verification

**Files:** none — verification only

- [ ] **Step 1: Static checks**

```bash
npx prisma validate
npx prisma migrate status
```
Expected: schema valid, migrations up-to-date.

- [ ] **Step 2: Full test suite**

```bash
npm run test
```
Expected: all tests pass, including the new reconciliation tests.

- [ ] **Step 3: Build check**

```bash
npm run build
```
Expected: clean build with no type errors.

- [ ] **Step 4: Manual walkthrough (dev server)**

Run: `npm run dev`

Verify end-to-end:

1. Sign in as a test user.
2. Go to `/data-sources` and use the reconciliation seed button (or curl) — page lights up.
3. On `/financial-reconciliation`:
   - Metric cards show real match rate, break counts, oldest break, GL/Sub donut.
   - Top breaks table shows entries with severity badges.
   - "Ask AI" links deep-link to `/agent-console` with prefilled query.
4. Ask the chat panel each of the three nudges — verify responses cite real tool calls (check Network tab / agent-runs page).
5. Ask: "Propose an adjustment for break X." Verify `propose_adjustment` is called and a preview comes back.
6. Say: "Yes, post it." Verify `approve_adjustment` with `confirm:true` runs; the break flips to `adjusted` and vanishes from open list.
7. Check `/actions` — at least one `reconciliation_break` action should appear, rendered by the existing `ActionsRequired` component.

- [ ] **Step 5: Bugfix loop**

For each failure in step 4, revisit the relevant task. Keep commits atomic (`fix(reconciliation): …`). Do not claim completion until all seven manual steps pass.

- [ ] **Step 6: Final commit + push**

```bash
git log --oneline -20
git push origin main
```

---

## Self-review notes

- Every spec section maps to a task: §2 umbrella (implicit — every piece landed at the prescribed paths), §3.1 feature scope (Tasks 1–18), §3.2 trigger model (Task 12 auto-match, Task 15 `run_matching`), §3.3 pure-library (Tasks 2–8), §4 schema (Task 1), §5 pure library (Tasks 2–8), §6 agent integration (Tasks 14–16), §7 upload + widgets (Tasks 10–12, 17–18), §8 testing (TDD throughout), §9 verification (Task 19), §11 out-of-scope items explicitly NOT addressed.
- Types consistent across tasks: `GLEntryInput`, `SubLedgerEntryInput`, `MatchResult`, `StrategyConfig` all defined in Task 2 and referenced unchanged in every later task.
- `saveMatchRun(userId, gl, sub, config, triggeredBy)` signature identical in Tasks 9, 12, 15, 18.
- Two places force explicit posting safety: the skill (Task 16) and the `approve_adjustment` tool's default-preview behaviour (Task 15).
- Task 13 flags a potential FK constraint on `Action.sourceDataSourceId` and prescribes a follow-up migration if hit — surfaced rather than assumed away.
