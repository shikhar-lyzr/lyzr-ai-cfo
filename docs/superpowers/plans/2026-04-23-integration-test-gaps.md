# Integration-Test Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three integration-test gaps from the 2026-04-22 bug-fix batch: (1) upload → recon → close-readiness at the DB layer, (2) close-package LLM response handling, (3) SSE pipeline_step wire from `chatWithAgent` to the chat route.

**Architecture:** Test-only work, no production code changes. Three phased test suites each shippable independently. Phase 1 hits the real Neon branch via real Prisma; phases 2 and 3 mock `gitclaw.query()` with scripted message sequences from a shared factory.

**Tech Stack:** Vitest 4, Prisma 6 (Postgres/Neon), Next.js 16 app-router route handlers invoked as functions, TypeScript strict.

---

## Task 0: Shared test-user cleanup helper

**Files:**
- Create: `tests/integration/cleanup.ts`

Establishes the dependency-order cleanup used by every integration test. The schema has no User-level cascade rules (Prisma default `NO ACTION`; `ReconPeriod.userId` is `onDelete: Restrict`), so deleting a user requires deleting its rows explicitly in dependency order first. `DataSource` cascades reach `FinancialRecord`, `Invoice`, `GLEntry`, `SubLedgerEntry` via the FK rules from migration `20260422045930_upload_dedup_cascade`.

- [ ] **Step 1: Create the cleanup helper**

```ts
// tests/integration/cleanup.ts
import { prisma } from "@/lib/db";

// Deletes a test user and all its rows in dependency order. The schema has
// no User-level cascades, so children must be removed explicitly. This is
// intentionally verbose — trying to be clever here masks FK errors.
export async function deleteTestUser(userId: string): Promise<void> {
  // Action-side: ActionEvent references Action; ChatMessage references Action
  await prisma.actionEvent.deleteMany({ where: { userId } });
  await prisma.chatMessage.deleteMany({ where: { userId } });
  await prisma.action.deleteMany({ where: { userId } });

  // MatchRun cascades to MatchLink and Break
  await prisma.matchRun.deleteMany({ where: { userId } });

  // Documents, journals, recon periods (Restrict)
  await prisma.document.deleteMany({ where: { userId } });
  await prisma.journalAdjustment.deleteMany({ where: { userId } });
  await prisma.reconPeriod.deleteMany({ where: { userId } });

  // DataSource cascades to FinancialRecord/Invoice/GLEntry/SubLedgerEntry
  await prisma.dataSource.deleteMany({ where: { userId } });

  await prisma.user.delete({ where: { id: userId } });
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/integration/cleanup.ts
git commit -m "test: deleteTestUser helper for integration cleanup"
```

---

## Task 1: Phase 1 — close-readiness upload integration (fixture + cold state)

**Files:**
- Create: `tests/integration/close-readiness-upload.test.ts`

Establishes the test file and the first `it()` block — cold state (no data). Uses real Neon.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/close-readiness-upload.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { getCloseReadiness, getCloseBlockers } from "@/lib/close/stats";
import { deriveTaskCounts } from "@/lib/close/tasks";
import { deleteTestUser } from "./cleanup";

