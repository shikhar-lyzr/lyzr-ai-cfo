# Technical Handoff: Lyzr AI CFO — V1.5 AR Follow-ups

This document is the full context for continuing V1.5 implementation. Read this, then read the design spec at `docs/superpowers/specs/2026-04-10-v1.5-ar-followups-design.md` for exact field names, tool signatures, and UI behavior.

---

## Part 1: V1 Base Layer (Stable, Committed)

### Stack
- **Next.js 16.2.2** (check `node_modules/next/dist/docs/` for API changes — this version has breaking changes)
- **React 19.2.4**, **Prisma 6.19.3** (SQLite), **gitclaw 1.3.3** (agent SDK)
- **Vitest** for testing, **Tailwind CSS v4**, **lucide-react** for icons
- **No TypeScript strict mode issues** — codebase type-checks clean

### Lyzr Studio Integration
- Agent engine: Lyzr Agent Studio v4 Endpoint
- Model config: `lyzr:69d43ccef008dd037bad64d7@https://agent-prod.studio.lyzr.ai/v4`
- Auth: `OPENAI_API_KEY` mapped to `LYZR_API_KEY` so gitclaw routes Bearer auth correctly
- Fallback chain: Lyzr → Gemini (via `GEMINI_API_KEY`) for LLM column mapping

### Architecture: Agent-First
- The `gitclaw` agent is the sole source of truth for variance detection and tool logic
- Next.js routes are thin clients wrapping agent responses
- Agent directory: `agent/` with `SOUL.md`, `RULES.md`, `DUTIES.md`, and skills under `agent/skills/`
- Agent is invoked via `lib/agent/index.ts` using `query()` from gitclaw SDK

### Existing Agent Tools (`lib/agent/tools.ts`)
All exported from `createFinancialTools(userId)`:
1. `search_records` — query FinancialRecord by account/period/category
2. `analyze_financial_data` — compute variances, flag by threshold, group by category
3. `create_actions` — batch insert Action rows, dedupes by headline+pending
4. `update_action` — change action status
5. `generate_commentary` — produce variance commentary text
6. `draft_email` — draft follow-up email about a variance action

### Existing Agent Skills
- `agent/skills/variance-review/SKILL.md` — structured variance analysis workflow
- `agent/skills/monthly-close/SKILL.md` — placeholder
- `agent/skills/budget-reforecast/SKILL.md` — placeholder

### CSV Ingestion
- Upload route: `app/api/upload/route.ts`
  - `parseCSV()` splits text into headers + rows
  - `autoDetectColumns()` regex-matches variance columns (account, period, actual, budget, category)
  - LLM fallback via `lib/csv/llm-mapper.ts` → `inferColumnMapping()` when regex fails
  - Creates `DataSource` → bulk inserts `FinancialRecord` → calls `analyzeUpload()` to trigger agent
- LLM mapper (`lib/csv/llm-mapper.ts`): tries Lyzr first, then Gemini. JSON fence stripping regex: `/```(?:json)?\s*([\s\S]*?)```/`

### API Routes
| Route | Method | Purpose |
|---|---|---|
| `app/api/upload/route.ts` | POST | CSV upload + agent analysis |
| `app/api/actions/route.ts` | GET | Fetch all actions for user |
| `app/api/actions/[id]/route.ts` | PATCH | Update action status + audit trail |
| `app/api/chat/route.ts` | POST | SSE streaming agent chat |
| `app/api/data-sources/route.ts` | GET | List data sources |
| `app/api/auth/route.ts` | POST | Auth |
| `app/api/auth/me/route.ts` | GET | Current user |
| `app/api/seed-demo/route.ts` | POST | Seed demo data |

### UI Components
| Component | Purpose |
|---|---|
| `components/feed/action-card.tsx` | Renders single action card with severity badge, Approve/Flag/Ask AI/Dismiss buttons |
| `components/feed/action-feed.tsx` | Scrollable feed + filter integration |
| `components/feed/filter-bar.tsx` | Type/Severity/Status chip filters using `FilterGroup` |
| `components/briefing/morning-briefing.tsx` | Floating collapsible briefing, SSE-streams from `/api/chat` |
| `components/chat/chat-panel.tsx` | Chat panel |
| `components/chat/chat-input.tsx` | Chat input |
| `components/chat/message-bubble.tsx` | Chat message |
| `components/data-sources/upload-area.tsx` | File upload area |
| `components/data-sources/source-list.tsx` | Data source list |
| `components/layout/sidebar.tsx` | Sidebar nav |
| `components/layout/resizable-split-pane.tsx` | Resizable layout |

### TypeScript Types (`lib/types.ts`)
```ts
ActionType = "variance" | "anomaly" | "recommendation"
Severity = "critical" | "warning" | "info"
ActionStatus = "pending" | "flagged" | "dismissed" | "approved"
Action = { id, userId, type, severity, headline, detail, driver, status, sourceName, sourceDataSourceId, createdAt }
```
**Note:** `ActionType` needs `"ar_followup"` added for V1.5. The `Action` interface needs `invoiceId?` and `draftBody?`.

### Prisma Migrations
1. `20260408123813_init` — User, DataSource, FinancialRecord, Action, ChatMessage
2. `20260409214257_add_action_events` — ActionEvent table

---

## Part 2: V1.5 Schema Changes (DONE — Migration Pending)

The Prisma schema (`prisma/schema.prisma`) has already been updated with:

### New `Invoice` model
```prisma
model Invoice {
  id            String    @id @default(cuid())
  dataSourceId  String
  invoiceNumber String
  customer      String
  customerEmail String?
  amount        Float
  invoiceDate   DateTime
  dueDate       DateTime
  status        String    @default("open")  // open | sent | snoozed | escalated | paid
  lastDunnedAt  DateTime?
  snoozedUntil  DateTime?
  createdAt     DateTime  @default(now())
  dataSource DataSource @relation(fields: [dataSourceId], references: [id])
  actions    Action[]
  @@unique([dataSourceId, invoiceNumber])
}
```

