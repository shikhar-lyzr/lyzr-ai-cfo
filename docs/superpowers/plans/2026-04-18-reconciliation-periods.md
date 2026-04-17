# Reconciliation Periods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the infinite-pool reconciliation model with calendar-month `ReconPeriod` anchors so every GL entry, sub-ledger entry, and match run lives inside one period; ship a period picker, in-page "Ask AI," Google Sheet linking for recon shapes, and a Reconciliation-tab filter fix alongside it.

**Architecture:** New `ReconPeriod` table + `periodKey` column on GLEntry/SubLedgerEntry/MatchRun; `loadLedgerEntries` becomes period-scoped; ingest derives `periodKey` from `entryDate` and upserts the period; stats/top-breaks/journey-context/tools all take `periodKey`; URL state (`?period=YYYY-MM`) threads from the page into the chat hook body into the `/api/chat` route into `buildContext`. Destructive one-time migration for recon tables; `DataSource` preserved.

**Tech Stack:** Next.js 16.2.2 (App Router, Turbopack), Prisma 6.19.3 + Neon Postgres (30s tx timeouts — see `lib/reconciliation/persist.ts:1027421`), Vitest 4.1.3 (30s per DB-backed test), gitclaw SDK for Lyzr, SSE streaming for chat.

**Spec:** `docs/superpowers/specs/2026-04-18-reconciliation-periods-design.md` (commit d8200f7)

**Branch/worktree:** `.worktrees/reconciliation-pilot` on `feature/reconciliation-pilot`.

**Conventions to respect:**
- Project is Next.js 16 — read relevant docs in `node_modules/next/dist/docs/` before touching App Router / server components / route handlers. The public API has breaking changes from older Next versions.
- Lyzr agent routing via `gitclaw` (not `@anthropic-ai/sdk`) — see [lib/agent/index.ts](lib/agent/index.ts).
- Neon pooler drops idle transactions past ~30s. Keep ingest batched; do not wrap long `for` loops inside `$transaction`. Pattern: prepare data outside the tx, write in bulk inside.

---

## File Structure

**New files:**
- `lib/reconciliation/period.ts` — `periodKeyFromDate(date)` + `upsertPeriod(tx, userId, periodKey)` helpers.
- `lib/reconciliation/period.test.ts` — unit tests for `periodKeyFromDate`.
- `app/api/reconciliation/periods/route.ts` — `GET` list endpoint.
- `app/api/reconciliation/periods/route.test.ts` — route tests.
- `lib/reconciliation/persist.periods.test.ts` — integration tests for period-scoped ingest + loadLedgerEntries.
- `lib/reconciliation/stats.periods.test.ts` — integration tests for period-scoped stats + topBreaks.
- `lib/agent/journey-context/financial-reconciliation.test.ts` — unit/integration for builder empty states + period scoping.
- `prisma/migrations/<timestamp>_recon_periods/migration.sql` — destructive cutover + columns + `ReconPeriod`.
- `components/journey/journey-chat-bridge.tsx` — tiny client bridge exposing `openChat(prefill)` via a shared zustand/ref.
- `app/(shell)/financial-reconciliation/period-picker.tsx` — client component.

**Modified files:**
- `prisma/schema.prisma` — add `ReconPeriod` model + `periodKey` columns.
- `lib/reconciliation/persist.ts` — period-aware `loadLedgerEntries`, ingest, multi-period run dispatch.
- `lib/reconciliation/stats.ts` — `(userId, periodKey)` signature.
- `lib/agent/journey-context/financial-reconciliation.ts` — takes `periodKey`.
- `lib/agent/journey-context/index.ts` — registry gains `periodKey`.
- `lib/agent/index.ts` — `chatWithAgent` + `buildContext` accept `periodKey`; tool factory gets the period via closure.
- `lib/agent/tools/reconciliation.ts` — factory takes `(userId, periodKey)`; queries scope by period.
- `app/api/chat/route.ts` — read `periodKey` from body.
- `app/api/upload/route.ts` — `maybeAutoMatch` becomes multi-period; response includes `periodsTouched`.
- `app/api/data-sources/link-sheet/route.ts` — widen `shape` and delegate to the recon ingest functions.
- `app/(shell)/financial-reconciliation/page.tsx` — period picker + URL state + empty-state branching.
- `app/(shell)/data-sources/page.tsx` — reconciliation tab filter fix + show `LinkSheetArea`.
- `hooks/use-chat-stream.ts` — include `periodKey` in POST body.
- `components/journey/journey-chat-panel.tsx` — accept `periodKey` + expose open handler.
- `components/reconciliation/break-row.tsx` (or wherever the "Ask AI" link lives) — in-page handler.

---

## Task 1: Period key helper + tests

