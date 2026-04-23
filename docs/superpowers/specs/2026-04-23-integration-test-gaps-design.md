# Integration-Test Gaps — Design

**Date:** 2026-04-23
**Author:** Shikhar + Claude
**Status:** proposed

## Context

The session of 2026-04-22 landed 13 bug fixes across monthly-close, upload, documents, chat, and agent paths (see commits `10bd86a` through `8077fe3`). All have unit tests. None have integration coverage at three load-bearing seams:

1. **Upload → recon → close-readiness (DB layer).** The stats and task functions (`getCloseReadiness`, `getCloseBlockers`, `deriveTaskCounts`) are unit-tested against mocked Prisma but never exercised end-to-end against a real database with real ingestion. A schema or Prisma-query drift would ship undetected.
2. **Close-package LLM response handling.** The narration stripper (`sanitizeReportBody`), upsert-on-regenerate, empty-body guard, and period-required guard have unit tests for the sanitizer function in isolation but no test of `generateReport` as a whole. A regression in the prompt → `query()` → sanitize → persist pipeline would ship undetected.
3. **SSE pipeline_step wire.** The newly added `onStep` callback flows `tool_use` / `tool_result` messages from `chatWithAgent` through to the chat route's `sseWrite("pipeline_step", ...)`. The server halves are type-correct and match the client SSE consumer, but nothing verifies the bytes on the wire.

This document specifies how to close those three gaps.

## Goals

- Catch regressions in the three paths above before they ship
- Follow the existing integration-test conventions rather than invent new infrastructure
- Make failure messages specific enough that a future reader knows which layer broke without reading the test internals

## Non-Goals

- Load testing or parallel-execution tuning of integration tests
- Cleanup of historical `@test.local` test users on the Neon branch (separate one-shot concern)
- Client-side SSE consumer tests (`hooks/use-chat-stream.ts`)
- Real Lyzr API calls — `query()` from gitclaw is mocked in phases 2 and 3
- Changes to the production code paths under test
- Migration to a dedicated test database

## Phased Delivery

One implementation plan, three clearly-separated phases. Each phase is shippable on its own. Phase 2 and 3 share a helper module (`tests/agent/mock-query.ts`) introduced in phase 2.

### Phase 1 — close-readiness upload integration

**File:** `tests/integration/close-readiness-upload.test.ts`

**Infra:** real Neon, matches existing `lib/reconciliation/__tests__/persist.test.ts` pattern.

- `beforeEach`: create a throwaway user, seed nothing else.
- `afterEach`: delete the test user's rows in dependency order. `User` → children are **not** cascade-configured in this schema (Prisma default is `NO ACTION`; `ReconPeriod.userId` is explicitly `onDelete: Restrict`). A naive `prisma.user.delete(...)` fails with an FK violation. The cleanup sequence is:
  1. Delete `ActionEvent`, `ChatMessage` (reference `userId` and `Action`)
  2. Delete `Action` (references `userId`)
  3. Delete `MatchLink`, `Break` — will cascade from deleting `MatchRun`
  4. Delete `MatchRun` (references `userId`)
  5. Delete `Document` (references `userId`)
  6. Delete `JournalAdjustment` (references `userId`)
  7. Delete `ReconPeriod` (references `userId`, `Restrict` so must be explicit)
  8. Delete `DataSource` (references `userId`) — cascades to `FinancialRecord`, `Invoice`, `GLEntry`, `SubLedgerEntry` via the FK rules added in migration `20260422045930_upload_dedup_cascade`
  9. Delete `User`

  Extract this into a shared helper `tests/integration/cleanup.ts::deleteTestUser(userId)` so future integration tests reuse it without reinventing the order.
- Vitest timeout: `30_000` ms per test (matches existing integration tests).

**Seeding style:** direct Prisma writes for every fixture — `prisma.dataSource.create`, `prisma.gLEntry.createMany`, `prisma.matchRun.create` (with pre-computed `matched`/`totalGL`/`totalSub` counts), etc. No invocation of `POST /api/upload` or `saveMatchRun`. The value here is testing that `getCloseReadiness` / `getCloseBlockers` / `deriveTaskCounts` reads match the shape that ingestion writes. Going through the upload route or the match engine would drag Next.js route-handler plumbing and the match strategy into scope without increasing coverage of the close logic — and would make failures harder to attribute.

**`it()` blocks (6):**

