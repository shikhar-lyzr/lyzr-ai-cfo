# Journey-aware chat context — design

Date: 2026-04-18
Author: brainstormed with Shikhar

## Problem

When the user opens the chat box on a journey page (e.g. `/financial-reconciliation`), the agent replies as if it's the generic dashboard assistant. Observed: the reconciliation-page chat talked about variance actions in the action centre, unaware of match runs or breaks.

Root cause traced: the client sends `journeyId` in the `/api/chat` body, but the route never reads it; `chatWithAgent` has no journey parameter; `buildContext` pulls a generic "all data sources + all pending actions" prompt with no journey-specific signal.

## Goal

Ship journey-aware chat context so the agent knows where the user is and what's on their screen, without losing visibility into cross-domain state.

## Out of scope

- Per-journey tool sets (the reconciliation tools are already gated elsewhere).
- Rewriting the chat UI.
- Building live context for the five static demo journeys — they get a placeholder string only.

## Architecture

Four edits, two new files:

- **New** `lib/agent/journey-context/index.ts` — registry + dispatcher.
- **New** `lib/agent/journey-context/financial-reconciliation.ts` — the one live builder.
- **Edit** `lib/agent/index.ts` — thread `journeyId` into `buildContext` and `chatWithAgent`.
- **Edit** `app/api/chat/route.ts` — read `journeyId` from body, pass through, journey-aware fallback text.

Client is untouched — it already sends `journeyId`.

### Registry

```ts
// lib/agent/journey-context/index.ts
export type JourneyContextBuilder = (userId: string) => Promise<string>;

const JOURNEY_TITLES: Record<string, string> = {
  "financial-reconciliation": "Financial Reconciliation",
  "monthly-close": "Monthly Close",
  "daily-liquidity": "Daily Liquidity",
  "ifrs9-ecl": "IFRS 9 ECL",
  "regulatory-capital": "Regulatory Capital",
  "regulatory-returns": "Regulatory Returns",
};

const BUILDERS: Record<string, JourneyContextBuilder> = {
  "financial-reconciliation": buildReconciliationContext,
};

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

### Reconciliation builder

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
```

The exact break-line format is best-effort; `getTopBreaks` returns a known select shape (`severity`, `side`, `baseAmount`, `txnCurrency`, `ageDays`, `entryId`). Counterparty and reference aren't in the current select — if they're needed in the prompt, step 1 of the plan will extend the select. Trigger field on MatchRun was dropped from the header since `getReconciliationStats` doesn't return it; can be added later if useful.

### Wiring into agent

```ts
// lib/agent/index.ts
export async function chatWithAgent(
  userId: string,
  message: string,
  actionId: string | undefined,
  callbacks: AgentStreamCallbacks,
  opts?: { journeyId?: string }
): Promise<void> {
  // ...
  const context = await buildContext(userId, actionId, opts?.journeyId);
  // ... rest unchanged
}

async function buildContext(
  userId: string,
  actionId?: string,
  journeyId?: string
): Promise<string> {
  const parts: string[] = [];

  // 1. Journey context first (additive + deprioritize)
  const journey = await buildJourneyContext(userId, journeyId);
  if (journey) parts.push(journey);

  // 2. Data sources (unchanged)
  // ... existing block ...

  // 3. Open actions — if journey is active, collapse to counts-by-severity; otherwise full list
  if (pendingActions.length > 0) {
    if (journey) {
      const bySev = countBySeverity(pendingActions);
      parts.push(
        `## Open Actions (${pendingActions.length})\nBreakdown — high: ${bySev.high}, medium: ${bySev.medium}, low: ${bySev.low}. Call \`list_actions\` if specifics are needed.`
      );
    } else {
      // existing full-list rendering
    }
  }

  // 4. Action context, chat history — unchanged
  return parts.join("\n\n");
}
```

### Route and fallback

```ts
// app/api/chat/route.ts
const { userId, message, actionId, journeyId } = body;
// ...
await chatWithAgent(userId, message, actionId, callbacks, { journeyId });

// fallback path (no API key):
const journeyTitle = journeyId ? JOURNEY_TITLES[journeyId] : null;
fullResponse = journeyTitle
  ? `You're on the ${journeyTitle} journey. AI engine isn't configured — set OPENAI_API_KEY, LYZR_API_KEY, or GEMINI_API_KEY to enable analysis.`
  : `I've reviewed your financial data. Currently there are ${recentActions.length} open items in your actions feed. What specific area would you like me to analyze?`;
```

`JOURNEY_TITLES` is exported from the registry so the fallback can reuse it.

## Data flow

1. User clicks "Ask about this journey" on `/financial-reconciliation`.
2. `JourneyChatPanel` calls `sendMessage(msg, { journeyId: "financial-reconciliation" })`.
3. `useChatStream` posts `{ userId, message, journeyId }` to `/api/chat`.
4. Route reads `journeyId`, calls `chatWithAgent(..., { journeyId })`.
5. `chatWithAgent` calls `buildContext(userId, actionId, journeyId)`.
6. `buildContext` calls `buildJourneyContext` → returns the reconciliation section, which prepends the prompt. Generic "Open Actions" collapses to counts.
7. Agent streams a grounded response.

## Testing

- `lib/agent/journey-context/__tests__/financial-reconciliation.test.ts`
  - No match run → placeholder string.
  - Match run with breaks → stats line + top-5 list shape.
  - Match run with zero open breaks → stats line + "All breaks resolved" footer, no top-N section.
- `lib/agent/journey-context/__tests__/registry.test.ts`
  - Unknown `journeyId` → minimal placeholder with correct title for the six known static journeys.
  - `journeyId` undefined → returns `null`.
- `lib/agent/__tests__/build-context.test.ts`
  - With `journeyId`: output begins with `## Current Journey`, and the Open Actions section is the collapsed count form.
  - Without `journeyId`: preserves current output (no journey header, full Open Actions list).

No new `/api/chat` route test — existing route tests mock the agent; journey wiring is a parameter pass-through and is covered by the `build-context` unit test.

## Files changed

- `lib/agent/journey-context/index.ts` (new)
- `lib/agent/journey-context/financial-reconciliation.ts` (new)
- `lib/agent/journey-context/__tests__/financial-reconciliation.test.ts` (new)
- `lib/agent/journey-context/__tests__/registry.test.ts` (new)
- `lib/agent/__tests__/build-context.test.ts` (new)
- `lib/agent/index.ts` (edit — `chatWithAgent` and `buildContext` signatures, Open Actions collapse)
- `app/api/chat/route.ts` (edit — destructure `journeyId`, pass through, journey-aware fallback)

## Risks

- `humanizeAge(date)` utility doesn't exist yet — trivial local helper to write (returns "2h ago", "3d ago", etc.).
- If product wants counterparty/reference in the break lines, step 1 of the plan extends the `getTopBreaks` select rather than adding a second query.