// Neon pooler round-trips add up across seed + the three read functions; 5s
// vitest default is not enough. Matches existing integration tests.
describe("close-readiness upload integration", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("cold state returns hasData=false with isEmpty task cards", async () => {
    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(false);

    const blockers = await getCloseBlockers(userId, "2026-04");
    // With no sources at all, every required source is "missing"
    expect(blockers.length).toBe(3);
    expect(blockers.every((b) => b.kind === "missing_source")).toBe(true);

    const tasks = await deriveTaskCounts(userId, "2026-04");
    expect(tasks).toHaveLength(5);
    // All ledger-backed cards empty; variance + package cards total=1 with completed=0
    expect(tasks[0].isEmpty).toBe(true); // subledger
    expect(tasks[1].isEmpty).toBe(true); // gl
    expect(tasks[2].total).toBe(1); // variance (special: total always 1)
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/close-readiness-upload.test.ts`
Expected: PASS (cold state is the existing behavior — the test locks it in).

If it fails, investigate — something in `getCloseBlockers` behavior is unexpected. The spec says no sources → 3 missing-source blockers (gl + sub_ledger + variance).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/close-readiness-upload.test.ts
git commit -m "test(integration): close readiness cold-state fixture"
```

---

## Task 2: Phase 1 — GL upload only

**Files:**
- Modify: `tests/integration/close-readiness-upload.test.ts`

Seeds a single GL DataSource with entries, asserts signals reflect GL-only state. No sub-ledger yet, no variance records.

- [ ] **Step 1: Write the failing test**

Add a new `it()` block after the cold-state test:

```ts
  it("GL upload only populates GL task card but matchRate stays 0", async () => {
    // Seed a GL DataSource + 10 unmatched entries + a MatchRun with matched=0
    const gl = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    await prisma.gLEntry.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        dataSourceId: gl.id,
        periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        postingDate: new Date("2026-04-15"),
        account: "2100",
        reference: `INV-${i}`,
        amount: 100,
        txnCurrency: "USD",
        baseAmount: 100,
        debitCredit: "DR",
        counterparty: "Acme",
        matchStatus: "unmatched",
      })),
    });
    await prisma.matchRun.create({
      data: {
        userId,
        periodKey: "2026-04",
        triggeredBy: "upload",
        strategyConfig: {},
        totalGL: 10,
        totalSub: 0,
        matched: 0,
        partial: 0,
        unmatched: 10,
        completedAt: new Date(),
      },
    });

    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(true);
    if (readiness.hasData) {
      expect(readiness.signals.matchRate).toBe(0);
      // sub_ledger + variance missing -> 2/3
      expect(readiness.signals.freshnessPenalty).toBeCloseTo(2 / 3, 5);
    }

    const tasks = await deriveTaskCounts(userId, "2026-04");
    // tasks[1] is the GL card
    expect(tasks[1].isEmpty).toBe(false);
    expect(tasks[1].total).toBe(10);
    expect(tasks[1].completed).toBe(0);
    // sub-ledger still empty
    expect(tasks[0].isEmpty).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/close-readiness-upload.test.ts -t "GL upload only"`
Expected: PASS — this locks in existing post-`f2dcbcf` behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/close-readiness-upload.test.ts
git commit -m "test(integration): GL-only readiness — matchRate 0, freshness 2/3"
```

---

## Task 3: Phase 1 — GL + sub-ledger match

**Files:**
- Modify: `tests/integration/close-readiness-upload.test.ts`

Adds sub-ledger DataSource with matched entries and a MatchRun reflecting 100% match. Asserts `matchRate: 1.0` and freshness drops to 1/3.

- [ ] **Step 1: Write the failing test**

Add after the GL-only test:

```ts
  it("GL + sub-ledger fully matched: matchRate=1.0, freshness 1/3", async () => {
    const gl = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    const sub = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "test-sub.csv", status: "ready" },
    });
    // 10 GL + 10 Sub, all matched
    await prisma.gLEntry.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        dataSourceId: gl.id,
        periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        postingDate: new Date("2026-04-15"),
        account: "2100",
        reference: `INV-${i}`,
        amount: 100,
        txnCurrency: "USD",
        baseAmount: 100,
        debitCredit: "DR",
        counterparty: "Acme",
        matchStatus: "matched",
      })),
    });
    await prisma.subLedgerEntry.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        dataSourceId: sub.id,
        sourceModule: "AP",
        periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        account: "2100",
        reference: `INV-${i}`,
        amount: 100,
        txnCurrency: "USD",
        baseAmount: 100,
        counterparty: "Acme",
        matchStatus: "matched",
      })),
    });
    await prisma.matchRun.create({
      data: {
        userId,
        periodKey: "2026-04",
        triggeredBy: "upload",
        strategyConfig: {},
        totalGL: 10,
        totalSub: 10,
        matched: 10,
        partial: 0,
        unmatched: 0,
        completedAt: new Date(),
      },
    });

    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(true);
    if (readiness.hasData) {
      // (matched * 2) / (totalGL + totalSub) = 20 / 20 = 1.0
      expect(readiness.signals.matchRate).toBe(1);
      // gl + sub_ledger present, variance still missing -> 1/3
      expect(readiness.signals.freshnessPenalty).toBeCloseTo(1 / 3, 5);
    }

    const tasks = await deriveTaskCounts(userId, "2026-04");
    expect(tasks[0].isEmpty).toBe(false); // sub-ledger
    expect(tasks[0].total).toBe(10);
    expect(tasks[0].completed).toBe(10);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/close-readiness-upload.test.ts -t "fully matched"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/close-readiness-upload.test.ts