1. *Cold state*: no sources, no records → `hasData: false`; `getCloseBlockers` returns empty; `deriveTaskCounts` returns 5 cards with `isEmpty: true`.
2. *GL upload only*: seed one `DataSource(type: "gl")` + 10 `GLEntry` rows in `2026-04` + a `MatchRun` with `matched: 0`. Assert `matchRate: 0`, `freshnessPenalty: 2/3` (sub_ledger + variance missing). Task card "GL Entries" populates.
3. *GL + sub-ledger upload*: add `DataSource(type: "sub_ledger")` + matched entries + updated `MatchRun(matched: 10, totalGL: 10, totalSub: 10)`. Assert `matchRate: 1.0`, `freshnessPenalty: 1/3` (variance still missing). Sub-ledger card populates.
4. *Variance records added*: add `FinancialRecord` rows for the period under a `DataSource(type: "csv", metadata: {shape: "variance"})`. Assert `freshnessPenalty: 0`; `variancePenalty` reflects the record data's deviation from `VARIANCE_THRESHOLD`.
5. *Quarterly key expansion*: seed three `MatchRun` rows under `2026-01`, `2026-02`, `2026-03`, each with its own GL/Sub entries. Call `getCloseReadiness(userId, "2026-Q1")`. Assert `matchRate` aggregates across the three runs (weighted by entry totals), and that `pickLatestRunsPerPeriod` returned three ids (observable via the resulting open-break lookup).
6. *Phantom variance source fix*: seed a `DataSource(type: "csv", metadata: {shape: "variance"})` + `FinancialRecord` rows + GL + sub-ledger. Assert no "missing variance" blocker in `getCloseBlockers`, and `freshnessPenalty` treats variance as present. Regression-lock for commit `b86e262`.

### Phase 2 — close_package response snapshot

**File:** `tests/agent/close-package-response.test.ts`

**Infra:** `vi.mock("gitclaw", () => ({ query: vi.fn(), tool: vi.fn((name, desc, schema, handler) => ({ name, description: desc, inputSchema: schema, handler })) }))`. Mocked `query()` returns a scripted `AsyncIterable<GCMessage>` built from the `mock-query.ts` factories.

**Fixture:** throwaway user + minimal seed (one `ReconPeriod`, one `DataSource` with a few `FinancialRecord` rows under the target period) — just enough that `getCloseReadiness` returns `hasData: true`. Matches same cleanup pattern as Phase 1.

**Shared helper `tests/agent/mock-query.ts`:**

```ts
export function deltaMsg(text: string): GCMessage
export function assistantMsg(content: string, stopReason?: string): GCMessage
export function toolUseMsg(id: string, toolName: string, args?: unknown): GCMessage
export function toolResultMsg(toolUseId: string, text: string, isError?: boolean): GCMessage
export function systemErrorMsg(content: string): GCMessage

export function scriptedQuery(messages: GCMessage[]): Query
```

`scriptedQuery` returns an `AsyncIterable<GCMessage>` that yields the provided messages in order and completes. No timing simulation.

**`it()` blocks (4):**

1. *Sanitization applied*: mocked `query()` returns `[deltaMsg("The 2026-Q1 Monthly Close Package Report has been generated and saved. You can refer to artifact ID 2711d04f-ef12-4660-ad5f-028f79a2d993 for the full markdown content.\n\n# Monthly Close Package — 2026-Q1\n\nReal content here.")]`. Call `generateReport(userId, "close_package", "2026-Q1")`. Read back `Document.body`. Assert it does NOT contain `"artifact ID"` or `"has been generated and saved"`, DOES contain `"# Monthly Close Package — 2026-Q1"` and `"Real content here"`.
2. *Upsert on regenerate*: call `generateReport` twice with two different scripted outputs. Assert exactly one `Document` row exists for `(userId, "close_package", "2026-Q1")`; body matches the second call's content. Regression-lock for commit `7510b19`.
3. *Empty body throws*: scripted query emits a delta containing only whitespace → `generateReport` rejects with `"close_package generation returned empty body"`. Assert `Document` count is 0 (no partial row persisted). Regression-lock for `04a8696`.
4. *Period required*: `generateReport(userId, "close_package", undefined)` rejects before calling `query()`. Assert `vi.mocked(query)` was not called. Regression-lock for `ebc32ae`.

### Phase 3 — SSE pipeline_step wire

**File:** `tests/chat-route/pipeline-sse.test.ts`