### Action model additions
- `invoiceId String?` — links AR actions to invoices
- `draftBody String?` — cached dunning email text
- `invoice Invoice? @relation(fields: [invoiceId], references: [id])`

### DataSource addition
- `invoices Invoice[]` relation added

### Migration blocker
The dev SQLite database has **drift** — tables were created outside migrations in a prior session. Running `npx prisma migrate dev` fails with drift detection. You need to reset:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes" npx prisma migrate reset --force
```

Then create the migration:
```bash
npx prisma migrate dev --name add-invoice-model-and-ar-fields
```

This is a local SQLite dev DB (`prisma/dev.db`), not production. All seed data is re-creatable.

---

## Part 3: V1.5 Implementation — Remaining Tasks

Read the full design spec at `docs/superpowers/specs/2026-04-10-v1.5-ar-followups-design.md` for exact details. Here is the task list with status:

### Task 1: Prisma Schema + Migration — DONE
### Task 2: CSV Shape Detector + AR Parser — DONE
### Task 3: AR Agent Tools — DONE
### Task 4: Agent Skill Files — DONE
### Task 5: Upload Route + analyzeArUpload — DONE
### Task 6: AR Action API Route — DONE
### Task 7: UI Updates — DONE
### Task 8: Seed Data — DONE

### Task 9: Tests (not started)
6 vitest files + 1 smoke test:
1. `__tests__/lib/csv/detect-shape.test.ts` — regex fast-path + LLM fallback stub
2. `__tests__/lib/csv/ar-parser.test.ts` — happy path, non-standard headers, skip reasons, idempotent
3. `__tests__/lib/agent/ar-tools.test.ts` — bucket math, cooldown, dedupe, tone defaults, ActionEvent emission
4. `__tests__/lib/invoice-state.test.ts` — state transition matrix, pure function
5. `__tests__/app/api/actions/ar.test.ts` — POST each op, verify DB effects
6. `__tests__/lib/csv/ar-parser-dates.test.ts` — date format matrix
7. `scratch/probe-ar.ts` — smoke test seeding AR CSV through agent

---

## What's Left

Only **Task 9 (tests)** remains. All implementation code is complete and type-checks clean. All changes are on `main` (uncommitted).

### Session 2026-04-13 — Additional Fixes Applied

**Dev server memory fix (permanent):**
- `.env`: `NODE_OPTIONS="--max-old-space-size=512"` — caps Node heap per process
- `next.config.ts`: `experimental.preloadEntriesOnStart: false` — don't preload all page JS at startup
- `package.json`: `"dev": "next dev --turbopack"` — Turbopack for lower memory file watching
- Deleted `.worktrees/v1.5-ar-followups/node_modules` (1.1 GB) and `.next` (277 MB) — were being watched by file watcher

**AR flow bugs fixed in `lib/agent/tools.ts`:**
1. `scan_ar_aging` now prefixes each invoice with `[id=<cuid>]` in text output — LLM can use the actual FK value
2. `create_ar_actions` now normalizes agent input — resolves invoice IDs (cuid or invoice number, scoped to user), fills missing fields from DB, computes severity from days overdue, inserts one-by-one instead of `createMany`
3. Invoice number lookup scoped to `dataSource: { userId }` — prevents cross-user FK violations

**Other uncommitted changes from prior sessions:**
- `app/(dashboard)/page.tsx`: polling loop (60s after mount) to catch background agent results
- `app/api/upload/route.ts`: fire-and-forget agent analysis (returns immediately, agent runs async)
- `components/briefing/morning-briefing.tsx`: sessionStorage cache for briefing text
- `components/data-sources/upload-area.tsx`: spinner layout fix

## Summary of All Changes

| File | Status | What |
|---|---|---|
| `prisma/schema.prisma` | Modified | Invoice model, Action.invoiceId/draftBody |
| `prisma/migrations/20260410131709_*` | New | Migration for Invoice + AR fields |
| `lib/csv/detect-shape.ts` | New | CSV shape detector (variance/ar/unknown) |
| `lib/csv/ar-parser.ts` | New | AR CSV parser with LLM fallback |
| `lib/csv/llm-mapper.ts` | Modified | Support AR column mapping |
| `lib/agent/tools.ts` | Modified | 4 new AR tools + shared helpers |
| `lib/agent/index.ts` | Modified | analyzeArUpload function |
| `lib/types.ts` | Modified | ar_followup type, invoiceId/draftBody on Action |
| `app/api/upload/route.ts` | Modified | Shape-detect branching, AR flow |
| `app/api/actions/[id]/ar/route.ts` | New | GET draft + POST mark_sent/snooze/escalate |
| `app/(dashboard)/page.tsx` | Modified | handleArOp, dataSources fetch |
| `components/feed/action-card.tsx` | Modified | AR button row + click-to-expand draft |
| `components/feed/action-feed.tsx` | Modified | onArOp prop passthrough |
| `components/feed/filter-bar.tsx` | Modified | AR filter chip |
| `components/briefing/morning-briefing.tsx` | Modified | Scan AR button |
| `agent/skills/ar-followup/SKILL.md` | New | AR follow-up skill definition |
| `agent/RULES.md` | Modified | AR-specific rules |
| `agent/DUTIES.md` | Modified | AR duty triggers |
| `agent/SOUL.md` | Modified | Dunning tone guidance |
| `public/sample-ar-aging.csv` | New | 8 sample invoices |
| `scripts/seed-ar.ts` | New | AR seed script |
