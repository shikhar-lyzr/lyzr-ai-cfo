# Lyzr AI CFO — AgenticOS

An **autonomous financial operations platform** for the CFO's office. The interface is an AgenticOS shell: a Command Center, six domain journeys (Monthly Close, Reconciliation, Regulatory Capital, IFRS 9 ECL, Daily Liquidity, Regulatory Returns), a Build surface (Studio / Skills / Knowledge / Integrations / Flows), and an Observe surface (Decision Inbox / Runs / Compliance / Audit). Every action is powered by a gitclaw-driven AI agent that lives as a folder of files — `SOUL.md`, `RULES.md`, `DUTIES.md`, `skills/`, `knowledge/`, `memory/` — and streams typed pipeline events back to the UI.

## Table of Contents

- [What Is It?](#what-is-it)
- [Architecture](#architecture)
- [How gitclaw / git-agent Works Here](#how-gitclaw--git-agent-works-here)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Agent System](#agent-system)
- [Data Model](#data-model)
- [API Routes](#api-routes)
- [CSV Ingestion](#csv-ingestion)
- [AR Follow-ups](#ar-follow-ups)
- [Testing](#testing)
- [Sample Data](#sample-data)
- [Scripts & Auth](#scripts--auth)

---

## What Is It?

Lyzr AI CFO ships as **AgenticOS** — an operating-system-style UI for financial workflows, not a classic BI dashboard. The three surfaces are:

| Surface | Purpose | Routes |
|---|---|---|
| **Run** (domain journeys) | Task-specific workspaces with scoped chat | `/`, `/agent-console`, `/monthly-close`, `/financial-reconciliation`, `/regulatory-capital`, `/ifrs9-ecl`, `/daily-liquidity`, `/regulatory-returns` |
| **Build** | Author & inspect the agent's brain | `/agent-studio`, `/skills-manager`, `/knowledge-base`, `/integrations`, `/skill-flows` |
| **Observe** | Audit what the agent did and why | `/decision-inbox`, `/agent-runs`, `/compliance`, `/audit-trail` |

The **Command Center** (`/`) is the entry point — a search bar that hands off to the Agent Console with an auto-send query param (`/agent-console?message=...`) plus journey cards and pending-action chips. The **Agent Console** is a three-panel chat workspace that renders the agent's live pipeline (skill discovery, memory load, tool calls, file reads) as a collapsible timeline alongside the streamed response.

Domain journeys (e.g. `/monthly-close`) are fully sample-data driven shells with a docked chat panel that seeds a journey-scoped prompt. They demonstrate the target UX without requiring every workflow to be wired into real data yet.

---

## Architecture

### Full-system diagram

```
┌─── Browser ────────────────────────────────────────────────────────┐
│                                                                     │
│   Command Center        Agent Console         6 Domain Journeys    │
│   (/)                   (/agent-console)      (/monthly-close, …)  │
│       │                       │                       │            │
│       │  ?message=…            │                       │            │
│       └─────────┬──────────────┴───────────────────────┘            │
│                 │                                                    │
│                 ▼                                                    │
│         hooks/use-chat-stream.ts                                    │
│         ─ manages messages[] and pipelineSteps[]                    │
│         ─ parses SSE events: pipeline_step | delta | done | error  │
│         ─ AbortController for stopStream                            │
│                 │                                                    │
│                 │  fetch POST /api/chat  (SSE text/event-stream)    │
└─────────────────┼────────────────────────────────────────────────────┘
                  │
                  ▼
┌─── Next.js 16 App Router ───────────────────────────────────────────┐
│                                                                      │
│   proxy.ts   ── cookie gate (lyzr-session) → redirects to /login   │
│                                                                      │
│   API routes (all in app/api):                                     │
│     /chat            → chatWithAgent(..., { onDelta, onComplete })│
│     /upload          → detectCsvShape → analyzeUpload | analyzeAr │
│     /actions, /stats → Prisma reads (Command Center, action feed) │
│     /agent/context   → reads agent/skills, agent/knowledge,       │
│                        agent/RULES.md for the Agent Console panel │
│     /auth, /auth/me  → session cookie helpers                     │
│     /documents       → Markdown report CRUD                       │
│     /data-sources    → CSV upload listing + Google Sheet linking  │
│                                                                      │
│   Shell UI (app/(shell)/layout.tsx):                                │
│     Sidebar ── NAV_HOME + JOURNEYS + BUILD_NAV + OBSERVE_NAV       │
│     Glass look + AgentStatusBar                                     │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─── lib/agent — the gitclaw adapter ────────────────────────────────┐
│                                                                      │
│   lib/agent/index.ts                                                 │
│     ┌────────────────────────────────────────────────────────┐     │
│     │ chatWithAgent(userId, message, actionId, callbacks)    │     │
│     │ analyzeUpload(userId, dataSourceId, fileName, count)   │     │
│     │ analyzeArUpload(userId, dataSourceId, fileName, count) │     │
│     │ generateReport(userId, type)                           │     │
│     └────────────────────────────────────────────────────────┘     │
│                                                                      │
│   Each entry point:                                                  │
│     1. buildContext(userId)  ── pulls recent data sources,         │
│        pending actions, chat history, and decision events from    │
│        Prisma into a rich systemPromptSuffix                       │
│     2. Appends SKILL_CONTENT (pre-loaded at module boot) so the   │
│        model never needs an extra `read` round-trip to find a     │
│        skill                                                        │
│     3. createFinancialTools(userId) ── returns 13 tools bound to  │
│        this user's scope                                            │
│     4. buildAllowedTools(tools) ── union of custom tools +        │
│        gitclaw builtins (read, memory, task_tracker,              │
│        skill_learner)                                               │
│     5. gitclaw.query({ prompt, dir: agent/, model,                │
│                        systemPromptSuffix, tools,                  │
│                        allowedTools, maxTurns: 10,                 │
│                        constraints: { temperature: 0.3 } })        │
│                                                                      │
│   lib/agent/classify-event.ts                                       │
│     Maps GCMessage (gitclaw's typed event union) → PipelineStep   │
│     so the UI can render a live timeline of what the agent did.   │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─── gitclaw SDK ────────────────────────────────────────────────────┐
│                                                                      │
│   - Orchestrates the LLM loop (Lyzr Agent Studio v4 proxy)         │
│   - Loads the agent/ directory as a "git-agent"                     │
│   - Exposes built-in tools to the model:                           │
│       read           scan agent/skills/, agent/knowledge/          │
│       memory         git-backed persistence (load / save / learn) │
│       task_tracker   multi-step task state within a session       │
│       skill_learner  crystallize repeated patterns into new       │
│                      skills (writes a new SKILL.md)                 │
│   - Streams back a typed async iterator of GCMessages:              │
│       system  / tool_use / tool_result / delta / assistant         │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
     ┌────────────┼────────────────────────────────┐
     │            │                                 │
     ▼            ▼                                 ▼
┌ agent/ ─┐  ┌ Lyzr Agent Studio v4 ─┐  ┌ Prisma → SQLite (dev.db) ─┐
│ SOUL.md │  │  LLM inference via      │  │  User                     │
│ RULES.md│  │  agent-prod.studio      │  │  DataSource               │
│ DUTIES  │  │  .lyzr.ai/v4            │  │  FinancialRecord          │
│ skills/ │  │  model id:               │  │  Invoice                  │
│ knowledge│ │  69d43ccef008dd0…       │  │  Action                   │
│ memory/  │ │  (served behind          │  │  ActionEvent              │
│ examples/│ │  OpenAI-compatible       │  │  ChatMessage              │
│          │ │  auth)                   │  │  Document                 │
└──────────┘ └─────────────────────────┘  └──────────────────────────┘
```

### Chat request flow (Agent Console)

```
User types in ChatInput
        │
        ▼
useChatStream.sendMessage(text, {journeyId?})
        │
        │   POST /api/chat  { userId, message, actionId?, journeyId? }
        ▼
app/api/chat/route.ts
  ├── resetStepCounter()
  ├── emit SSE: pipeline_step { id: "step-0", type: "agent_init", status: "running" }
  └── chatWithAgent(userId, msg, actionId, { onDelta, onComplete, onError })
                │
                ▼
       lib/agent/index.ts
         buildContext(userId) ───────┐
         createFinancialTools(userId)│
         gitclaw.query({…})          │
                │                    │
                │  async iterator    │
                ▼                    │
       for await (msg of result) {   │
         msg.type === "delta"   → onDelta(msg.content)
         msg.type === "assistant" → final content
         msg.type === "system"  → error passthrough
       }                             │
                │                    │
                │                    │
                ▼                    │
       SSE stream back:              │
         pipeline_step  ─────────────┤  (classify-event maps tool_use
         delta           ────────────┤   events into PipelineStep rows
         done            ────────────┤   like "Analyzing financial data",
         error           ────────────┘   "Loading skill — variance-review")
                │
                ▼
       useChatStream buffers + updates state
                │
                ▼
       <PipelineContainer> collapsible step rows
       <MessageBubble>     streamed markdown response
```

---

## How gitclaw / git-agent Works Here

[**gitclaw**](https://www.npmjs.com/package/gitclaw) is the SDK this app uses to talk to the Lyzr Agent Studio LLM. The core idea is that an **agent is a directory**, not a configuration object. You point gitclaw at a folder, it reads the files as the agent's mind, and a handful of built-in tools let the model `read` its own skills on demand and `memory`-persist learnings between sessions as git commits.

### 1. The agent lives in `agent/`

```
agent/
├── SOUL.md                  # identity, communication style, persona
├── RULES.md                 # 12 hard behavioral constraints
├── DUTIES.md                # proactive triggers — what to do on upload/scan/chat
├── agent.yaml               # metadata + default tools list
├── config/                  # (reserved)
├── skills/
│   ├── variance-review/SKILL.md     # variance detection workflow
│   ├── ar-followup/SKILL.md         # AR dunning workflow
│   ├── monthly-close/SKILL.md       # close orchestration
│   └── budget-reforecast/SKILL.md
├── knowledge/
│   ├── variance-thresholds.md
│   ├── common-drivers.md
│   ├── report-formats.md
│   └── index.yaml
├── examples/                # few-shot examples for the model
├── memory/
│   └── MEMORY.md            # learned facts, committed to git by the `memory` tool
└── workflows/               # (reserved)
```

### 2. Each request is a `gitclaw.query(...)` call

`lib/agent/index.ts` has four entry points (`chatWithAgent`, `analyzeUpload`, `analyzeArUpload`, `generateReport`) that all share the same shape:

```ts
import { query } from "gitclaw";

const result = query({
  prompt,                                   // the user message (or a workflow prompt)
  dir: process.cwd() + "/agent",            // where the git-agent lives
  model: "lyzr:<agent-id>@https://agent-prod.studio.lyzr.ai/v4",
  systemPromptSuffix: context,              // buildContext() + pre-loaded SKILL_CONTENT
  tools: createFinancialTools(userId),      // 13 custom tools, bound to this user
  allowedTools: buildAllowedTools(tools),   // custom tools + gitclaw builtins
  maxTurns: 10,
  constraints: { temperature: 0.3 },
});

for await (const msg of result) {
  // msg is a typed GCMessage — system / tool_use / tool_result / delta / assistant
}
```

### 3. `buildContext()` is the live working memory

Before every query the adapter pulls the last 10 data sources, 20 pending actions, 10 chat messages, and 20 decision events from Prisma and renders them into a markdown **systemPromptSuffix**. That gives the model a compact snapshot of "what the user has in front of them right now" — without requiring the LLM to call tools just to get its bearings.

### 4. Skills are **pre-loaded** at module boot

Rather than letting gitclaw's default behavior force the model to `read` each `SKILL.md` on demand, `loadSkillContent()` reads every `agent/skills/<name>/SKILL.md` once when the module loads and inlines them into the system prompt under a `## Pre-loaded Skill Instructions` heading. This removes one full tool round-trip per skill activation — a significant latency win because each round-trip costs a Lyzr inference call.

### 5. Tools fall into two buckets

**Custom financial tools** (13, defined in `lib/agent/tools.ts`):

| Tool | Purpose |
|---|---|
| `search_records` | Query `FinancialRecord` by account / period / category |
| `analyze_financial_data` | Compute variances, flag by threshold, group by category |
| `create_actions` | Batch-insert variance actions (dedupe by headline) |
| `update_action` | Change action status |
| `generate_commentary` | Produce variance commentary |
| `draft_email` | Draft variance follow-up email |
| `generate_variance_report` | Gather summary data for a Monthly Variance Report |
| `save_document` | Persist a markdown report to the `Document` table |
| `scan_ar_aging` | Bucket open invoices by days overdue |
| `create_ar_actions` | Batch-insert AR follow-up actions (dedupe by invoice) |
| `draft_dunning_email` | Draft tone-appropriate collection email |
| `update_invoice_status` | Transition invoice state + record `ActionEvent` |
| `generate_ar_summary` | Gather summary data for an AR Aging Summary report |

**gitclaw built-in tools** (exposed via `buildAllowedTools`, defined in `lib/agent/allowed-tools.ts`):

| Built-in | Purpose in this app |
|---|---|
| `read` | Load files from `agent/` on demand — used for `knowledge/*.md` and dynamic file reads, since `SKILL.md` files are already pre-loaded |
| `memory` | Git-backed persistent memory. `action: "load"` reads `agent/memory/MEMORY.md`; `action: "save"` appends a learned fact and **creates a git commit** so the knowledge survives across deploys |
| `task_tracker` | Multi-step task state within a session (the "Discovering relevant skills" step in the pipeline UI) |
| `skill_learner` | Crystallize repeated patterns into a new `SKILL.md`. Deliberately opt-in via the allow-list |

Deliberately **excluded**: `cli` (arbitrary shell on the server) and `write` (arbitrary file writes). `memory` handles its own commits; `skill_learner` handles its own writes through a controlled interface.

### 6. Events are classified into UI pipeline steps

`lib/agent/classify-event.ts` takes a `GCMessage` from the gitclaw async iterator and turns it into a `PipelineStep` that the Agent Console renders as a collapsible row. The mapping is:

| GCMessage event | PipelineStep type | Visible label |
|---|---|---|
| `system` subtype `session_start` | `agent_init` | "Initializing agent..." |
| `tool_use` name `task_tracker` action `begin` | `skill_discovery` | "Discovering relevant skills..." |
| `tool_use` name `memory` action `load` | `memory_load` | "Loading agent memory..." |
| `tool_use` name `memory` action `save` | `file_write` | "Saving to memory..." |
| `tool_use` name `read` path `skills/*/SKILL.md` | `skill_load` | "Loading skill — <name>" |
| `tool_use` name `read` path `memory/wiki/*` | `file_read` | "Reading wiki — <page>" |
| `tool_use` name `write` path `memory/wiki/*` | `wiki_update` | "Updating wiki — <page>" |
| `tool_use` any custom tool (e.g. `analyze_financial_data`) | `tool_exec` | Human-readable label from `TOOL_LABELS` |

The Agent Console subscribes to the `pipeline_step` SSE events and renders them via `components/pipeline/pipeline-container.tsx`, so the user sees the agent's reasoning unfold in real time alongside the streamed response text.

### 7. The learning loop

When an upload finds something durable about the business (recurring vendor, unusual category mix, chronic late-payer, etc.), the prompts in `analyzeUpload` and `analyzeArUpload` explicitly instruct the agent to call `memory` with `action: "save"` and a short `learned: ...` commit message. Because `memory` commits to git, every deploy of the app starts with everything the previous sessions taught it. That's why `agent/memory/MEMORY.md` and per-skill counters (e.g. `agent/skills/variance-review/SKILL.md` frontmatter) are **tracked in git**, not gitignored.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | **16.2.2** |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Icons | lucide-react | 1.7.0 |
| Animation | framer-motion | 12.38.0 |
| Graph viz | d3 | 7.9.0 |
| Charts | Recharts | 3.8.1 |
| Markdown | react-markdown | 10.1.0 |
| Database | SQLite via Prisma | 6.19.3 |
| Agent SDK | **gitclaw** | 1.3.3 |
| AI Engine | Lyzr Agent Studio v4 | — |
| Testing | Vitest | 4.1.3 |
| Language | TypeScript | 5.x |

> **Important:** This project is on Next.js **16.2.2**, which has breaking changes from every version before it. Before touching routing, middleware (`proxy.ts`), or server-component / client-component boundaries, read `node_modules/next/dist/docs/` for the current API.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/shikhar-lyzr/lyzr-ai-cfo.git
cd lyzr-ai-cfo
npm install
```

### Database Setup

```bash
npx prisma generate
npx prisma migrate dev
```

If migrations drift:

```bash
npx prisma migrate reset --force
npx prisma migrate dev
```

### Run the Dev Server

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login` — enter any email to create a demo session. After login you land on the Command Center.

### Try the app

- **Command Center:** type in the search bar → it hands off to the Agent Console with `?message=...`
- **Agent Console:** ask anything; the pipeline panel shows skill loads, memory reads, and tool calls live
- **Data Sources → Upload:** drop a CSV; the agent auto-detects shape (variance or AR) and runs the matching workflow
- **Domain journeys:** click any journey in the sidebar to see a scoped workspace with a docked chat panel seeded with journey context

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Database (SQLite — no external DB required)
DATABASE_URL="file:./dev.db"

# Lyzr AI Studio (PRIMARY — powers the agent via gitclaw)
LYZR_API_KEY="sk-your-lyzr-api-key"
OPENAI_API_KEY="sk-your-lyzr-api-key"   # Same key — gitclaw uses OpenAI-compatible auth

# Google Gemini (OPTIONAL — fallback for CSV column mapping and chat fallback)
GEMINI_API_KEY="your-gemini-key"
```

Key details:

- `OPENAI_API_KEY` must match `LYZR_API_KEY` — gitclaw routes bearer auth through an OpenAI-compatible endpoint, and `lib/agent/index.ts` copies `LYZR_API_KEY` into `OPENAI_API_KEY` at module load.
- The agent model is hardcoded to `lyzr:69d43ccef008dd037bad64d7@https://agent-prod.studio.lyzr.ai/v4`. Note that the agent **id** (`69d43cce...`) is distinct from the Lyzr Studio URL slug.
- `GEMINI_API_KEY` is optional; the chat route falls back to a local placeholder if none of the keys are present.

---

## Project Structure

```
lyzr-ai-cfo/
├── agent/                         # The git-agent (see "How gitclaw works")
│
├── app/
│   ├── (shell)/                   # Authenticated AgenticOS shell
│   │   ├── layout.tsx             # Sidebar + scrollable main area
│   │   ├── page.tsx               # Command Center — search, journeys, insights
│   │   ├── agent-console/         # Chat + live pipeline + context panel
│   │   │   ├── page.tsx           # server wrapper (Suspense for useSearchParams)
│   │   │   └── agent-console-client.tsx
│   │   ├── monthly-close/
│   │   ├── financial-reconciliation/
│   │   ├── regulatory-capital/
│   │   ├── ifrs9-ecl/
│   │   ├── daily-liquidity/
│   │   ├── regulatory-returns/
│   │   ├── agent-studio/          # Build — agent cards
│   │   ├── skills-manager/        # Build — skills grid (real + sample)
│   │   ├── knowledge-base/        # Build — D3 wiki graph
│   │   ├── integrations/          # Build — Composio + Direct API
│   │   ├── skill-flows/           # Build — flow visualizations
│   │   ├── decision-inbox/        # Observe — decisions with tracing SVG
│   │   ├── agent-runs/            # Observe — run table + slide-over
│   │   ├── compliance/            # Observe — guardrails, frameworks, schedule
│   │   ├── audit-trail/           # Observe — timeline of events
│   │   ├── data-sources/
│   │   ├── documents/
│   │   └── settings/
│   ├── api/
│   │   ├── chat/route.ts          # SSE streaming (pipeline_step | delta | done | error)
│   │   ├── agent/context/route.ts # Lists skills / knowledge / guardrails for the Console
│   │   ├── upload/route.ts        # CSV upload → shape detection → agent analysis
│   │   ├── actions/               # Action CRUD + AR operations
│   │   ├── auth/                  # Session cookie helpers
│   │   ├── chart/                 # Budget vs actual chart data
│   │   ├── data-sources/
│   │   ├── documents/
│   │   ├── seed-demo/
│   │   └── stats/
│   ├── login/page.tsx
│   └── layout.tsx
│
├── components/
│   ├── shell/                     # Sidebar, nav-item, agent-status-bar
│   ├── command-center/            # SearchBar, JourneyCard, AgentInsights, ActionsRequired
│   ├── agent-console/             # ChatInput, AgentContextPanel
│   ├── pipeline/                  # PipelineContainer, PipelineStep, StepIcon
│   ├── journey/                   # JourneyPage, JourneyChatPanel, NudgeChips
│   ├── build/                     # WikiGraph (D3), FlowStepViz
│   ├── observe/                   # DecisionTracingSvg, ExecutionTracePanel
│   ├── shared/                    # MetricCard, StatusBadge, PriorityBadge, SampleDataBadge
│   ├── data-sources/              # Upload area, source list, sheet linker
│   └── documents/                 # Markdown rendering
│
├── hooks/
│   └── use-chat-stream.ts         # Client-side SSE consumer
│
├── lib/
│   ├── agent/
│   │   ├── index.ts               # gitclaw adapter — chatWithAgent, analyzeUpload, …
│   │   ├── tools.ts               # 13 custom tools + shared helpers
│   │   ├── allowed-tools.ts       # Custom tools ∪ gitclaw builtins
│   │   ├── pipeline-types.ts      # StepType / PipelineStep / FrontendEvent
│   │   └── classify-event.ts      # GCMessage → PipelineStep mapper
│   ├── csv/                       # Shape detection + variance/AR parsers + LLM mapper
│   ├── config/
│   │   ├── journeys.ts            # NavItem config for sidebar
│   │   ├── journey-sample-data.ts # Per-journey sample metrics
│   │   ├── sample-build-data.ts
│   │   ├── sample-insights.ts
│   │   └── sample-observe-data.ts
│   ├── auth.ts
│   ├── db.ts                      # Prisma singleton
│   ├── types.ts
│   └── utils.ts
│
├── prisma/
│   ├── schema.prisma              # 8 models
│   ├── seed.ts
│   └── migrations/
│
├── proxy.ts                       # Next 16 middleware — cookie gate
├── public/                        # Sample CSVs + doc markdown
├── __tests__/                     # Vitest unit tests
└── docs/superpowers/specs/        # Design specs
```

---

## Agent System

The agent is a directory of markdown, not a config object. `lib/agent/index.ts` is the single gateway between the app and gitclaw. See [How gitclaw / git-agent Works Here](#how-gitclaw--git-agent-works-here) for the full flow.

| File | Purpose |
|---|---|
| `SOUL.md` | Identity, persona, communication style |
| `RULES.md` | 12 behavioral constraints (data integrity, severity accuracy, no sending emails, …) |
| `DUTIES.md` | Proactive triggers — what the agent does on upload, scan, chat, action management |
| `skills/<name>/SKILL.md` | One file per workflow. **Pre-loaded at module boot** so the model doesn't spend a tool round-trip to find them |
| `knowledge/*.md` | Reference data on variance thresholds, common drivers, report formats |
| `memory/MEMORY.md` | Learnings persisted via git commits by the `memory` tool |
| `examples/*.md` | Few-shot examples |
| `agent.yaml` | Metadata + default tool list |

---

## Data Model

Eight Prisma models in `prisma/schema.prisma`:

| Model | Purpose |
|---|---|
| **User** | `id`, `lyzrAccountId`, `email`, `name`, `credits` |
| **DataSource** | An uploaded CSV or linked Google Sheet. `type`, `status` (processing/ready/error), `recordCount`, `metadata` (JSON with `{shape, headers}`) |
| **FinancialRecord** | One row of variance data (`account`, `period`, `actual`, `budget`, `category`) |
| **Invoice** | One AR aging record. `status` (open/sent/snoozed/escalated/paid), `lastDunnedAt?`, `snoozedUntil?`. Unique on `(dataSourceId, invoiceNumber)` |
| **Action** | Agent-created feed item. `type` (variance/anomaly/recommendation/ar_followup), `severity`, `headline`, `detail`, `driver`, `status`, `invoiceId?`, `draftBody?` |
| **ActionEvent** | Audit trail for action status changes (`fromStatus` → `toStatus`) |
| **ChatMessage** | Persisted chat history; surfaced into `buildContext()` |
| **Document** | Markdown reports generated by `save_document` (`type`: variance_report / ar_summary) |

### Entity relationships

```
User ──< DataSource ──< FinancialRecord
  │          │                │
  │          └──< Invoice ──< Action ──< ActionEvent
  │                              │
  │          ┌───────────────────┘
  │          │
  ├──< Action
  │
  ├──< ChatMessage ──(optional)──> Action
  │
  └──< Document
```

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth` | POST / DELETE | Create session / logout |
| `/api/auth/me` | GET | Current user from session cookie |
| `/api/chat` | POST | **SSE streaming agent chat** (emits `pipeline_step`, `delta`, `done`, `error`) |
| `/api/agent/context` | GET | `{skills, dataFiles, guardrails}` read from `agent/` — powers the Agent Console context panel |
| `/api/upload` | POST | CSV upload → `detectCsvShape` → `analyzeUpload` or `analyzeArUpload` |
| `/api/actions` | GET / POST | List (with filters) or create actions |
| `/api/actions/[id]` | PATCH | Update action status |
| `/api/actions/[id]/ar` | GET / POST | Lazy-draft dunning email, or run AR ops (`mark_sent` / `snooze` / `escalate`) |
| `/api/chart/budget-vs-actual` | GET | Aggregated data for the budget chart |
| `/api/stats` | GET | Command Center stats (counts, AR donut, top variances) |
| `/api/data-sources` | GET | List for user (supports `?shape=variance\|ar`) |
| `/api/data-sources/link-sheet` | POST | Link a Google Sheet by published CSV URL |
| `/api/data-sources/[id]/reanalyze` | POST | Re-run agent on an existing source |
| `/api/documents` | GET / POST | List / create markdown reports |
| `/api/documents/[id]` | GET | Fetch a single document |
| `/api/documents/generate` | POST | Ask the agent to generate a fresh report |
| `/api/seed-demo` | POST | Seed demo variance data |

### AR operations detail

All AR POST operations run inside `prisma.$transaction` to atomically update both Invoice and Action:

| Operation | Invoice.status | Action.status | Side Effects |
|---|---|---|---|
| `mark_sent` | `open → sent` | `pending → approved` | Sets `lastDunnedAt = now` |
| `snooze` | `open → snoozed` | `pending → dismissed` | Sets `snoozedUntil = now + 7d` |
| `escalate` | `open → escalated` | `pending → flagged` | Generates fresh escalation draft |

---

## CSV Ingestion

### Auto-detection pipeline

1. User uploads a CSV via the Data Sources upload area
2. `parseCSV(text)` splits into headers + rows
3. `detectCsvShape(headers)` classifies using a regex fast-path:
   - **AR:** headers match invoice + (due date | customer | amount due) — at least 2 of 4 signals
   - **Variance:** headers match both budget and actual
   - **Unknown:** falls back to LLM classification via `inferColumnMapping()` (Gemini if `GEMINI_API_KEY` is set); returns 400 if still unknown
4. Routes to the matching parser and triggers the appropriate agent workflow (`analyzeUpload` or `analyzeArUpload`)

### Variance parser

- `autoDetectColumns(headers)` — regex matching for account, period, actual, budget, category
- Inserts `FinancialRecord` rows, triggers `analyzeUpload()`

### AR parser (`lib/csv/ar-parser.ts`)

- Required: invoiceNumber, customer, amount, invoiceDate, dueDate
- Optional: customerEmail
- Date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MMM-YYYY`
- Handles `$` and `,` in amounts
- Skip reasons: `missing_required_field`, `unparseable_date`, `negative_amount`, `invalid_amount`
- Upserts `Invoice` rows (idempotent on `dataSourceId + invoiceNumber`)

---

## AR Follow-ups

### Invoice state machine

```
open ──(mark_sent)──> sent ──(14d cooldown passes)──> open
 │                     │
 │                     └──(escalate)──> escalated  [terminal]
 │
 ├──(snooze)──> snoozed ──(snoozedUntil passes)──> open
 │
 ├──(escalate)──> escalated  [terminal]
 │
 └──(user marks paid, future)──> paid  [terminal]
```

- `scan_ar_aging` is the single eligibility check — filters out snoozed, cooldown, and non-overdue invoices
- "Sent" invoices become eligible again after 14 days (no cron — next scan picks them up)
- One invoice can accumulate multiple Action rows over time, but only one `pending` action exists at a time (enforced by dedupe on `invoiceId`)

### Dunning email tones

| Bucket | Days Overdue | Tone | Subject Line |
|---|---|---|---|
| Info | 1-14 | Friendly | "Friendly Reminder — Invoice INV-XXXX" |
| Warning | 15-44 | Firm | "Payment Overdue — Invoice INV-XXXX" |
| Critical | 45+ | Escalation | "URGENT — Invoice INV-XXXX Significantly Overdue" |

Exported helpers `inferToneFromInvoice(dueDate)` and `buildDunningEmailBody(invoice, tone)` are shared between the agent tool (`draft_dunning_email`) and the AR API route so the UI and agent produce byte-identical drafts.

---

## Testing

```bash
npm test          # run once
npm run test:watch
```

Pure unit tests in `__tests__/lib/`:

- `utils.test.ts` — `relativeTime`, `formatCurrency`, `severityColor`
- `csv/detect-shape.test.ts` — regex fast-path CSV classification
- `csv/variance-parser.test.ts` — column detection + row parsing
- `csv/ar-parser.test.ts` / `ar-parser-dates.test.ts` — AR parser + date format matrix
- `invoice-state.test.ts` — state transition matrix + action status mapping
- `agent/ar-tools.test.ts` — tone inference + dunning email body builder
- `agent/allowed-tools.test.ts` — `buildAllowedTools` union behavior

No database, no network. Agent tools that hit Prisma are tested via their exported pure helpers (`inferToneFromInvoice`, `buildDunningEmailBody`).

---

## Sample Data

- `public/sample-budget-vs-actual.csv` — budget vs actual with multiple categories
- `public/sample-q1-budget.csv` — Q1 quarterly budget
- `public/sample-ar-aging.csv` — 8 invoices spread across buckets (2 friendly, 3 firm, 2 escalation, 1 cooldown-skipped)

---

## Scripts & Auth

```bash
npm run db:seed              # Seed demo variance data
npx tsx scripts/seed-ar.ts   # Seed AR aging demo data
npx tsc --noEmit             # Type check
npm run lint                 # Lint
```

**Auth** is cookie-based for demo simplicity: enter any email at `/login`, `proxy.ts` gates everything except `/login` and `/api/*` on the `lyzr-session` cookie. No password, no OAuth — this is an internal / demo tool.

---

## Design Docs

Detailed design specs live in `docs/superpowers/specs/`:

- `2026-04-15-v3-agenticos-rebuild-design.md` — AgenticOS rebuild: Command Center, Agent Console, journey shells, Build & Observe surfaces
- `2026-04-14-v2-dashboard-polish-design.md` — V2 dashboard polish (pre-rebuild)
- `2026-04-10-v1.5-ar-followups-design.md` — V1.5 AR follow-ups state machine and architecture decisions