git commit -m "test(integration): 100% match → matchRate 1.0, freshness 1/3"
```

---

## Task 4: Phase 1 — variance records present (regression-lock for b86e262)

**Files:**
- Modify: `tests/integration/close-readiness-upload.test.ts`

Seeds a `DataSource(type: "csv")` with variance-shape metadata and FinancialRecord rows. Asserts no phantom "missing variance" blocker. This is the direct regression-lock for the Bug 3 fix where variance presence is detected via FinancialRecord rows rather than `DataSource.type`.

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("variance FinancialRecords present: no missing-variance blocker, freshness=0", async () => {
    const gl = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    const sub = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "test-sub.csv", status: "ready" },
    });
    // Variance CSVs are uploaded as type="csv" with shape stashed in metadata.
    // The freshness check must key off FinancialRecord presence, not DataSource.type.
    const varianceDs = await prisma.dataSource.create({
      data: {
        userId,
        type: "csv",
        name: "budget-2026-04.csv",
        status: "ready",
        metadata: JSON.stringify({ shape: "variance" }),
      },
    });
    await prisma.financialRecord.createMany({
      data: [
        { dataSourceId: varianceDs.id, account: "Marketing", period: "2026-04", actual: 14200, budget: 11500, category: "OpEx" },
        { dataSourceId: varianceDs.id, account: "R&D",       period: "2026-04", actual: 15600, budget: 12000, category: "OpEx" },
      ],
    });
    // Minimal entries so the run is seen
    await prisma.gLEntry.create({
      data: {
        dataSourceId: gl.id, periodKey: "2026-04",
        entryDate: new Date("2026-04-15"), postingDate: new Date("2026-04-15"),
        account: "2100", reference: "INV-1",
        amount: 100, txnCurrency: "USD", baseAmount: 100,
        debitCredit: "DR", counterparty: "X", matchStatus: "matched",
      },
    });
    await prisma.subLedgerEntry.create({
      data: {
        dataSourceId: sub.id, sourceModule: "AP", periodKey: "2026-04",
        entryDate: new Date("2026-04-15"),
        account: "2100", reference: "INV-1",
        amount: 100, txnCurrency: "USD", baseAmount: 100,
        counterparty: "X", matchStatus: "matched",
      },
    });
    await prisma.matchRun.create({
      data: {
        userId, periodKey: "2026-04", triggeredBy: "upload", strategyConfig: {},
        totalGL: 1, totalSub: 1, matched: 1, partial: 0, unmatched: 0,
        completedAt: new Date(),
      },
    });

    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(true);
    if (readiness.hasData) {
      expect(readiness.signals.freshnessPenalty).toBe(0);
    }

    const blockers = await getCloseBlockers(userId, "2026-04");
    const missingSource = blockers.filter((b) => b.kind === "missing_source");
    expect(missingSource).toHaveLength(0);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/close-readiness-upload.test.ts -t "no missing-variance"`