**Files:**
- Create: `lib/reconciliation/period.ts`
- Create: `lib/reconciliation/period.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/reconciliation/period.test.ts
import { describe, expect, it } from "vitest";
import { periodKeyFromDate } from "./period";

describe("periodKeyFromDate", () => {
  it("formats standard mid-month date in UTC as YYYY-MM", () => {
    expect(periodKeyFromDate(new Date("2026-04-15T10:00:00Z"))).toBe("2026-04");
  });
  it("handles Jan 1 UTC boundary", () => {
    expect(periodKeyFromDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
  it("handles Dec 31 UTC boundary", () => {
    expect(periodKeyFromDate(new Date("2025-12-31T23:59:59Z"))).toBe("2025-12");
  });
  it("uses UTC even when local zone disagrees (Dec 31 23:30 UTC-5 → December UTC-next-day... actually Jan 1 UTC)", () => {
    // 2025-12-31T23:30:00-05:00 === 2026-01-01T04:30:00Z
    expect(periodKeyFromDate(new Date("2025-12-31T23:30:00-05:00"))).toBe("2026-01");
  });
  it("handles leap day", () => {
    expect(periodKeyFromDate(new Date("2024-02-29T12:00:00Z"))).toBe("2024-02");
  });
  it("zero-pads single-digit months", () => {
    expect(periodKeyFromDate(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09");
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run lib/reconciliation/period.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/reconciliation/period.ts
import type { Prisma } from "@prisma/client";

/**
 * Calendar month key in UTC. The app stores all dates in UTC; deriving the
 * period in UTC keeps page, chat, and DB aggregates consistent regardless of
 * the viewer's local timezone.
 */
export function periodKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isValidPeriodKey(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

type Tx = Prisma.TransactionClient | Prisma.ReconPeriodDelegate["upsert"] extends never ? never : any;

export async function upsertPeriod(
  tx: { reconPeriod: { upsert: (args: any) => Promise<any> } },
  userId: string,
  periodKey: string
): Promise<void> {
  await tx.reconPeriod.upsert({
    where: { userId_periodKey: { userId, periodKey } },
    create: { userId, periodKey, status: "open" },
    update: {},
  });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run lib/reconciliation/period.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/period.ts lib/reconciliation/period.test.ts
git commit -m "feat(recon): add periodKeyFromDate + upsertPeriod helpers"
```

---

## Task 2: Prisma schema + migration (destructive cutover)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_recon_periods/migration.sql`

- [ ] **Step 1: Add `ReconPeriod` model + `periodKey` columns to schema**

Edit `prisma/schema.prisma`. Add relation on `User`:

```prisma
model User {
  // ... existing fields ...
  reconPeriods       ReconPeriod[]
}
```

Add the model at the end of the file:

```prisma
model ReconPeriod {
  id        String   @id @default(cuid())
  userId    String
  periodKey String
  status    String   @default("open")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, periodKey])
  @@index([userId, createdAt])
}
```

Add `periodKey` columns:

```prisma
model GLEntry {
  // ... existing fields ...
  periodKey String
  // ... existing relations ...
  @@index([periodKey])
}

model SubLedgerEntry {
  // ... existing fields ...
  periodKey String
  // ... existing relations ...
  @@index([periodKey])
}

model MatchRun {
  // ... existing fields ...
  periodKey String
  // ... existing relations ...
  @@index([userId, periodKey, startedAt])
}
```

- [ ] **Step 2: Create the destructive migration**

```bash
npx prisma migrate dev --name recon_periods --create-only
```

Then replace the generated `migration.sql` body with:

```sql
-- Destructive cutover for reconciliation tables.
-- DataSource rows are preserved; users re-upload GL/sub to repopulate.

TRUNCATE TABLE "MatchLink", "Break", "MatchRun", "GLEntry", "SubLedgerEntry", "FXRate", "AdjustmentProposal", "JournalAdjustment" RESTART IDENTITY CASCADE;

-- Add columns
ALTER TABLE "GLEntry" ADD COLUMN "periodKey" TEXT NOT NULL;
ALTER TABLE "SubLedgerEntry" ADD COLUMN "periodKey" TEXT NOT NULL;
ALTER TABLE "MatchRun" ADD COLUMN "periodKey" TEXT NOT NULL;

CREATE INDEX "GLEntry_periodKey_idx" ON "GLEntry"("periodKey");
CREATE INDEX "SubLedgerEntry_periodKey_idx" ON "SubLedgerEntry"("periodKey");
CREATE INDEX "MatchRun_userId_periodKey_startedAt_idx" ON "MatchRun"("userId", "periodKey", "startedAt");

-- ReconPeriod table
CREATE TABLE "ReconPeriod" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconPeriod_userId_periodKey_key" ON "ReconPeriod"("userId", "periodKey");
CREATE INDEX "ReconPeriod_userId_createdAt_idx" ON "ReconPeriod"("userId", "createdAt");

ALTER TABLE "ReconPeriod"
  ADD CONSTRAINT "ReconPeriod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply and regenerate the client**

Run:
```bash
npx prisma migrate deploy
npx prisma generate
```
Expected: migration applied, client regenerated.

- [ ] **Step 4: Type-check passes**

Run: `npx tsc --noEmit`
Expected: errors will surface in `persist.ts`, `stats.ts`, etc. — those are addressed in the following tasks. For now, read the errors and confirm they are all about the new mandatory `periodKey` columns — no schema-shape surprises.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(recon)!: add ReconPeriod + periodKey columns (destructive cutover)"
```