**Infra:**
- `vi.mock("gitclaw")` with scripted `query()` via `mock-query.ts`
- `vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))` so the route can read a stubbed session
- Import `POST` directly from `app/api/chat/route.ts` and invoke with a hand-built `NextRequest`
- Drain `Response.body` with a local SSE parser into `Array<{ event, data }>` for assertions

**Fixture:** throwaway user (chat route persists `ChatMessage` rows). `getSession` mock returns `{ userId }`. afterEach deletes the user + its chat messages.

**SSE parser** (inline helper in this file only):
```ts
async function readSseFrames(body: ReadableStream<Uint8Array>): Promise<Array<{ event: string; data: unknown }>>
```
Decodes chunks, splits on `\n\n`, parses `event:` + `data:` lines, collects into an array. Returns when the stream ends.

**`it()` blocks (5):**

1. *Baseline step-0*: scripted query emits one delta, no tools. Assert frames: `pipeline_step(step-0, running)` → `delta` → `pipeline_step(step-0, completed)` → `done`. Locks the hand-written step-0 plumbing in the route handler.
2. *Tool call emits classified step*: scripted query emits `toolUseMsg("tu-1", "search_records", {...})` then `toolResultMsg("tu-1", "{...}")` then a delta. Assert a `pipeline_step` frame exists with `label: "Searching financial records"` and `status: "running"`, and a subsequent frame with the same `id` has `status: "completed"`. Regression-lock for `8077fe3`.
3. *Tool error flips to failed*: scripted query emits `toolUseMsg("tu-1", ...)` then `toolResultMsg("tu-1", "err", true)`. Assert the matching completion frame has `status: "failed"`.
4. *Order + id uniqueness*: scripted query emits two tool_use/tool_result pairs with ids `tu-1`, `tu-2`. Assert four corresponding `pipeline_step` frames for tool-exec steps, each running/completed id matches a prior running-id, ids are distinct.
5. *Orphan tool_result ignored*: scripted query emits `toolResultMsg("tu-ghost", "stray")` without any preceding `toolUseMsg`. Assert zero pipeline_step frames fire for the orphan (the step-0 frame can still be present from the baseline plumbing).

## Error-Handling Strategy

- **CI env**: no new env vars. Phase 1 tests use `DATABASE_URL` the same way existing integration tests do. If someone runs vitest without Neon access the existing tests break first.
- **Mock cleanup**: `beforeEach(() => vi.clearAllMocks())` in phases 2 and 3.
- **Flake tolerance**: Neon pooler occasionally returns cold-connection errors. Not addressed here — consistent with existing behavior.
- **TDD note**: The production code that phases 2 and 3 lock down already shipped (commits through `8077fe3`). These tests are regression-locks for already-shipped behavior, not new-feature TDD. Per the TDD skill's "existing code has no tests" provision, this is acceptable. Phase 1 exercises real Prisma flow that has never had integration coverage.

## Test Architecture Principles

- **One `beforeEach` seeds, multiple `it()` blocks assert slices** (Approach 3 from brainstorming). Matches `persist.test.ts`.
- **Narrow assertions per `it()`** so failure output names the broken layer.
- **Mocks factored into a shared helper file** (`mock-query.ts`) to prevent drift between the two agent-side test files.
- **Route handler tested as a function**, not via a live Next.js server.

## Files Created

| File | Purpose |
|------|---------|
| `tests/integration/close-readiness-upload.test.ts` | Phase 1 integration test |
| `tests/integration/cleanup.ts` | `deleteTestUser` helper (shared by future integration tests) |
| `tests/agent/mock-query.ts` | Shared gitclaw `query()` mock factory (no tests) |
| `tests/agent/close-package-response.test.ts` | Phase 2 snapshot test |
| `tests/chat-route/pipeline-sse.test.ts` | Phase 3 wire test |
| `docs/superpowers/plans/2026-04-23-integration-test-gaps.md` | Implementation plan (produced by writing-plans skill next) |

## Files Modified

None. This is test-only work.

## Success Criteria

- All new tests pass on first run against the current main branch (`8077fe3` or later)
- Deliberately reverting any of the regression-locked commits causes the corresponding test to fail with a message naming the broken behavior
- `npx vitest run` completes in under 90 seconds total (current ~55s + ~12s phase 1 + ~5s phases 2+3)
- No changes to production code

## Out of Scope for This Spec

The following are not addressed here but noted for future passes:

- Cleanup script for the ~200 existing `t_*@test.local` users leaking from historical integration runs
- Client-side `use-chat-stream.ts` testing under `@testing-library/react`
- Property-based testing for the sanitizer regex patterns (generative narration variations)