Expected: PASS (locks `b86e262`).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/close-readiness-upload.test.ts
git commit -m "test(integration): variance records present → no missing-variance blocker"
```

---

## Task 5: Phase 1 — quarterly key expansion (regression-lock for f2dcbcf)

**Files:**
- Modify: `tests/integration/close-readiness-upload.test.ts`

Seeds three months of MatchRuns + entries. Calls `getCloseReadiness(userId, "2026-Q1")`. Asserts `matchRate` aggregates across the three monthly runs.

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("quarterly periodKey aggregates monthly MatchRuns", async () => {
    const gl = await prisma.dataSource.create({
      data: { userId, type: "gl", name: "test-gl.csv", status: "ready" },
    });
    const sub = await prisma.dataSource.create({
      data: { userId, type: "sub_ledger", name: "test-sub.csv", status: "ready" },
    });
    // Three monthly runs, each with 6 matched pairs (100% rate per month)
    const monthlyKeys = ["2026-01", "2026-02", "2026-03"] as const;
    for (const periodKey of monthlyKeys) {
      await prisma.matchRun.create({
        data: {
          userId,
          periodKey,
          triggeredBy: "upload",
          strategyConfig: {},
          totalGL: 6,
          totalSub: 6,
          matched: 6,
          partial: 0,
          unmatched: 0,
          completedAt: new Date(),
        },
      });
    }
    // GL/Sub entries stamped with monthly periodKey so task-count queries see them
    for (const periodKey of monthlyKeys) {
      await prisma.gLEntry.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          dataSourceId: gl.id,
          periodKey,
          entryDate: new Date(`${periodKey}-15`),
          postingDate: new Date(`${periodKey}-15`),
          account: "2100",
          reference: `${periodKey}-INV-${i}`,
          amount: 100,
          txnCurrency: "USD",
          baseAmount: 100,
          debitCredit: "DR",
          counterparty: "X",
          matchStatus: "matched",
        })),
      });
      await prisma.subLedgerEntry.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          dataSourceId: sub.id,
          sourceModule: "AP",
          periodKey,
          entryDate: new Date(`${periodKey}-15`),
          account: "2100",
          reference: `${periodKey}-INV-${i}`,
          amount: 100,
          txnCurrency: "USD",
          baseAmount: 100,
          counterparty: "X",
          matchStatus: "matched",
        })),
      });
    }

    const readiness = await getCloseReadiness(userId, "2026-Q1");
    expect(readiness.hasData).toBe(true);
    if (readiness.hasData) {
      // 3 * 6 * 2 pairs / (3 * 12 entries) = 36/36 = 1.0
      expect(readiness.signals.matchRate).toBe(1);
    }

    const tasks = await deriveTaskCounts(userId, "2026-Q1");
    // GL card should aggregate: 18 entries total (6 per month * 3 months), all matched
    expect(tasks[1].total).toBe(18);
    expect(tasks[1].completed).toBe(18);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/close-readiness-upload.test.ts -t "quarterly"`
Expected: PASS (locks `f2dcbcf`).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/close-readiness-upload.test.ts
git commit -m "test(integration): quarterly periodKey aggregates monthly runs"
```

---

## Task 6: Phase 1 — final verification, full file run

**Files:**
- None. Verification step only.

- [ ] **Step 1: Run all Phase 1 tests**

Run: `npx vitest run tests/integration/close-readiness-upload.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 2: Run the full suite to confirm no regressions**

Run: `npx vitest run`
Expected: 245 + 5 = 250 tests pass.

- [ ] **Step 3: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no output.

(Phase 1 is now complete. Note: Phase 1 adds ~6 test-user rows per run to Neon — matches existing integration-test behavior.)

---

## Task 7: Phase 2 — shared mock-query factory

**Files:**
- Create: `tests/agent/mock-query.ts`

The shared helper used by phases 2 and 3. Returns a scripted `AsyncIterable<GCMessage>` from a pre-baked message array.

- [ ] **Step 1: Create the factory file**

```ts
// tests/agent/mock-query.ts
//
// Builders for scripted gitclaw GCMessage sequences. Used by
// tests/agent/close-package-response.test.ts and
// tests/chat-route/pipeline-sse.test.ts.
//
// The shapes match the minimum set of fields the production code actually
// reads. They intentionally do NOT try to mirror the full GCMessage union —
// extending this file is cheaper than keeping dummy values for fields
// nothing reads.

import type { GCMessage } from "gitclaw";

export function deltaMsg(text: string): GCMessage {
  return { type: "delta", deltaType: "text", content: text } as unknown as GCMessage;
}

export function assistantMsg(content: string, stopReason?: string): GCMessage {
  return { type: "assistant", content, stopReason } as unknown as GCMessage;
}

export function toolUseMsg(id: string, toolName: string, args?: unknown): GCMessage {
  return { type: "tool_use", id, toolName, args } as unknown as GCMessage;
}

export function toolResultMsg(toolUseId: string, text: string, isError = false): GCMessage {
  return { type: "tool_result", toolUseId, content: text, isError } as unknown as GCMessage;
}

export function systemErrorMsg(content: string): GCMessage {
  return { type: "system", subtype: "error", content } as unknown as GCMessage;
}

// Returns a value shaped like gitclaw's Query (an AsyncIterable<GCMessage>)
// that yields the provided messages in order and completes.
export function scriptedQuery(messages: GCMessage[]): AsyncIterable<GCMessage> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const m of messages) yield m;
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add tests/agent/mock-query.ts
git commit -m "test: shared gitclaw query() mock factory"
```