---

## Task 3: Period-aware ingest + loadLedgerEntries

**Files:**
- Modify: `lib/reconciliation/persist.ts`
- Create: `lib/reconciliation/persist.periods.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// lib/reconciliation/persist.periods.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { ingestGl, ingestSubLedger, loadLedgerEntries } from "./persist";

const TEST_USER = "test-user-periods";

async function cleanup() {
  await prisma.matchLink.deleteMany({});
  await prisma.break.deleteMany({});
  await prisma.matchRun.deleteMany({ where: { userId: TEST_USER } });
  await prisma.gLEntry.deleteMany({ where: { dataSource: { userId: TEST_USER } } });
  await prisma.subLedgerEntry.deleteMany({ where: { dataSource: { userId: TEST_USER } } });
  await prisma.dataSource.deleteMany({ where: { userId: TEST_USER } });
  await prisma.reconPeriod.deleteMany({ where: { userId: TEST_USER } });
  await prisma.user.deleteMany({ where: { id: TEST_USER } });
}

beforeEach(async () => {
  await cleanup();
  await prisma.user.create({
    data: { id: TEST_USER, lyzrAccountId: TEST_USER, email: `${TEST_USER}@x`, name: "T" },
  });
});
afterEach(cleanup);

describe("period-aware ingest", () => {
  it("stamps each GL row with its periodKey and upserts ReconPeriod", async () => {
    const rows = [
      { entryDate: new Date("2026-03-15T00:00:00Z"), postingDate: new Date("2026-03-15T00:00:00Z"), account: "1000", reference: "A", amount: 100, txnCurrency: "USD", baseAmount: 100, debitCredit: "D" },
      { entryDate: new Date("2026-04-02T00:00:00Z"), postingDate: new Date("2026-04-02T00:00:00Z"), account: "1000", reference: "B", amount: 200, txnCurrency: "USD", baseAmount: 200, debitCredit: "D" },
    ];
    const res = await ingestGl(TEST_USER, "mar-apr.csv", rows);
    expect(res.periodsTouched.sort()).toEqual(["2026-03", "2026-04"]);

    const gl = await prisma.gLEntry.findMany({ where: { dataSource: { userId: TEST_USER } } });
    expect(gl.map((g) => g.periodKey).sort()).toEqual(["2026-03", "2026-04"]);

    const periods = await prisma.reconPeriod.findMany({ where: { userId: TEST_USER } });
    expect(periods.map((p) => p.periodKey).sort()).toEqual(["2026-03", "2026-04"]);
  });

  it("loadLedgerEntries filters by periodKey (cross-period isolation)", async () => {
    await ingestGl(TEST_USER, "mar.csv", [
      { entryDate: new Date("2026-03-10T00:00:00Z"), postingDate: new Date("2026-03-10T00:00:00Z"), account: "1000", reference: "MAR-1", amount: 100, txnCurrency: "USD", baseAmount: 100, debitCredit: "D" },
    ]);
    await ingestGl(TEST_USER, "apr.csv", [
      { entryDate: new Date("2026-04-10T00:00:00Z"), postingDate: new Date("2026-04-10T00:00:00Z"), account: "1000", reference: "APR-1", amount: 100, txnCurrency: "USD", baseAmount: 100, debitCredit: "D" },
    ]);
    await ingestSubLedger(TEST_USER, "mar-sub.csv", [
      { entryDate: new Date("2026-03-11T00:00:00Z"), sourceModule: "ap", account: "1000", reference: "MAR-1", amount: 100, txnCurrency: "USD", baseAmount: 100 },
    ]);

    const mar = await loadLedgerEntries(TEST_USER, "2026-03");
    expect(mar.gl.map((g) => g.reference)).toEqual(["MAR-1"]);
    expect(mar.sub.map((s) => s.reference)).toEqual(["MAR-1"]);

    const apr = await loadLedgerEntries(TEST_USER, "2026-04");
    expect(apr.gl.map((g) => g.reference)).toEqual(["APR-1"]);
    expect(apr.sub).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run lib/reconciliation/persist.periods.test.ts`
Expected: FAIL — `ingestGl` doesn't return `periodsTouched`; `loadLedgerEntries` doesn't accept `periodKey`.

- [ ] **Step 3: Update `persist.ts`**

In `lib/reconciliation/persist.ts`:

1. Import the helper: `import { periodKeyFromDate, upsertPeriod } from "./period";`

