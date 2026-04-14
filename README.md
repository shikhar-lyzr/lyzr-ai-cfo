# Lyzr AI CFO

Proactive AI-powered financial operations assistant. Detects budget variances, manages accounts receivable follow-ups, drafts dunning emails, and surfaces action items — all through an agent-first architecture powered by [Lyzr Agent Studio](https://www.lyzr.ai/) via the [gitclaw](https://www.npmjs.com/package/gitclaw) SDK.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Agent System](#agent-system)
- [Data Model](#data-model)
- [API Routes](#api-routes)
- [UI Components](#ui-components)
- [CSV Ingestion](#csv-ingestion)
- [AR Follow-ups (V1.5)](#ar-follow-ups-v15)
- [Testing](#testing)
- [Sample Data](#sample-data)
- [Scripts](#scripts)

---

## Features

### Variance Detection
- Upload a budget-vs-actual CSV and the AI agent automatically identifies variances exceeding thresholds
- Creates action cards (critical >20%, warning 10-20%, info 5-10%) with one-click Approve / Flag / Dismiss
- Generates executive-level commentary and draft emails for variance follow-ups

### AR Follow-ups (V1.5)
- Upload an AR aging CSV and the agent buckets overdue invoices by age (1-14d friendly, 15-44d firm, 45d+ escalation)
- Drafts tone-appropriate dunning emails cached on each action card
- One-click **Copy & Mark Sent**, **Snooze 7d**, or **Escalate** — each atomically updates both the invoice and action state
- Click-to-expand inline email preview on each AR card
- "Scan AR" button on the morning briefing for on-demand re-scans

### Dashboard (V2)
- **Stats strip** with action counts, AR total donut, and top-3 variances
- **Compact action rows** (52px) — click to open a right-side slide-over with full detail and action buttons
- **Budget vs actual chart** (Recharts) in the right panel
- **Morning briefing** auto-streams into chat as the first agent message (cached per session)

### Data Sources (V2)
- Tabbed view: **Variance** and **Accounts Receivable**
- Upload CSV on either tab — shape is auto-detected and validated against the active tab
- **Link a Google Sheet** by pasting its published CSV URL
- **Re-analyze** any ready source on demand

### Documents
- Markdown rendering via `react-markdown`
- Inline error banners and a fix for the generate-race condition

### Chat
- Follow-up questions about any action or financial data
- SSE streaming responses through the Lyzr agent
- Context-aware — the agent has access to all uploaded data via tools

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Icons | lucide-react | 1.7.0 |
| Charts | Recharts | 3.8.1 |
| Markdown | react-markdown | 10.1.0 |
| Database | SQLite via Prisma | 6.19.3 |
| Agent SDK | gitclaw | 1.3.3 |
| AI Engine | Lyzr Agent Studio v4 | — |
| Testing | Vitest | 4.1.3 |
| Language | TypeScript | 5.x |

> **Important:** This project uses Next.js 16.2.2 which has breaking changes from earlier versions. Check `node_modules/next/dist/docs/` for the current API reference before modifying route handlers or other framework-level code.

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
# Generate the Prisma client
npx prisma generate

# Run migrations (creates SQLite dev.db)
npx prisma migrate dev
```

If migrations fail due to drift (tables created outside migrations), reset first:

```bash
npx prisma migrate reset --force
npx prisma migrate dev
```

### Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login` — enter any email to create a demo account.

### Load Sample Data

Once logged in, click **"Try with Sample Data"** on the empty dashboard, or upload your own CSV from the Data Sources page.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Database (SQLite — no external DB required)
DATABASE_URL="file:./dev.db"

# Lyzr AI Studio (PRIMARY — powers the agent via gitclaw)
LYZR_API_KEY="sk-your-lyzr-api-key"
OPENAI_API_KEY="sk-your-lyzr-api-key"   # Same key — gitclaw uses OpenAI-compatible auth

# Google Gemini (OPTIONAL — legacy fallback for CSV column mapper)
GEMINI_API_KEY="your-gemini-key"
```

**Key details:**
- `OPENAI_API_KEY` must match `LYZR_API_KEY` — the gitclaw SDK routes Bearer auth through the OpenAI-compatible endpoint
- The agent model config is `lyzr:69d43ccef008dd037bad64d7@https://agent-prod.studio.lyzr.ai/v4`
- `GEMINI_API_KEY` is optional — used as a fallback when the Lyzr engine is unavailable for CSV column mapping
- The app checks for any of the three keys at startup and returns 503 if none are configured

---

## Project Structure

```
lyzr-ai-cfo/
├── agent/                         # Agent personality, rules, and skills
│   ├── SOUL.md                    # Agent identity and communication style
│   ├── RULES.md                   # Behavioral constraints (12 rules)
│   ├── DUTIES.md                  # Proactive triggers (upload, scan, chat)
│   ├── skills/
│   │   ├── variance-review/       # Variance analysis workflow
│   │   ├── ar-followup/           # AR dunning workflow
│   │   ├── monthly-close/         # Placeholder
│   │   └── budget-reforecast/     # Placeholder
│   ├── knowledge/                 # Domain reference (thresholds, formats, drivers)
│   └── examples/                  # Few-shot examples for the agent
│
├── app/                           # Next.js App Router
│   ├── (dashboard)/               # Authenticated dashboard routes
│   │   ├── page.tsx               # Main dashboard (feed + briefing + chat)
│   │   ├── data-sources/page.tsx  # Data sources management
│   │   └── settings/page.tsx      # Settings page
│   ├── api/                       # API route handlers
│   │   ├── actions/               # Action CRUD + AR operations
│   │   │   ├── route.ts           # GET (list) + POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts       # PATCH (update status)
│   │   │       └── ar/route.ts    # GET (draft) + POST (mark_sent/snooze/escalate)
│   │   ├── auth/                  # Auth routes
│   │   ├── chat/route.ts          # SSE streaming agent chat
│   │   ├── chart/
│   │   │   └── budget-vs-actual/route.ts  # Budget chart data
│   │   ├── data-sources/
│   │   │   ├── route.ts           # List data sources (supports shape filter)
│   │   │   ├── link-sheet/route.ts        # Link a Google Sheet CSV URL
│   │   │   └── [id]/reanalyze/route.ts    # Re-run agent on an existing source
│   │   ├── stats/route.ts         # Dashboard stats strip data
│   │   ├── seed-demo/route.ts     # Seed demo variance data
│   │   └── upload/route.ts        # CSV upload (auto-detects variance vs AR)
│   ├── login/page.tsx             # Login page
│   └── layout.tsx                 # Root layout
│
├── components/                    # React components
│   ├── chat/
│   │   ├── chat-panel.tsx         # Chat container (first message = morning briefing)
│   │   ├── chat-input.tsx         # Message input
│   │   └── message-bubble.tsx     # Chat message rendering
│   ├── dashboard/
│   │   └── budget-chart.tsx       # Recharts budget vs actual bar chart
│   ├── data-sources/
│   │   ├── upload-area.tsx        # File upload dropzone
│   │   ├── link-sheet-area.tsx    # Google Sheet CSV link form
│   │   └── source-list.tsx        # Data source list with re-analyze
│   ├── feed/
│   │   ├── stats-strip.tsx        # Counts + AR donut + top variances
│   │   ├── action-card.tsx        # Compact 52px row
│   │   ├── action-modal.tsx       # Right-side slide-over with full detail
│   │   ├── action-feed.tsx        # Scrollable feed with filtering
│   │   └── filter-bar.tsx         # Type/Severity/Status filter chips
│   └── layout/
│       ├── sidebar.tsx            # Navigation sidebar
│       └── resizable-split-pane.tsx # Resizable layout container
│
├── lib/                           # Shared libraries
│   ├── agent/
│   │   ├── index.ts               # Agent query functions (analyzeUpload, analyzeArUpload, chat)
│   │   └── tools.ts               # 10 agent tools + shared helpers
│   ├── csv/
│   │   ├── detect-shape.ts        # CSV classifier (variance/ar/unknown)
│   │   ├── variance-parser.ts     # Shared variance parser (upload + re-analyze)
│   │   ├── ar-parser.ts           # AR aging CSV parser
│   │   └── llm-mapper.ts          # LLM column mapping fallback
│   ├── auth.ts                    # Session cookie helpers
│   ├── db.ts                      # Prisma client singleton
│   ├── types.ts                   # Shared TypeScript types
│   └── utils.ts                   # Formatting utilities
│
├── prisma/
│   ├── schema.prisma              # Database schema (6 models)
│   ├── seed.ts                    # Demo variance seed
│   └── migrations/                # Prisma migrations
│
├── public/
│   ├── sample-ar-aging.csv        # 8 sample AR invoices
│   ├── sample-budget-vs-actual.csv
│   └── sample-q1-budget.csv
│
├── scripts/
│   └── seed-ar.ts                 # AR seed script
│
├── __tests__/                     # Vitest test suite
│   └── lib/
│       ├── utils.test.ts
│       ├── invoice-state.test.ts
│       ├── agent/ar-tools.test.ts
│       └── csv/
│           ├── detect-shape.test.ts
│           ├── ar-parser.test.ts
│           └── ar-parser-dates.test.ts
│
└── docs/superpowers/specs/        # Design specs
```

---

## Architecture

### Agent-First Design

The gitclaw agent is the **sole source of truth** for all financial analysis. Next.js routes are thin wrappers — they receive user input, pass it to the agent, and return the agent's response.

```
User Action (upload CSV, click button, send chat)
    │
    ▼
Next.js API Route (thin wrapper)
    │
    ▼
gitclaw agent (SOUL + RULES + DUTIES + skills)
    │
    ├── Calls tools (search_records, analyze, create_actions, etc.)
    │       │
    │       ▼
    │   Prisma (SQLite)
    │
    ▼
SSE stream back to UI (actions feed, briefing, chat)
```

### Key Principles

1. **Agent creates actions, not deterministic code** — variances and AR items are detected by the LLM agent using tools, not hard-coded thresholds in JavaScript
2. **One feed, multiple skills** — variance and AR follow-up cards render in the same feed with the same card component, branching only on `action.type`
3. **Two independent state machines** — `Invoice.status` (business lifecycle) and `Action.status` (workflow lifecycle) are separate; transitions between them are wired only in the AR route handler
4. **CSV shape detection** — upload route auto-classifies CSVs and routes to the correct parser; no user confirmation step

### Data Flow

```
CSV Upload → detectCsvShape(headers) → variance? → parseRows → FinancialRecord → analyzeUpload (agent)
                                     → ar?       → parseArCsv → Invoice         → analyzeArUpload (agent)
                                     → unknown?  → 400 error
```

---

## Agent System

The agent lives in the `agent/` directory and is loaded by gitclaw at query time.

### Files

| File | Purpose |
|---|---|
| `SOUL.md` | Identity, personality, communication style, domain knowledge |
| `RULES.md` | 12 behavioral constraints (data integrity, severity accuracy, no sending emails, etc.) |
| `DUTIES.md` | Proactive triggers — what the agent does on upload, scan, chat, and action management |
| `skills/variance-review/SKILL.md` | Structured variance analysis workflow |
| `skills/ar-followup/SKILL.md` | AR dunning email workflow |
| `knowledge/` | Reference data for thresholds, report formats, common variance drivers |
| `examples/` | Few-shot examples for the agent |

### Tools (10 total)

Defined in `lib/agent/tools.ts`, returned from `createFinancialTools(userId)`:

| Tool | Purpose |
|---|---|
| `search_records` | Query FinancialRecord by account/period/category |
| `analyze_financial_data` | Compute variances, flag by threshold, group by category |
| `create_actions` | Batch-insert variance/anomaly/recommendation actions (dedupes by headline) |
| `update_action` | Change action status |
| `generate_commentary` | Produce variance commentary for reports |
| `draft_email` | Draft variance follow-up email |
| `scan_ar_aging` | Bucket open invoices by days overdue (info/warning/critical) |
| `create_ar_actions` | Batch-insert AR follow-up actions (dedupes by invoiceId) |
| `draft_dunning_email` | Draft tone-appropriate collection email, cache to action.draftBody |
| `update_invoice_status` | Transition invoice state + record ActionEvent |

### Shared Helpers

Exported from `lib/agent/tools.ts` for reuse by the AR API route:

- `inferToneFromInvoice(dueDate)` — returns `friendly` (1-14d), `firm` (15-44d), or `escalation` (45d+)
- `buildDunningEmailBody(invoice, tone)` — generates the email text

---

## Data Model

Six Prisma models in `prisma/schema.prisma`:

### User
Standard user account. Fields: `id`, `lyzrAccountId`, `email`, `name`, `credits`.

### DataSource
Represents an uploaded CSV. Fields: `id`, `userId`, `type` ("csv"), `name`, `status` ("processing"/"ready"/"error"), `recordCount`, `metadata` (JSON string with `{shape: "variance"|"ar", headers: [...]}`).

### FinancialRecord
One row of variance data. Fields: `account`, `period`, `actual`, `budget`, `category`. Belongs to a DataSource.

### Invoice (V1.5)
One AR aging invoice. Fields: `invoiceNumber`, `customer`, `customerEmail?`, `amount`, `invoiceDate`, `dueDate`, `status` ("open"/"sent"/"snoozed"/"escalated"/"paid"), `lastDunnedAt?`, `snoozedUntil?`. Unique on `(dataSourceId, invoiceNumber)`.

### Action
A feed item created by the agent. Fields: `type` ("variance"/"anomaly"/"recommendation"/"ar_followup"), `severity` ("critical"/"warning"/"info"), `headline`, `detail`, `driver`, `status` ("pending"/"flagged"/"dismissed"/"approved"), `invoiceId?`, `draftBody?`.

### ActionEvent
Audit trail for action status changes. Fields: `actionId`, `userId`, `fromStatus`, `toStatus`.

### Entity Relationships

```
User ──< DataSource ──< FinancialRecord
  │          │
  │          └──< Invoice ──< Action ──< ActionEvent
  │                              │
  └──────────────< Action ───────┘
  │
  └──< ChatMessage
```

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth` | POST | Create account / login (sets session cookie) |
| `/api/auth/me` | GET | Current user from session cookie |
| `/api/upload` | POST | CSV upload — auto-detects shape, parses, triggers agent analysis |
| `/api/actions` | GET | List actions for user (supports type/severity/status filters) |
| `/api/actions` | POST | Create a single action |
| `/api/actions/[id]` | PATCH | Update action status (generic: pending/flagged/dismissed/approved) |
| `/api/actions/[id]/ar` | GET | Return (and lazily generate) dunning email draft |
| `/api/actions/[id]/ar` | POST | AR operations: `{op: "mark_sent"}`, `{op: "snooze", days: 7}`, `{op: "escalate"}` |
| `/api/chat` | POST | SSE streaming agent chat |
| `/api/chart/budget-vs-actual` | GET | Aggregated data for the budget chart |
| `/api/stats` | GET | Dashboard stats strip (counts, AR total, top variances) |
| `/api/data-sources` | GET | List data sources for user (supports `?shape=variance\|ar`) |
| `/api/data-sources/link-sheet` | POST | Link a Google Sheet by published CSV URL |
| `/api/data-sources/[id]/reanalyze` | POST | Re-run agent analysis on an existing source |
| `/api/seed-demo` | POST | Seed demo variance data |

### AR Operations Detail

All AR POST operations run inside `prisma.$transaction` to atomically update both the Invoice and Action:

| Operation | Invoice.status | Action.status | Side Effects |
|---|---|---|---|
| `mark_sent` | `open → sent` | `pending → approved` | Sets `lastDunnedAt = now` |
| `snooze` | `open → snoozed` | `pending → dismissed` | Sets `snoozedUntil = now + 7d` |
| `escalate` | `open → escalated` | `pending → flagged` | Generates fresh escalation draft |

---

## UI Components

### Dashboard (`app/(dashboard)/page.tsx`)

The main view is a resizable split pane:
- **Left:** `StatsStrip` (counts + AR donut + top variances) above a compact `ActionFeed`
- **Right:** `BudgetChart` (top) + `ChatPanel` (bottom). The morning briefing streams into chat as the first agent message.

### Stats Strip (`components/feed/stats-strip.tsx`)

Three tiles: pending/flagged counts, AR total with a donut by bucket, and the top 3 variances by absolute delta. Fed by `/api/stats`.

### Action Card (`components/feed/action-card.tsx`)

Compact 52px row: severity dot, headline, amount, status chip. Clicking a row selects it and opens `ActionModal`.

### Action Modal (`components/feed/action-modal.tsx`)

Right-side slide-over (portal, esc-to-close) showing full action detail plus the workflow buttons:

**Variance/Anomaly/Recommendation:** Approve, Flag, Ask AI, Dismiss.

**AR Follow-up (`ar_followup`):** Copy & Mark Sent, Snooze 7d, Escalate, Ask AI, Dismiss. The dunning draft is lazy-loaded from `GET /api/actions/[id]/ar` on first open. Includes an inline history section.

### Filter Bar (`components/feed/filter-bar.tsx`)

Three filter groups: Type (All/Variance/Anomaly/Rec./AR), Severity (All/Critical/Warning/Info), Status (All/Pending/Flagged/Dismissed).

### Budget Chart (`components/dashboard/budget-chart.tsx`)

Recharts bar chart driven by `/api/chart/budget-vs-actual`. Replaces the standalone morning briefing panel.

---

## CSV Ingestion

### Auto-Detection Pipeline

1. User uploads a CSV via the upload area
2. `parseCSV(text)` splits into headers + rows
3. `detectCsvShape(headers)` classifies using regex fast-path:
   - **AR:** headers match invoice + (due date | customer | amount due) — at least 2 of 4 signals
   - **Variance:** headers match both budget and actual
   - **Unknown:** falls back to LLM classification, returns 400 if still unknown
4. Routes to the appropriate parser

### Variance Parser (existing)

- `autoDetectColumns(headers)` — regex matching for account, period, actual, budget, category
- LLM fallback via `inferColumnMapping()` for non-standard headers
- Inserts `FinancialRecord` rows, triggers `analyzeUpload()` agent call

### AR Parser (`lib/csv/ar-parser.ts`)

- Required fields: invoiceNumber, customer, amount, invoiceDate, dueDate
- Optional: customerEmail
- Date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MMM-YYYY`
- Handles `$` and `,` in amounts
- Skips rows with reasons: `missing_required_field`, `unparseable_date`, `negative_amount`, `invalid_amount`
- LLM fallback for non-standard column headers
- Inserts `Invoice` rows via upsert (idempotent on `dataSourceId + invoiceNumber`)

---

## AR Follow-ups (V1.5)

### Invoice State Machine

```
open ──(mark_sent)──> sent ──(14d cooldown passes)──> open  [re-dunning eligible]
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
- One invoice can accumulate multiple Action rows over time (one per dunning cycle), but only one `pending` action exists at a time (enforced by dedupe)

### Dunning Email Tones

| Bucket | Days Overdue | Tone | Subject Line |
|---|---|---|---|
| Info | 1-14 | Friendly | "Friendly Reminder — Invoice INV-XXXX" |
| Warning | 15-44 | Firm | "Payment Overdue — Invoice INV-XXXX" |
| Critical | 45+ | Escalation | "URGENT — Invoice INV-XXXX Significantly Overdue" |

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

### Test Suite (146 tests, 13 files)

Covers:

- `__tests__/lib/utils.test.ts` — `relativeTime`, `formatCurrency`, `severityColor`
- `__tests__/lib/csv/detect-shape.test.ts` — regex fast-path CSV classification
- `__tests__/lib/csv/variance-parser.test.ts` — shared variance parser (column detection, row parsing)
- `__tests__/lib/csv/ar-parser.test.ts` — AR column detection, row parsing, skip reasons
- `__tests__/lib/csv/ar-parser-dates.test.ts` — date format matrix (3 formats + invalid inputs)
- `__tests__/lib/invoice-state.test.ts` — state transition matrix + action status mapping
- `__tests__/lib/agent/ar-tools.test.ts` — tone inference buckets + dunning email builder

All tests are pure unit tests — no database or network calls. Agent tools that hit Prisma are tested via their exported pure helpers (`inferToneFromInvoice`, `buildDunningEmailBody`).

---

## Sample Data

### Variance Data
- `public/sample-budget-vs-actual.csv` — budget vs actual with multiple categories
- `public/sample-q1-budget.csv` — Q1 quarterly budget data

### AR Aging Data
- `public/sample-ar-aging.csv` — 8 invoices spread across buckets:
  - 2 friendly (1-14 days overdue)
  - 3 firm (15-44 days overdue)
  - 2 escalation (45+ days overdue)
  - 1 recently dunned (will be skipped by cooldown filter)

---

## Scripts

```bash
# Seed demo variance data (also available via UI button)
npm run db:seed

# Seed AR aging demo data
npx tsx scripts/seed-ar.ts

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## Auth

Authentication is cookie-based for simplicity (demo app):
- Login at `/login` with any email — creates a `User` row if it doesn't exist
- Session stored as a JSON cookie (`lyzr-session`)
- Middleware redirects unauthenticated requests to `/login` (except API routes and static assets)
- No password, no OAuth — this is a demo/internal tool

---

## Design Docs

Detailed design specifications live in `docs/superpowers/specs/`:
- `2026-04-10-v1.5-ar-followups-design.md` — Full V1.5 AR follow-ups design spec including architecture decisions, rejected alternatives, and state machine details
- `2026-04-14-v2-dashboard-polish-design.md` — V2 dashboard polish: stats strip, compact rows + slide-over, tabbed data sources, Google Sheet linking, budget chart, briefing-in-chat
