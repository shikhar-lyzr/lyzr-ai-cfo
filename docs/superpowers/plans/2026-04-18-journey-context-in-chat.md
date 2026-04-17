# Journey-aware chat context — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user chats from a journey page, prepend a journey-specific context section to the agent prompt so it sees what the user sees, and deprioritize (but keep) cross-journey context.

**Architecture:** A tiny registry (`lib/agent/journey-context/`) maps `journeyId → builder`. One live builder for `financial-reconciliation` (pulls stats + top-5 breaks from existing helpers in `lib/reconciliation/stats.ts`). Static journeys fall through to a placeholder string using a title map. `chatWithAgent` and `buildContext` take an optional `journeyId`; `/api/chat` reads it from the body and threads it through. When `journeyId` is set, the generic "Open Actions" block collapses to a severity breakdown so the prompt stays journey-first.

**Tech Stack:** TypeScript, Next.js 16 (Turbopack), Prisma, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-18-journey-context-in-chat-design.md`

---

## Context for the implementer

- `chatWithAgent` lives in [lib/agent/index.ts:221](lib/agent/index.ts#L221).
- `buildContext` lives in [lib/agent/index.ts:101](lib/agent/index.ts#L101) and returns the `systemPromptSuffix` passed to `query()`.
- `/api/chat` route: [app/api/chat/route.ts:11](app/api/chat/route.ts#L11).
- The client already sends `journeyId` in the body: [hooks/use-chat-stream.ts:47](hooks/use-chat-stream.ts#L47).
- Existing stats helpers: `getReconciliationStats(userId)` and `getTopBreaks(userId, limit)` in [lib/reconciliation/stats.ts](lib/reconciliation/stats.ts). `getReconciliationStats` returns `{ hasData: false }` OR `{ hasData: true, matchRate, openBreakCount, openBreakValue, oldestBreakDays, glOnly, subOnly, lastRunAt }`. `getTopBreaks` returns rows with fields `{ id, side, entryId, baseAmount, txnCurrency, ageDays, severity }`.
- Prisma schema: `MatchRun` uses `startedAt` and `triggeredBy` (not `createdAt`/`trigger`). `Break` has `severity`, `severityRank`, `ageDays`, `side`, `baseAmount`, `txnCurrency`. Counterparty/reference live on `GLEntry`/`SubLedgerEntry`, not on `Break` — out of scope.
- Vitest is already configured; DB-backed tests use a real Neon connection, so budget ~30s timeouts per DB test (see `lib/reconciliation/__tests__/persist.test.ts` for the pattern).

---

## Task 1 — Registry, title map, placeholder builder

**Files:**
- Create: `lib/agent/journey-context/index.ts`
- Test: `lib/agent/journey-context/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/journey-context/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { buildJourneyContext, JOURNEY_TITLES } from "../index";