2. `ingestGl(userId, fileName, rows)`: after creating the `DataSource`, derive `periodKey` per row and stamp it on the `createMany` payload. Collect distinct keys in a `Set<string>`. After the createMany, upsert each period (not inside the same transaction — separate `await` calls to keep the tx short). Return `{ dataSource, periodsTouched: [...keys] }`.

   Example of the core change:

   ```ts
   const periods = new Set<string>();
   const data = rows.map((r) => {
     const periodKey = periodKeyFromDate(r.entryDate);
     periods.add(periodKey);
     return { /* ...existing fields... */, periodKey };
   });

   await prisma.$transaction(async (tx) => {
     await tx.gLEntry.createMany({ data: data.map((d) => ({ ...d, dataSourceId: ds.id })) });
   }, { timeout: 30_000 });

   for (const pk of periods) {
     await upsertPeriod(prisma, userId, pk);
   }

   return { dataSource: ds, periodsTouched: [...periods] };
   ```

3. Same treatment for `ingestSubLedger`.

4. `loadLedgerEntries(userId, periodKey)`:

   ```ts
   export async function loadLedgerEntries(userId: string, periodKey: string) {
     const [gl, sub] = await Promise.all([
       prisma.gLEntry.findMany({
         where: { dataSource: { userId, status: "ready" }, periodKey },
         orderBy: { entryDate: "asc" },
       }),
       prisma.subLedgerEntry.findMany({
         where: { dataSource: { userId, status: "ready" }, periodKey },
         orderBy: { entryDate: "asc" },
       }),
     ]);
     return { gl, sub };
   }
   ```

5. `saveMatchRun(userId, periodKey, gl, sub, config, triggeredBy)`: add `periodKey` to the signature and pass it to `prisma.matchRun.create({ data: { ..., periodKey } })`.

6. Update return type of `ingestGl` / `ingestSubLedger` to include `periodsTouched: string[]`. Update any shared helper typings.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/reconciliation/persist.periods.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/persist.ts lib/reconciliation/persist.periods.test.ts
git commit -m "feat(recon): period-aware ingest + loadLedgerEntries"
```

---

## Task 4: Period-aware stats + top breaks

**Files:**
- Modify: `lib/reconciliation/stats.ts`
- Create: `lib/reconciliation/stats.periods.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/reconciliation/stats.periods.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { getReconciliationStats, getTopBreaks } from "./stats";

const U = "test-user-stats";

async function seed() {
  await prisma.user.create({ data: { id: U, lyzrAccountId: U, email: `${U}@x`, name: "T" } });
  const marRun = await prisma.matchRun.create({
    data: { userId: U, periodKey: "2026-03", triggeredBy: "test", strategyConfig: {}, totalGL: 10, totalSub: 10, matched: 8, partial: 0, unmatched: 2 },
  });
  const aprRun = await prisma.matchRun.create({
    data: { userId: U, periodKey: "2026-04", triggeredBy: "test", strategyConfig: {}, totalGL: 20, totalSub: 20, matched: 18, partial: 0, unmatched: 2 },
  });
  await prisma.break.createMany({
    data: [
      { matchRunId: marRun.id, side: "gl", entryId: "x", amount: 500, baseAmount: 500, txnCurrency: "USD", ageDays: 10, ageBucket: "0-30", severity: "high", status: "open" },
      { matchRunId: aprRun.id, side: "gl", entryId: "y", amount: 9000, baseAmount: 9000, txnCurrency: "USD", ageDays: 5, ageBucket: "0-30", severity: "high", status: "open" },
    ],
  });
}

async function cleanup() {
  await prisma.break.deleteMany({});
  await prisma.matchRun.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { id: U } });
}

beforeEach(async () => { await cleanup(); await seed(); });
afterEach(cleanup);