---

## Task 8: Phase 2 — close_package response test (fixture + sanitization)

**Files:**
- Create: `tests/agent/close-package-response.test.ts`

First `it()` block — confirms `sanitizeReportBody` runs inside `generateReport`. Uses real Prisma (small seed) + mocked `gitclaw.query()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/agent/close-package-response.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { deleteTestUser } from "../integration/cleanup";
import {
  deltaMsg,
  scriptedQuery,
} from "./mock-query";

// Mock gitclaw so query() returns our scripted sequence. The `tool` export
// is called at module-load time by lib/agent/tools.ts, so it must return a
// plausible shape even though we don't exercise any tools in these tests.
vi.mock("gitclaw", () => ({
  query: vi.fn(),
  tool: (name: string, description: string, inputSchema: unknown, handler: unknown) => ({
    name,
    description,
    inputSchema,
    handler,
  }),
}));

// Import AFTER vi.mock so the module picks up the mocked gitclaw
import { query } from "gitclaw";
import { generateReport } from "@/lib/agent";

describe("close_package response handling", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    // Minimal seed: getCloseReadiness needs SOMETHING to return hasData: true.
    // A single FinancialRecord under the target period is enough.
    const ds = await prisma.dataSource.create({
      data: {
        userId, type: "csv", name: "seed.csv", status: "ready",
        metadata: JSON.stringify({ shape: "variance" }),
      },
    });
    await prisma.financialRecord.create({
      data: {
        dataSourceId: ds.id, account: "Marketing", period: "2026-Q1",
        actual: 100, budget: 100, category: "OpEx",
      },
    });
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("strips Lyzr agent-narration preamble from the saved body", async () => {
    const dirty = [
      "The **2026-Q1 Monthly Close Package Report** has been generated and saved.",
      "You can refer to artifact ID `2711d04f-ef12-4660-ad5f-028f79a2d993` for the full markdown content.",
      "",
      "# Monthly Close Package — 2026-Q1",
      "",
      "## Executive Summary",
      "Real content here.",
    ].join("\n");
    vi.mocked(query).mockReturnValue(scriptedQuery([deltaMsg(dirty)]) as ReturnType<typeof query>);

    await generateReport(userId, "close_package", "2026-Q1");

    const saved = await prisma.document.findFirst({
      where: { userId, type: "close_package", period: "2026-Q1" },
    });
    expect(saved).not.toBeNull();
    expect(saved!.body).not.toContain("artifact ID");
    expect(saved!.body).not.toContain("has been generated and saved");
    expect(saved!.body).toContain("# Monthly Close Package — 2026-Q1");
    expect(saved!.body).toContain("Real content here");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/agent/close-package-response.test.ts`
Expected: PASS.

If this fails with "lyzr_api_key" or similar, the `ensureApiKey` guard in `generateReport` is tripping. Set `LYZR_API_KEY=test` in the test setup or mock `ensureApiKey`. Add to top of test file if needed:

```ts
process.env.LYZR_API_KEY = process.env.LYZR_API_KEY ?? "test-dummy";
```

- [ ] **Step 3: Commit**

```bash
git add tests/agent/close-package-response.test.ts
git commit -m "test(agent): close_package strips narration preamble"
```

---

## Task 9: Phase 2 — upsert on regenerate (regression-lock for 7510b19)