describe("journey-context registry", () => {
  it("returns null when journeyId is undefined", async () => {
    expect(await buildJourneyContext("user-1", undefined)).toBeNull();
  });

  it("returns null when journeyId is empty string", async () => {
    expect(await buildJourneyContext("user-1", "")).toBeNull();
  });

  it("returns placeholder for known static journey", async () => {
    const out = await buildJourneyContext("user-1", "monthly-close");
    expect(out).toContain("## Current Journey: Monthly Close");
    expect(out).toContain("demo placeholder");
  });

  it("returns placeholder for unknown journey with the id as title", async () => {
    const out = await buildJourneyContext("user-1", "fake-journey");
    expect(out).toContain("## Current Journey: fake-journey");
    expect(out).toContain("demo placeholder");
  });

  it("exports JOURNEY_TITLES for all six known journeys", () => {
    expect(JOURNEY_TITLES["financial-reconciliation"]).toBe("Financial Reconciliation");
    expect(JOURNEY_TITLES["monthly-close"]).toBe("Monthly Close");
    expect(JOURNEY_TITLES["daily-liquidity"]).toBe("Daily Liquidity");
    expect(JOURNEY_TITLES["ifrs9-ecl"]).toBe("IFRS 9 ECL");
    expect(JOURNEY_TITLES["regulatory-capital"]).toBe("Regulatory Capital");
    expect(JOURNEY_TITLES["regulatory-returns"]).toBe("Regulatory Returns");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/agent/journey-context/__tests__/registry.test.ts`
Expected: FAIL — module `../index` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/agent/journey-context/index.ts
export type JourneyContextBuilder = (userId: string) => Promise<string>;

export const JOURNEY_TITLES: Record<string, string> = {
  "financial-reconciliation": "Financial Reconciliation",
  "monthly-close": "Monthly Close",
  "daily-liquidity": "Daily Liquidity",
  "ifrs9-ecl": "IFRS 9 ECL",
  "regulatory-capital": "Regulatory Capital",
  "regulatory-returns": "Regulatory Returns",
};

const BUILDERS: Record<string, JourneyContextBuilder> = {};

export async function buildJourneyContext(
  userId: string,
  journeyId: string | undefined
): Promise<string | null> {
  if (!journeyId) return null;
  const builder = BUILDERS[journeyId];
  if (builder) return builder(userId);
  const title = JOURNEY_TITLES[journeyId] ?? journeyId;
  return `## Current Journey: ${title}\nThis is a demo placeholder page — no live backing data. Answer conceptually or redirect the user to journeys with real data (Financial Reconciliation).`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/agent/journey-context/__tests__/registry.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/journey-context/index.ts lib/agent/journey-context/__tests__/registry.test.ts
git commit -m "feat(agent): journey-context registry with static placeholders"
```

---

## Task 2 — Reconciliation builder (live)

**Files:**
- Create: `lib/agent/journey-context/financial-reconciliation.ts`
- Modify: `lib/agent/journey-context/index.ts` (register builder)
- Test: `lib/agent/journey-context/__tests__/financial-reconciliation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/journey-context/__tests__/financial-reconciliation.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { buildReconciliationContext } from "../financial-reconciliation";

describe("buildReconciliationContext", { timeout: 30_000 }, () => {
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

  it("returns 'no match run yet' when user has no match run", async () => {
    const out = await buildReconciliationContext(userId);
    expect(out).toContain("## Current Journey: Financial Reconciliation");
    expect(out).toContain("No match run yet");
  });

  it("returns stats + 'all resolved' footer when zero open breaks", async () => {
    await prisma.matchRun.create({
      data: {
        userId, triggeredBy: "manual", strategyConfig: {},
        totalGL: 10, totalSub: 10, matched: 10, partial: 0, unmatched: 0,
        startedAt: new Date(),
      },
    });
    const out = await buildReconciliationContext(userId);
    expect(out).toContain("Match rate: 100.0%");
    expect(out).toContain("Open breaks: 0");
    expect(out).toContain("All breaks resolved");
    expect(out).not.toContain("Top ");
  });

  it("returns stats + top-5 list when breaks exist", async () => {
    const run = await prisma.matchRun.create({
      data: {
        userId, triggeredBy: "upload", strategyConfig: {},
        totalGL: 10, totalSub: 10, matched: 7, partial: 0, unmatched: 3,
        startedAt: new Date(),
      },
    });
    // Seed 6 open breaks — builder should show top 5 by severityRank desc.
    for (let i = 0; i < 6; i++) {
      await prisma.break.create({
        data: {
          matchRunId: run.id, side: i % 2 === 0 ? "gl_only" : "sub_only",
          entryId: `fake-${i}`, amount: 1000 * (i + 1), baseAmount: 1000 * (i + 1),
          txnCurrency: "USD", ageDays: 10 * (i + 1), ageBucket: "0-30",
          severity: i < 2 ? "high" : i < 4 ? "medium" : "low",
          severityRank: i < 2 ? 3 : i < 4 ? 2 : 1,
          status: "open",
        },
      });
    }
    const out = await buildReconciliationContext(userId);
    expect(out).toContain("Match rate: 70.0%");
    expect(out).toContain("Open breaks: 6");
    expect(out).toContain("### Top 5 open breaks");
    expect(out).toMatch(/\[HIGH\]/);
    // Exactly 5 bullet lines
    const bullets = out.split("\n").filter((l) => l.startsWith("- ["));
    expect(bullets).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/agent/journey-context/__tests__/financial-reconciliation.test.ts`
Expected: FAIL — module `../financial-reconciliation` does not exist.

- [ ] **Step 3: Write the builder**

```ts
// lib/agent/journey-context/financial-reconciliation.ts
import { getReconciliationStats, getTopBreaks } from "@/lib/reconciliation/stats";

export async function buildReconciliationContext(userId: string): Promise<string> {
  const stats = await getReconciliationStats(userId);

  if (!stats.hasData) {
    return `## Current Journey: Financial Reconciliation\nNo match run yet — user needs to upload a GL CSV and a sub-ledger CSV to kick off reconciliation.`;
  }

  const ageText = humanizeAge(stats.lastRunAt);

  const header =
    `## Current Journey: Financial Reconciliation\n` +
    `Match rate: ${(stats.matchRate * 100).toFixed(1)}%   ` +
    `Open breaks: ${stats.openBreakCount} ($${stats.openBreakValue.toLocaleString()})   ` +
    `Oldest: ${stats.oldestBreakDays}d\n` +
    `GL-only: ${stats.glOnly}   Sub-only: ${stats.subOnly}\n` +
    `Last match run: ${ageText}`;

  if (stats.openBreakCount === 0) {
    return `${header}\nAll breaks resolved. Nothing outstanding.`;
  }

  const top = await getTopBreaks(userId, 5);
  const lines = top
    .map(
      (b) =>
        `- [${b.severity.toUpperCase()}]  $${Math.abs(b.baseAmount).toLocaleString()} ${b.txnCurrency}  ${b.side}  ${b.ageDays}d`
    )
    .join("\n");

  return `${header}\n\n### Top ${top.length} open breaks\n${lines}`;
}

function humanizeAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 4: Register the builder**

Edit `lib/agent/journey-context/index.ts`:

```ts
// Add import at top:
import { buildReconciliationContext } from "./financial-reconciliation";

// Replace `const BUILDERS: Record<string, JourneyContextBuilder> = {};`
// with:
const BUILDERS: Record<string, JourneyContextBuilder> = {
  "financial-reconciliation": buildReconciliationContext,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/agent/journey-context/`
Expected: PASS across both test files (registry: 5, reconciliation: 3).

- [ ] **Step 6: Commit**

```bash
git add lib/agent/journey-context/financial-reconciliation.ts lib/agent/journey-context/__tests__/financial-reconciliation.test.ts lib/agent/journey-context/index.ts
git commit -m "feat(agent): live journey context for financial-reconciliation"
```

---

## Task 3 — Thread journeyId through buildContext and chatWithAgent

**Files:**
- Modify: `lib/agent/index.ts` (buildContext signature + body, chatWithAgent signature)
- Test: `lib/agent/__tests__/build-context.test.ts`

Note: `buildContext` is currently not exported. Export it for testability.

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/__tests__/build-context.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { buildContext } from "../index";

describe("buildContext journey wiring", { timeout: 30_000 }, () => {
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
    // Seed 3 pending actions with mixed severities.
    await prisma.action.createMany({
      data: [
        { userId, type: "variance", severity: "high",   headline: "A1", detail: "d", driver: "x" },
        { userId, type: "variance", severity: "medium", headline: "A2", detail: "d", driver: "x" },
        { userId, type: "variance", severity: "low",    headline: "A3", detail: "d", driver: "x" },
      ],
    });
  });

  it("without journeyId: full Open Actions list, no journey header", async () => {
    const ctx = await buildContext(userId);
    expect(ctx).not.toContain("## Current Journey");
    expect(ctx).toContain("## Open Actions (3)");
    expect(ctx).toContain("A1");
    expect(ctx).toContain("A2");
    expect(ctx).toContain("A3");
  });

  it("with journeyId: journey header first, Open Actions collapsed to counts", async () => {
    const ctx = await buildContext(userId, undefined, "financial-reconciliation");
    expect(ctx).toMatch(/^## Current Journey: Financial Reconciliation/);
    expect(ctx).toContain("## Open Actions (3)");
    expect(ctx).toContain("high: 1");
    expect(ctx).toContain("medium: 1");
    expect(ctx).toContain("low: 1");
    expect(ctx).not.toContain("A1");
    expect(ctx).not.toContain("A2");
    expect(ctx).not.toContain("A3");
  });

  it("with unknown journeyId: placeholder header, Open Actions still collapsed", async () => {
    const ctx = await buildContext(userId, undefined, "monthly-close");
    expect(ctx).toContain("## Current Journey: Monthly Close");
    expect(ctx).toContain("## Open Actions (3)");
    expect(ctx).toContain("high: 1");
    expect(ctx).not.toContain("A1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/agent/__tests__/build-context.test.ts`
Expected: FAIL — `buildContext` not exported, or signature mismatch.

- [ ] **Step 3: Edit `lib/agent/index.ts` — add import**

At the top of the file (with other imports):

```ts
import { buildJourneyContext } from "./journey-context";
```

- [ ] **Step 4: Edit `buildContext` signature and body**

Find the function declared around line 101. Change the signature and the Open Actions block:

```ts
// Replace: async function buildContext(userId: string, actionId?: string): Promise<string> {
// With:
export async function buildContext(
  userId: string,
  actionId?: string,
  journeyId?: string
): Promise<string> {
  const [dataSources, pendingActions, recentMessages, actionEvents] = await Promise.all([
    // ...existing prisma calls, unchanged...
  ]);

  const parts: string[] = [];

  // Journey context first (additive + deprioritize)
  const journey = await buildJourneyContext(userId, journeyId);
  if (journey) parts.push(journey);

  // Data sources (unchanged)
  if (dataSources.length > 0) {
    parts.push(
      "## Active Data Sources\n" +
        dataSources
          .map((ds) => `- ${ds.name} (${ds.recordCount} records, ID: ${ds.id})`)
          .join("\n")
    );
  } else {
    parts.push(
      "## No Data Sources\nThe user has not uploaded any financial data yet. Suggest they upload a CSV with budget vs actual figures."
    );
  }

  // Open actions — collapse to severity breakdown when a journey is active.
  if (pendingActions.length > 0) {
    if (journey) {
      const bySev = { high: 0, medium: 0, low: 0 } as Record<string, number>;
      for (const a of pendingActions) bySev[a.severity] = (bySev[a.severity] ?? 0) + 1;
      parts.push(
        `## Open Actions (${pendingActions.length})\n` +
          `Breakdown — high: ${bySev.high ?? 0}, medium: ${bySev.medium ?? 0}, low: ${bySev.low ?? 0}. ` +
          `Call \`list_actions\` if specifics are needed.`
      );
    } else {
      parts.push(
        "## Open Actions (" +
          pendingActions.length +
          ")\n" +
          pendingActions
            .map(
              (a) =>
                `- [${a.severity.toUpperCase()}] ${a.headline}: ${a.detail} (ID: ${a.id})`
            )
            .join("\n")
      );
    }
  }

  // ...rest of function unchanged (Specific action context, Recent Chat History, Recent User Decisions, SKILL_CONTENT)...
  return parts.join("\n\n");
}
```

- [ ] **Step 5: Edit `chatWithAgent` signature**

Find `chatWithAgent` around line 221 and add the optional options parameter:

```ts
export async function chatWithAgent(
  userId: string,
  message: string,
  actionId: string | undefined,
  callbacks: AgentStreamCallbacks,
  opts?: { journeyId?: string }
): Promise<void> {
  ensureApiKey();

  const context = await buildContext(userId, actionId, opts?.journeyId);
  // ...rest unchanged
}
```

- [ ] **Step 6: Run build-context test to verify it passes**

Run: `npx vitest run lib/agent/__tests__/build-context.test.ts`
Expected: PASS (3/3).

- [ ] **Step 7: Run full suite to verify nothing regressed**

Run: `npx vitest run`
Expected: all files green.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (no output).

- [ ] **Step 9: Commit**

```bash
git add lib/agent/index.ts lib/agent/__tests__/build-context.test.ts
git commit -m "feat(agent): thread journeyId into context; collapse open actions when journey active"
```

---

## Task 4 — /api/chat route: read and pass journeyId, journey-aware fallback

**Files:**
- Modify: `app/api/chat/route.ts`

No DB test for this route — the route is a thin pass-through and the behavior is covered by Task 3 tests. Verification is via a live curl against the dev server in Task 5.

- [ ] **Step 1: Edit imports in `app/api/chat/route.ts`**

Add next to the other imports:

```ts
import { JOURNEY_TITLES } from "@/lib/agent/journey-context";
```

- [ ] **Step 2: Edit body destructure and agent call**

Replace the destructure line:

```ts
// Before:
const { userId, message, actionId } = body;
// After:
const { userId, message, actionId, journeyId } = body;
```

Replace the `chatWithAgent` call inside `if (agentAvailable) { ... }`:

```ts
await chatWithAgent(userId, message, actionId, {
  onDelta: (text) => {
    fullResponse += text;
    sseWrite(controller, encoder, "delta", { text });
  },
  onComplete: async (text) => {
    await finish(text || fullResponse);
  },
  onError: async (errorMsg) => {
    sseWrite(controller, encoder, "error", { error: errorMsg });
    await finish(fullResponse || `Error: ${errorMsg}`);
  },
}, { journeyId });
```

- [ ] **Step 3: Edit the no-API-key fallback**

Inside the `else` branch of `if (agentAvailable)`, replace the line that builds `fullResponse` from `recentActions.length`. The current code is approximately:

```ts
fullResponse = `I've reviewed your financial data. Currently there are ${recentActions.length} open items in your actions feed. What specific area would you like me to analyze?`;
```

Change to:

```ts
const journeyTitle = journeyId ? (JOURNEY_TITLES[journeyId] ?? journeyId) : null;
fullResponse = journeyTitle
  ? `You're on the ${journeyTitle} journey. AI engine isn't configured — set OPENAI_API_KEY, LYZR_API_KEY, or GEMINI_API_KEY to enable analysis.`
  : `I've reviewed your financial data. Currently there are ${recentActions.length} open items in your actions feed. What specific area would you like me to analyze?`;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Build**

Run: `node --max-old-space-size=4096 node_modules/next/dist/bin/next build`
Expected: `✓ Compiled successfully`, all pages generated without error.

- [ ] **Step 6: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(chat): read journeyId from body; journey-aware fallback copy"
```

---

## Task 5 — End-to-end verification against live agent

**Files:**
- None (verification only — do not commit verification artifacts)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background).

Wait for `✓ Ready`. If `:3000` is already bound by an earlier run, stop it first (`taskkill //PID <pid> //F` on Windows).

- [ ] **Step 2: Pick a test user**

Find a user with a seeded reconciliation match run. If there isn't one in the current DB, run:

```bash
npx tsx scripts/seed-recon-for.ts <userId>
```

(existing helper from earlier in this branch). Or pick any userId from `prisma.user.findMany()` that already has `matchRuns > 0`.

- [ ] **Step 3: Curl without journeyId (baseline)**

```bash
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","message":"what is going on with my data?"}' | head -50
```

Expected: streamed SSE. Response text should mention generic data sources / open actions (no reconciliation framing).

- [ ] **Step 4: Curl WITH journeyId**

```bash
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","message":"what is going on with my data?","journeyId":"financial-reconciliation"}' | head -50
```

Expected: streamed SSE. Response text references match rate / breaks / reconciliation journey — not a generic "open items in your actions feed" blurb.

- [ ] **Step 5: Curl WITH journeyId for a static journey**

```bash
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","message":"what is going on with my data?","journeyId":"monthly-close"}' | head -50
```

Expected: response acknowledges the user is on the Monthly Close journey but redirects to journeys with live data (per the placeholder prompt).

- [ ] **Step 6: Browser sanity check**

Log in as that user, open `/financial-reconciliation`, expand the chat, send "why is match rate what it is?" and "show me the biggest break." Responses should reference real match-run numbers.

- [ ] **Step 7: Stop dev server**

On Windows: `taskkill //PID <pid> //F`.

---

## Post-implementation

- [ ] Run full test suite one more time: `npx vitest run` — expect all green.
- [ ] Run build one more time: `node --max-old-space-size=4096 node_modules/next/dist/bin/next build` — expect green.
- [ ] Update memory if anything surprising surfaced (per the auto-memory rules). Not required.

---

## Self-review notes (pre-handoff)

- Spec coverage: registry (Task 1), live reconciliation builder (Task 2), context wiring + Open Actions collapse (Task 3), route plumbing + fallback (Task 4), verification (Task 5). Every section of the spec maps to a task.
- Placeholder scan: no TBD/TODO, every code step has complete code.
- Type consistency: `buildJourneyContext` returns `Promise<string | null>` consistently; `buildContext` third param is `journeyId?: string` consistently; `chatWithAgent` options are `{ journeyId?: string }` consistently across Tasks 3 and 4.
- Schema cross-check: `MatchRun.triggeredBy`/`startedAt` (not `trigger`/`createdAt`); `Break.severity`/`severityRank`/`ageDays`/`side`/`baseAmount`/`txnCurrency` — all confirmed in `prisma/schema.prisma` lines 183–240.