describe("period-aware stats", () => {
  it("getReconciliationStats scopes to periodKey", async () => {
    const mar = await getReconciliationStats(U, "2026-03");
    if (!mar.hasData) throw new Error("expected data");
    expect(mar.openBreakValue).toBe(500);

    const apr = await getReconciliationStats(U, "2026-04");
    if (!apr.hasData) throw new Error("expected data");
    expect(apr.openBreakValue).toBe(9000);
  });

  it("returns hasData:false for unknown period", async () => {
    const may = await getReconciliationStats(U, "2026-05");
    expect(may.hasData).toBe(false);
  });

  it("getTopBreaks scopes to periodKey", async () => {
    const mar = await getTopBreaks(U, "2026-03", 5);
    expect(mar.map((b) => b.amount)).toEqual([500]);
    const apr = await getTopBreaks(U, "2026-04", 5);
    expect(apr.map((b) => b.amount)).toEqual([9000]);
  });
});
```

- [ ] **Step 2: Run — expect compile/type failure**

Run: `npx vitest run lib/reconciliation/stats.periods.test.ts`
Expected: FAIL (signature mismatch).

- [ ] **Step 3: Update `stats.ts`**

Change both signatures and scope the `matchRun.findFirst` / break queries by `periodKey`:

```ts
export async function getReconciliationStats(userId: string, periodKey: string) {
  const run = await prisma.matchRun.findFirst({
    where: { userId, periodKey },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return { hasData: false as const };
  // ... existing aggregation, plus where: { matchRunId: run.id, status: "open" }
}

export async function getTopBreaks(userId: string, periodKey: string, limit: number) {
  const run = await prisma.matchRun.findFirst({
    where: { userId, periodKey },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return [];
  return prisma.break.findMany({
    where: { matchRunId: run.id, status: "open" },
    orderBy: [{ severityRank: "desc" }, { baseAmount: "desc" }],
    take: limit,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/reconciliation/stats.periods.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reconciliation/stats.ts lib/reconciliation/stats.periods.test.ts
git commit -m "feat(recon): scope getReconciliationStats/getTopBreaks to periodKey"
```

---

## Task 5: Journey-context builder takes `periodKey`

**Files:**
- Modify: `lib/agent/journey-context/financial-reconciliation.ts`
- Modify: `lib/agent/journey-context/index.ts`
- Create: `lib/agent/journey-context/financial-reconciliation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/journey-context/financial-reconciliation.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildReconciliationContext } from "./financial-reconciliation";
import * as stats from "../../reconciliation/stats";

describe("buildReconciliationContext", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns empty-period copy when hasData is false", async () => {
    vi.spyOn(stats, "getReconciliationStats").mockResolvedValue({ hasData: false });
    vi.spyOn(stats, "getTopBreaks").mockResolvedValue([]);
    const ctx = await buildReconciliationContext("u1", "2026-04");
    expect(ctx).toContain("2026-04");
    expect(ctx.toLowerCase()).toMatch(/no data|waiting|upload/);
  });

  it("includes the period key in the header when data exists", async () => {
    vi.spyOn(stats, "getReconciliationStats").mockResolvedValue({
      hasData: true, matchRate: 0.95, openBreakCount: 2, openBreakValue: 100,
      oldestBreakDays: 3, glOnly: 0, subOnly: 0, lastRunAt: new Date(),
    } as any);
    vi.spyOn(stats, "getTopBreaks").mockResolvedValue([] as any);
    const ctx = await buildReconciliationContext("u1", "2026-04");
    expect(ctx).toContain("2026-04");
    expect(ctx).toMatch(/95/);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run lib/agent/journey-context/financial-reconciliation.test.ts`
Expected: FAIL (signature mismatch).

- [ ] **Step 3: Update the builder**

```ts
// lib/agent/journey-context/financial-reconciliation.ts
import { getReconciliationStats, getTopBreaks } from "@/lib/reconciliation/stats";

export async function buildReconciliationContext(
  userId: string,
  periodKey: string,
): Promise<string> {
  const [stats, top] = await Promise.all([
    getReconciliationStats(userId, periodKey),
    getTopBreaks(userId, periodKey, 5),
  ]);

  if (!stats.hasData) {
    return `## Journey: Financial Reconciliation — period ${periodKey}\n` +
      `No match run for this period yet. Ask the user if they've uploaded ` +
      `both GL and sub-ledger CSVs that contain ${periodKey} rows.`;
  }

  const header = `## Journey: Financial Reconciliation — period ${periodKey}`;
  const lines = [
    header,
    `- Match rate: ${(stats.matchRate * 100).toFixed(1)}%`,
    `- Open breaks: ${stats.openBreakCount} worth $${stats.openBreakValue.toFixed(0)}`,
    `- Oldest break: ${stats.oldestBreakDays} days`,
  ];
  if (top.length > 0) {
    lines.push("\nTop breaks:");
    for (const b of top) lines.push(`- ${b.side} ${b.entryId} — $${b.baseAmount} (${b.severity})`);
  } else {
    lines.push("\nAll breaks resolved for this period.");
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Update the registry**

```ts
// lib/agent/journey-context/index.ts
export async function buildJourneyContext(
  userId: string,
  journeyId: string | undefined,
  periodKey?: string,
): Promise<string | null> {
  if (!journeyId) return null;
  const builder = BUILDERS[journeyId];
  if (!builder) return null;
  return builder(userId, periodKey ?? "");
}
```

And update `BUILDERS["financial-reconciliation"]` to require `periodKey`:

```ts
const BUILDERS: Record<string, (userId: string, periodKey: string) => Promise<string>> = {
  "financial-reconciliation": buildReconciliationContext,
};
```

When `periodKey` is empty string and the journey is reconciliation, resolve to "newest with data" inline:

```ts
if (journeyId === "financial-reconciliation" && !periodKey) {
  const newest = await prisma.reconPeriod.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  periodKey = newest?.periodKey ?? "";
}
```

- [ ] **Step 5: Run tests, then commit**

```bash
npx vitest run lib/agent/journey-context/financial-reconciliation.test.ts
git add lib/agent/journey-context
git commit -m "feat(agent): thread periodKey through journey-context builders"
```

---

## Task 6: Agent + chat route + tools take `periodKey`

**Files:**
- Modify: `lib/agent/index.ts`
- Modify: `lib/agent/tools/reconciliation.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Extend `chatWithAgent` + `buildContext`**

In `lib/agent/index.ts`:

```ts
export async function buildContext(
  userId: string,
  actionId?: string,
  journeyId?: string,
  periodKey?: string,
): Promise<string> {
  // ... existing parallel fetches ...
  const journey = await buildJourneyContext(userId, journeyId, periodKey);
  // ... rest unchanged
}

export async function chatWithAgent(
  userId: string,
  message: string,
  actionId: string | undefined,
  callbacks: AgentStreamCallbacks,
  opts?: { journeyId?: string; periodKey?: string },
): Promise<void> {
  ensureApiKey();
  const context = await buildContext(userId, actionId, opts?.journeyId, opts?.periodKey);
  const tools = buildTools(userId, opts?.periodKey);
  // ... rest unchanged
}

function buildTools(userId: string, periodKey?: string) {
  const reconciliationTools = createReconciliationTools(userId, periodKey);
  return [...createFinancialTools(userId), ...Object.values(reconciliationTools)];
}
```

- [ ] **Step 2: Update `createReconciliationTools`**

Change the signature to `(userId: string, periodKey?: string)`. Inside each tool's query, when a match run is needed use:

```ts
const run = await prisma.matchRun.findFirst({
  where: { userId, ...(periodKey ? { periodKey } : {}) },
  orderBy: { startedAt: "desc" },
});
```

If `periodKey` was not supplied, fall through to newest-for-user (same fallback behavior as the UI).

- [ ] **Step 3: Update `/api/chat` route**

`app/api/chat/route.ts`: read `periodKey` from the JSON body and forward.

```ts
const { userId, message, actionId, journeyId, periodKey } = await req.json();
// ... validation ...
await chatWithAgent(userId, message, actionId, callbacks, { journeyId, periodKey });
```

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
git add lib/agent app/api/chat
git commit -m "feat(agent): thread periodKey into chatWithAgent + tools"
```

---

## Task 7: `/api/reconciliation/periods` endpoint

**Files:**
- Create: `app/api/reconciliation/periods/route.ts`
- Create: `app/api/reconciliation/periods/route.test.ts`

- [ ] **Step 1: Write the test**

```ts
// app/api/reconciliation/periods/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET } from "./route";

const U = "test-user-periods-route";

beforeEach(async () => {
  await prisma.user.create({ data: { id: U, lyzrAccountId: U, email: `${U}@x`, name: "T" } });
  await prisma.reconPeriod.createMany({
    data: [
      { userId: U, periodKey: "2026-03", status: "open" },
      { userId: U, periodKey: "2026-04", status: "open" },
    ],
  });
});

afterEach(async () => {
  await prisma.reconPeriod.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { id: U } });
});

describe("GET /api/reconciliation/periods", () => {
  it("returns periods newest-first", async () => {
    const req = new Request(`http://x/api/reconciliation/periods?userId=${U}`);
    const res = await GET(req as any);
    const json = await res.json();
    expect(json.map((p: any) => p.periodKey)).toEqual(["2026-04", "2026-03"]);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run app/api/reconciliation/periods/route.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the route**

```ts
// app/api/reconciliation/periods/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReconciliationStats } from "@/lib/reconciliation/stats";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const periods = await prisma.reconPeriod.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(periods.map(async (p) => {
    const stats = await getReconciliationStats(userId, p.periodKey);
    const [glCount, subCount] = await Promise.all([
      prisma.gLEntry.count({ where: { dataSource: { userId }, periodKey: p.periodKey } }),
      prisma.subLedgerEntry.count({ where: { dataSource: { userId }, periodKey: p.periodKey } }),
    ]);
    return {
      periodKey: p.periodKey,
      status: p.status,
      lastRunAt: stats.hasData ? stats.lastRunAt : null,
      matchRate: stats.hasData ? stats.matchRate : null,
      openBreakCount: stats.hasData ? stats.openBreakCount : 0,
      openBreakValue: stats.hasData ? stats.openBreakValue : 0,
      hasGl: glCount > 0,
      hasSub: subCount > 0,
    };
  }));

  return NextResponse.json(enriched);
}
```

- [ ] **Step 4: Run, then commit**

```bash
npx vitest run app/api/reconciliation/periods/route.test.ts
git add app/api/reconciliation/periods
git commit -m "feat(recon): GET /api/reconciliation/periods list endpoint"
```

---

## Task 8: Upload route — multi-period dispatch

**Files:**
- Modify: `app/api/upload/route.ts`

- [ ] **Step 1: Update `maybeAutoMatch` to be period-aware**

Change the helper signature:

```ts
async function maybeAutoMatch(userId: string, periods: string[]) {
  for (const periodKey of periods) {
    const { gl, sub } = await loadLedgerEntries(userId, periodKey);
    if (gl.length === 0 || sub.length === 0) continue;
    await saveMatchRun(userId, periodKey, gl, sub, DEFAULT_STRATEGY, "auto");
  }
}
```

- [ ] **Step 2: Wire ingest results into dispatch**

In the `gl` / `sub_ledger` branches of the route, replace the existing `maybeAutoMatch(userId)` call:

```ts
const result = await ingestGl(userId, file.name, rows);
await maybeAutoMatch(userId, result.periodsTouched);
return NextResponse.json({ kind: "gl", dataSource: result.dataSource, periodsTouched: result.periodsTouched });
```

Same shape for `sub_ledger`.

- [ ] **Step 3: Smoke test via curl**

```bash
# Verify route compiles
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/upload
git commit -m "feat(recon): upload route dispatches per-period match runs"
```

---

## Task 9: `link-sheet` accepts recon shapes

**Files:**
- Modify: `app/api/data-sources/link-sheet/route.ts`

- [ ] **Step 1: Widen body validation**

Current accepts `"variance" | "ar"`. Extend the zod/type guard (or literal-union check) to also include `"gl" | "sub_ledger" | "fx"`.

- [ ] **Step 2: Delegate to ingest functions**

After downloading the Sheet's CSV export and running `detectCsvShape`, branch:

```ts
switch (effectiveShape) {
  case "gl": {
    const rows = parseGlRows(csv);
    const res = await ingestGl(userId, name, rows);
    return NextResponse.json({ kind: "gl", dataSource: res.dataSource, periodsTouched: res.periodsTouched });
  }
  case "sub_ledger": {
    const rows = parseSubLedgerRows(csv);
    const res = await ingestSubLedger(userId, name, rows);
    return NextResponse.json({ kind: "sub_ledger", dataSource: res.dataSource, periodsTouched: res.periodsTouched });
  }
  case "fx": {
    const rows = parseFxRows(csv);
    const res = await ingestFxRates(userId, name, rows);
    return NextResponse.json({ kind: "fx", dataSource: res });
  }
  // existing variance + ar branches
}
```

Import the parser helpers from wherever `/api/upload/route.ts` uses them (extract them to `lib/reconciliation/csv-parsers.ts` if they live inline in the upload route — follow the existing factoring).

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add app/api/data-sources/link-sheet lib/reconciliation
git commit -m "feat(recon): link-sheet supports gl/sub_ledger/fx"
```

---

## Task 10: `/financial-reconciliation` page — period picker + URL state

**Files:**
- Modify: `app/(shell)/financial-reconciliation/page.tsx`
- Create: `app/(shell)/financial-reconciliation/period-picker.tsx`

- [ ] **Step 1: Build the client period picker**

```tsx
// app/(shell)/financial-reconciliation/period-picker.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Period = { periodKey: string; hasGl: boolean; hasSub: boolean; matchRate: number | null };

export function PeriodPicker({ userId }: { userId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("period");
  const [periods, setPeriods] = useState<Period[]>([]);

  useEffect(() => {
    fetch(`/api/reconciliation/periods?userId=${userId}`)
      .then((r) => r.json())
      .then((data: Period[]) => setPeriods(data));
  }, [userId]);

  if (periods.length === 0) return null;

  return (
    <select
      value={active ?? periods[0].periodKey}
      onChange={(e) => {
        const sp = new URLSearchParams(params);
        sp.set("period", e.target.value);
        router.push(`?${sp.toString()}`);
      }}
      className="border rounded px-2 py-1 text-sm"
    >
      {periods.map((p) => (
        <option key={p.periodKey} value={p.periodKey}>
          {p.periodKey}{p.matchRate != null ? ` — ${(p.matchRate * 100).toFixed(0)}%` : ""}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Rework `page.tsx`**

- Make the page `async` (server component already is).
- Read `searchParams.period`. If missing, resolve to newest `ReconPeriod` for the user; if still none, show the existing empty state.
- Pass `periodKey` into `getReconciliationStats` and `getTopBreaks`.
- Wrap the page body in `<Suspense>` around the `PeriodPicker`.
- Branch empty states per the spec:
  - No `ReconPeriod` rows → "Upload GL + sub-ledger CSVs" prompt (existing copy).
  - Period has GL but no sub → "This period has GL but no sub-ledger yet."
  - Period has sub but no GL → "This period has sub-ledger but no GL yet."
  - Both but 100% + 0 breaks → "All breaks resolved for this period."
- Pass `periodKey` down to the journey chat panel (next task).

Example skeleton of the relevant section:

```tsx
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const userId = await getSessionUserId();
  const periods = await prisma.reconPeriod.findMany({
    where: { userId }, orderBy: { createdAt: "desc" },
  });
  if (periods.length === 0) return <EmptyRecon />;

  const active = period && periods.some((p) => p.periodKey === period) ? period : periods[0].periodKey;
  const stats = await getReconciliationStats(userId, active);
  const top = await getTopBreaks(userId, active, 10);
  // ... render with <PeriodPicker /> in header, pass active down
}
```

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`) and verify:
- Picker appears with the seeded periods.
- Switching updates metrics + top-breaks table.
- URL reflects `?period=YYYY-MM` and refresh preserves state.

- [ ] **Step 4: Commit**

```bash
git add app/\(shell\)/financial-reconciliation
git commit -m "feat(recon): period picker + URL state on reconciliation page"
```

---

## Task 11: Chat panel + "Ask AI" in-page handler

**Files:**
- Modify: `hooks/use-chat-stream.ts`
- Modify: `components/journey/journey-chat-panel.tsx`
- Modify: the "Ask AI" cell (search `agent-console?q=` within the recon page / break-row component)
- Create: `components/journey/journey-chat-bridge.tsx`

- [ ] **Step 1: Update `useChatStream` body shape**

```ts
// hooks/use-chat-stream.ts
async function sendMessage(content: string, opts?: { actionId?: string; journeyId?: string; periodKey?: string }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, message: content, actionId: opts?.actionId, journeyId: opts?.journeyId, periodKey: opts?.periodKey }),
  });
  // ... rest unchanged
}
```

- [ ] **Step 2: Chat bridge for in-page "Ask AI"**

```tsx
// components/journey/journey-chat-bridge.tsx
"use client";
import { create } from "zustand";

type State = {
  prefill: string | null;
  setPrefill: (v: string | null) => void;
  openWith: (msg: string) => void;
};

export const useJourneyChat = create<State>((set) => ({
  prefill: null,
  setPrefill: (v) => set({ prefill: v }),
  openWith: (msg) => set({ prefill: msg }),
}));
```

- [ ] **Step 3: Wire `JourneyChatPanel`**

- Accept `periodKey?: string` prop.
- Read `prefill` from `useJourneyChat`; when it becomes non-null, expand the panel, paste into the input, auto-send, then clear.
- Pass `periodKey` into each `sendMessage({ journeyId, periodKey })`.

- [ ] **Step 4: Update the "Ask AI" cell**

Locate the existing `<Link href="/agent-console?q=...">`:

```bash
# Confirm the exact file
grep -rn "agent-console?q=" app components
```

Replace with:

```tsx
"use client";
import { useJourneyChat } from "@/components/journey/journey-chat-bridge";

function AskAIButton({ breakId }: { breakId: string }) {
  const openWith = useJourneyChat((s) => s.openWith);
  return (
    <button onClick={() => openWith(`investigate break ${breakId}`)} className="text-sm text-blue-600 underline">
      Ask AI
    </button>
  );
}
```

- [ ] **Step 5: Manual smoke test**

- Navigate to `/financial-reconciliation?period=<active>`.
- Click "Ask AI" on a break row → chat panel opens, prefill appears, message auto-sends.
- Agent's response references the selected period.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-chat-stream.ts components/journey
git commit -m "feat(recon): in-page Ask AI + periodKey on chat stream"
```

---

## Task 12: `/data-sources` Reconciliation tab fixes

**Files:**
- Modify: `app/(shell)/data-sources/page.tsx`

- [ ] **Step 1: Fix the tab filter**

Find the block that filters the reconciliation tab. Replace:

```tsx
// BEFORE (approx)
tab === "reconciliation"
  ? sources.filter((s) => JSON.parse(s.metadata ?? "{}").shape === "reconciliation")
  : ...
```

with:

```tsx
tab === "reconciliation"
  ? sources.filter((s) => s.type === "gl" || s.type === "sub_ledger" || s.type === "fx")
  : ...
```

- [ ] **Step 2: Show `LinkSheetArea` on the reconciliation tab**

Locate the line ~197 that hides `LinkSheetArea` when `tab === "reconciliation"`. Remove the condition or flip it to always render. Pass `shape="gl"` as the nominal default; the server-side `detectCsvShape` will override per actual content.

- [ ] **Step 3: Manual smoke test**

- Start dev server.
- Upload an FX CSV; confirm it appears on the Reconciliation tab.
- Paste a Google Sheet URL of a GL CSV; confirm it ingests and a period appears.

- [ ] **Step 4: Commit**

```bash
git add app/\(shell\)/data-sources
git commit -m "fix(data-sources): reconciliation tab includes fx + shows LinkSheetArea"
```

---

## Task 13: End-to-end verification

**Files:** none — manual + scripted verification.

- [ ] **Step 1: Drop + re-run migration against a staging DB**

```bash
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 2: Seed and verify cross-period isolation**

- Upload a two-period GL CSV (March + April rows).
- Upload a matching sub-ledger.
- Confirm on `/financial-reconciliation`:
  - Two entries in the picker.
  - Switching updates stats and top-breaks.
  - Chat scoped to March mentions only March figures; likewise for April.
- Confirm on `/data-sources`:
  - Reconciliation tab shows all three source types.
  - Linking a Google Sheet for GL creates a new period entry.

- [ ] **Step 3: Run the debug-journey script**

```bash
npx tsx scripts/debug-journey.ts
```

Expected: latest run per period shows correct stats; no more contradictions between `getTopBreaks` and the on-page table.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all green.

- [ ] **Step 5: Commit the verification note**

No code changes in this task. If any regressions are found, return to the relevant task and fix before proceeding. When clean, no commit needed.

---

## Post-plan

After all tasks complete, dispatch the final code reviewer subagent over the full diff against `main` and invoke `superpowers:finishing-a-development-branch` to prep the PR.