**Files:**
- Modify: `tests/agent/close-package-response.test.ts`

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("calling generateReport twice updates the existing doc, not duplicates", async () => {
    vi.mocked(query).mockReturnValueOnce(
      scriptedQuery([deltaMsg("# First draft\n\nInitial body.")]) as ReturnType<typeof query>,
    );
    await generateReport(userId, "close_package", "2026-Q1");

    vi.mocked(query).mockReturnValueOnce(
      scriptedQuery([deltaMsg("# Second draft\n\nUpdated body.")]) as ReturnType<typeof query>,
    );
    await generateReport(userId, "close_package", "2026-Q1");

    const all = await prisma.document.findMany({
      where: { userId, type: "close_package", period: "2026-Q1" },
    });
    expect(all).toHaveLength(1);
    expect(all[0].body).toContain("Updated body");
    expect(all[0].body).not.toContain("Initial body");
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/agent/close-package-response.test.ts -t "updates the existing doc"`
Expected: PASS (locks `7510b19`).

- [ ] **Step 3: Commit**

```bash
git add tests/agent/close-package-response.test.ts
git commit -m "test(agent): close_package regenerate upserts instead of duplicating"
```

---

## Task 10: Phase 2 — empty body + period-required guards

**Files:**
- Modify: `tests/agent/close-package-response.test.ts`

- [ ] **Step 1: Write the failing tests**

Add:

```ts
  it("throws and does not persist on empty LLM response", async () => {
    vi.mocked(query).mockReturnValue(scriptedQuery([deltaMsg("   \n\n   ")]) as ReturnType<typeof query>);

    await expect(generateReport(userId, "close_package", "2026-Q1")).rejects.toThrow(
      /empty body/i,
    );

    const docs = await prisma.document.findMany({
      where: { userId, type: "close_package" },
    });
    expect(docs).toHaveLength(0);
  });

  it("throws without calling query when period is omitted", async () => {
    await expect(generateReport(userId, "close_package")).rejects.toThrow(/period/i);
    expect(vi.mocked(query)).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/agent/close-package-response.test.ts -t "empty LLM response|period is omitted"`
Expected: both PASS (locks `04a8696` and `ebc32ae`).

- [ ] **Step 3: Commit**

```bash
git add tests/agent/close-package-response.test.ts
git commit -m "test(agent): close_package guards empty body + missing period"
```

---

## Task 11: Phase 3 — pipeline SSE test (fixture + baseline step-0)

**Files:**
- Create: `tests/chat-route/pipeline-sse.test.ts`

First `it()` — baseline: one delta, no tools. Confirms `step-0` running→completed frames bracket the delta stream.

- [ ] **Step 1: Write the failing test**

```ts
// tests/chat-route/pipeline-sse.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { deleteTestUser } from "../integration/cleanup";
import { deltaMsg, scriptedQuery, toolUseMsg, toolResultMsg } from "../agent/mock-query";

process.env.LYZR_API_KEY = process.env.LYZR_API_KEY ?? "test-dummy";

vi.mock("gitclaw", () => ({
  query: vi.fn(),
  tool: (name: string, description: string, inputSchema: unknown, handler: unknown) => ({
    name, description, inputSchema, handler,
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

import { query } from "gitclaw";
import { getSession } from "@/lib/auth";
import { POST } from "@/app/api/chat/route";

// Parse an SSE body into frames. Each frame is `event: <name>\ndata: <json>\n\n`.
async function readSseFrames(
  body: ReadableStream<Uint8Array> | null,
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  if (!body) return [];
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames: Array<{ event: string; data: Record<string, unknown> }> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const ev = part.match(/^event: (.+)$/m)?.[1];
      const data = part.match(/^data: (.+)$/m)?.[1];
      if (!ev || !data) continue;
      try {
        frames.push({ event: ev, data: JSON.parse(data) });
      } catch {
        // skip malformed frame
      }
    }
  }
  return frames;
}

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("SSE pipeline_step wire", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    vi.mocked(getSession).mockResolvedValue({ userId } as Awaited<ReturnType<typeof getSession>>);
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("emits step-0 running then completed bracketing the delta", async () => {
    vi.mocked(query).mockReturnValue(
      scriptedQuery([deltaMsg("hello")]) as ReturnType<typeof query>,
    );

    const res = await POST(makeReq({ userId, message: "hi" }));
    const frames = await readSseFrames(res.body);

    const eventSequence = frames.map((f) => f.event);
    expect(eventSequence[0]).toBe("pipeline_step");
    expect((frames[0].data as { id: string }).id).toBe("step-0");
    expect((frames[0].data as { status: string }).status).toBe("running");

    // Somewhere after: a delta with "hello"
    const deltaFrame = frames.find((f) => f.event === "delta");
    expect(deltaFrame).toBeDefined();

    // Last pipeline_step should mark step-0 completed
    const pipelineFrames = frames.filter((f) => f.event === "pipeline_step");
    const finalStep0 = [...pipelineFrames].reverse().find((f) => (f.data as { id: string }).id === "step-0");
    expect((finalStep0!.data as { status: string }).status).toBe("completed");

    // Terminal done event
    expect(frames.at(-1)?.event).toBe("done");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/chat-route/pipeline-sse.test.ts -t "step-0"`
Expected: PASS.

If it fails with "NextRequest body not available" or similar, the `NextRequest` constructor's `body` handling may need adjustment. Fallback: construct a `Request` directly, cast to `NextRequest`:

```ts
const req = new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}) as unknown as NextRequest;
```

- [ ] **Step 3: Commit**

```bash
git add tests/chat-route/pipeline-sse.test.ts
git commit -m "test(chat): SSE baseline step-0 running/completed frames"
```

---

## Task 12: Phase 3 — tool call classified + completed (regression-lock for 8077fe3)

**Files:**
- Modify: `tests/chat-route/pipeline-sse.test.ts`

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("tool_use emits a pipeline_step and tool_result flips it to completed", async () => {
    vi.mocked(query).mockReturnValue(
      scriptedQuery([
        toolUseMsg("tu-1", "search_records", { account: "Marketing" }),
        toolResultMsg("tu-1", '{"count":1}'),
        deltaMsg("Found 1 record."),
      ]) as ReturnType<typeof query>,
    );

    const res = await POST(makeReq({ userId, message: "search marketing" }));
    const frames = await readSseFrames(res.body);

    const toolFrames = frames.filter(
      (f) => f.event === "pipeline_step" && (f.data as { id: string }).id !== "step-0",
    );
    // One running + one completed
    expect(toolFrames.length).toBeGreaterThanOrEqual(2);

    const running = toolFrames.find((f) => (f.data as { status: string }).status === "running");
    const completed = toolFrames.find((f) => (f.data as { status: string }).status === "completed");
    expect(running).toBeDefined();
    expect(completed).toBeDefined();
    expect((running!.data as { label: string }).label).toBe("Searching financial records");
    expect((running!.data as { id: string }).id).toBe((completed!.data as { id: string }).id);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/chat-route/pipeline-sse.test.ts -t "tool_use emits"`
Expected: PASS (locks `8077fe3`).

- [ ] **Step 3: Commit**

```bash
git add tests/chat-route/pipeline-sse.test.ts
git commit -m "test(chat): tool_use step classified and completed on tool_result"
```

---

## Task 13: Phase 3 — tool error flips status to failed

**Files:**
- Modify: `tests/chat-route/pipeline-sse.test.ts`

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("tool_result with isError=true flips the step to failed", async () => {
    vi.mocked(query).mockReturnValue(
      scriptedQuery([
        toolUseMsg("tu-1", "search_records", {}),
        toolResultMsg("tu-1", "boom", true),
        deltaMsg("I got an error."),
      ]) as ReturnType<typeof query>,
    );

    const res = await POST(makeReq({ userId, message: "search" }));
    const frames = await readSseFrames(res.body);

    const failedFrame = frames.find(
      (f) =>
        f.event === "pipeline_step" &&
        (f.data as { status: string }).status === "failed",
    );
    expect(failedFrame).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/chat-route/pipeline-sse.test.ts -t "flips the step to failed"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/chat-route/pipeline-sse.test.ts
git commit -m "test(chat): tool error flips pipeline step to failed"
```

---

## Task 14: Phase 3 — order + id uniqueness across multiple tools

**Files:**
- Modify: `tests/chat-route/pipeline-sse.test.ts`

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("two tool calls produce four distinct pipeline_step frames with matching ids", async () => {
    vi.mocked(query).mockReturnValue(
      scriptedQuery([
        toolUseMsg("tu-1", "search_records", {}),
        toolResultMsg("tu-1", "r1"),
        toolUseMsg("tu-2", "analyze_financial_data", {}),
        toolResultMsg("tu-2", "r2"),
        deltaMsg("Done."),
      ]) as ReturnType<typeof query>,
    );

    const res = await POST(makeReq({ userId, message: "do both" }));
    const frames = await readSseFrames(res.body);

    // Exclude step-0 frames
    const tool = frames.filter(
      (f) => f.event === "pipeline_step" && (f.data as { id: string }).id !== "step-0",
    );
    // 2 running + 2 completed
    expect(tool.length).toBe(4);

    const running = tool.filter((f) => (f.data as { status: string }).status === "running");
    const completed = tool.filter((f) => (f.data as { status: string }).status === "completed");
    expect(running).toHaveLength(2);
    expect(completed).toHaveLength(2);

    // Each completed id matches a running id
    const runningIds = new Set(running.map((f) => (f.data as { id: string }).id));
    for (const c of completed) {
      expect(runningIds.has((c.data as { id: string }).id)).toBe(true);
    }
    // Running ids are distinct
    expect(runningIds.size).toBe(2);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/chat-route/pipeline-sse.test.ts -t "four distinct"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/chat-route/pipeline-sse.test.ts
git commit -m "test(chat): multiple tool calls produce distinct matched frames"
```

---

## Task 15: Phase 3 — orphan tool_result ignored

**Files:**
- Modify: `tests/chat-route/pipeline-sse.test.ts`

- [ ] **Step 1: Write the failing test**

Add:

```ts
  it("orphan tool_result without preceding tool_use emits no pipeline_step", async () => {
    vi.mocked(query).mockReturnValue(
      scriptedQuery([
        toolResultMsg("tu-ghost", "stray"),
        deltaMsg("Hmm."),
      ]) as ReturnType<typeof query>,
    );

    const res = await POST(makeReq({ userId, message: "test" }));
    const frames = await readSseFrames(res.body);

    const nonStep0 = frames.filter(
      (f) => f.event === "pipeline_step" && (f.data as { id: string }).id !== "step-0",
    );
    expect(nonStep0).toHaveLength(0);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/chat-route/pipeline-sse.test.ts -t "orphan tool_result"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/chat-route/pipeline-sse.test.ts
git commit -m "test(chat): orphan tool_result ignored by step wire"
```

---

## Task 16: Final verification

**Files:**
- None.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: 245 existing + 15 new (5 phase 1 + 4 phase 2 + 5 phase 3 + 1 helper with no tests) = 259-260 tests pass.

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage check.** Matching each spec requirement to a task:

- Phase 1 cold state → Task 1 ✓
- Phase 1 GL upload only → Task 2 ✓
- Phase 1 GL + sub-ledger → Task 3 ✓
- Phase 1 variance records present → Task 4 ✓
- Phase 1 quarterly key expansion → Task 5 ✓
- Phase 1 "phantom variance source fix" — this IS Task 4 (variance records present without `DataSource.type="variance"`). Spec mentions it as test 6; I collapsed it with the "variance records added" scenario in Task 4 because testing the same behavior from two angles is redundant.
- Phase 1 "After variance CSV upload" — covered by Task 4.
- Shared deleteTestUser helper → Task 0 ✓
- Phase 2 sanitization → Task 8 ✓
- Phase 2 upsert → Task 9 ✓
- Phase 2 empty body → Task 10 ✓
- Phase 2 period required → Task 10 ✓
- Phase 3 baseline step-0 → Task 11 ✓
- Phase 3 tool classified → Task 12 ✓
- Phase 3 tool error → Task 13 ✓
- Phase 3 order + id uniqueness → Task 14 ✓
- Phase 3 orphan tool_result → Task 15 ✓
- mock-query.ts → Task 7 ✓

**Spec gap**: spec listed 6 `it()` blocks for Phase 1; plan has 5 (I merged "variance records added" and "phantom variance source fix" into Task 4). Documenting this explicitly rather than adding a redundant test. If you want both kept separate let me know at review time.

**2. Placeholder scan.** No TBD/TODO. All code shown inline. Error paths show expected exact error messages.

**3. Type consistency.** `deltaMsg`, `toolUseMsg`, `toolResultMsg`, `scriptedQuery` defined in Task 7, used consistently in Tasks 8-15. `deleteTestUser` defined in Task 0, used in Tasks 1, 8, 11. `readSseFrames` defined inline in Task 11, used in Tasks 12-15. No drift.

**4. Execution risks.** Two potential trip points worth flagging:
- Task 8 may need `process.env.LYZR_API_KEY = "test-dummy"` if `ensureApiKey` trips (already noted in Task 8 Step 2).
- Task 11 NextRequest constructor might need the `Request` fallback (already noted in Task 11 Step 2).
Both have fallback instructions included.
