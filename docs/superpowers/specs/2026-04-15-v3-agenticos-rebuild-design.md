# V3 — AgenticOS Full Rebuild: Command Center, Agent Console, Journey Pages, Build & Observe Shells

**Date:** 2026-04-15
**Branch:** main
**Approach:** Full rebuild (Approach A) — new app structure, new design system, experience-first
**Priority:** Tier 1 (live) → Command Center, Agent Console, 6 Journey Pages. Tier 2 (sample data shells) → 5 Build + 4 Observe pages.

---

## Context

The current app is a single-dashboard layout with an action feed, chat panel, data sources, and documents. The target is a full AgenticOS platform matching the specifications in:

- `COMMAND_CENTER.md` — home page design
- `AGENT_STREAMING.md` — agent execution display, pipeline visualization, SSE streaming
- `BUILD_JOURNEYS.md` — sidebar structure, 5 Build pages, skill vs sub-agent framework
- `OBSERVE_JOURNEYS.md` — 4 Observe pages (Decision Inbox, Agent Runs, Compliance, Audit Trail)
- `DESIGN_SYSTEM.md` — warm cream/brown palette, typography, glassmorphism, components
- `LLM_WIKI_IMPLEMENTATION.md` — wiki-instead-of-RAG, D3 graph, three wiki skills

**What we keep:** Prisma schema (SQLite), gitclaw agent integration (`lib/agent/`), all API routes, financial tools, existing skills (variance-review, ar-followup, monthly-close, budget-reforecast), auth/session, CSV parsing, LLM column mapper.

**What we replace:** The entire `(dashboard)` layout group, all current components, globals.css theme, page structure.

---

## Part 1: App Structure & Routing

```
app/
├── layout.tsx                              # Root: fonts, globals, metadata
├── login/page.tsx                          # Existing auth (keep)
├── (shell)/                                # New layout group
│   ├── layout.tsx                          # AgenticOS sidebar + main content
│   ├── page.tsx                            # Command Center (home)
│   ├── agent-console/page.tsx              # Full-screen agent chat
│   │
│   ├── monthly-close/page.tsx              # Journey pages (6)
│   ├── financial-reconciliation/page.tsx
│   ├── regulatory-capital/page.tsx
│   ├── ifrs9-ecl/page.tsx
│   ├── daily-liquidity/page.tsx
│   ├── regulatory-returns/page.tsx
│   │
│   ├── agent-studio/page.tsx               # Build pages (5) — sample data
│   ├── skills-manager/page.tsx
│   ├── knowledge-base/page.tsx
│   ├── integrations/page.tsx
│   ├── skill-flows/page.tsx
│   │
│   ├── decision-inbox/page.tsx             # Observe pages (4) — sample data
│   ├── agent-runs/page.tsx
│   ├── compliance/page.tsx
│   ├── audit-trail/page.tsx
│   │
│   ├── data-sources/page.tsx               # Keep existing (re-styled)
│   ├── documents/page.tsx                  # Keep existing (re-styled)
│   └── settings/page.tsx                   # Keep existing (re-styled)
│
├── api/                                    # All existing API routes unchanged
│   ├── chat/route.ts                       # Rewrite SSE format (Part 5)
│   ├── actions/route.ts
│   ├── data-sources/...
│   ├── documents/...
│   ├── stats/route.ts
│   ├── chart/...
│   ├── upload/route.ts
│   ├── dashboard/insights/route.ts         # New — sample data
│   └── agent/context/route.ts              # New — serves sidebar context panel data
```

The old `(dashboard)` layout group is deleted after migration. All routes inside `(shell)` share the sidebar layout.

---

## Part 2: Design System

### 2.1 Fonts

Add to `app/layout.tsx` via next/font or Google Fonts link:

- **Playfair Display** (400, 500, 600, 700) — headings, titles, metric numbers
- **DM Sans** (300, 400, 500, 600, 700) — body, labels, buttons, nav
- **JetBrains Mono** (400, 500) — code blocks, pipeline traces

CSS custom properties:
```css
:root {
  --font-sans: 'DM Sans', system-ui, sans-serif;
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 2.2 Color Palette

Replace all existing CSS variables in `globals.css`:

```css
:root {
  --background:           36 33% 94%;
  --card:                 36 30% 96%;
  --card-foreground:      25 40% 18%;
  --popover:              36 30% 96%;
  --popover-foreground:   25 40% 18%;
  --foreground:           25 40% 18%;
  --muted:                30 20% 90%;
  --muted-foreground:     25 20% 45%;
  --primary:              25 62% 25%;
  --primary-foreground:   36 33% 94%;
  --secondary:            30 15% 90%;
  --secondary-foreground: 25 40% 18%;
  --border:               30 15% 85%;
  --input:                30 15% 85%;
  --ring:                 25 62% 25%;
  --radius:               0.75rem;
  --destructive:          0 84% 60%;
  --destructive-foreground: 0 0% 98%;
  --success:              142 71% 45%;
  --warning:              38 92% 50%;
  --info:                 217 91% 60%;
  --accent-from:          25 62% 25%;
  --accent-to:            30 55% 45%;
}
```

### 2.3 Background Texture

```css
body {
  background: hsl(36, 33%, 94%);
  background-image:
    linear-gradient(rgba(103, 63, 27, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(103, 63, 27, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### 2.4 Glassmorphism

```css
.glass         { background: rgba(255, 252, 248, 0.55); backdrop-filter: blur(20px); }
.glass-strong  { background: rgba(255, 252, 248, 0.72); backdrop-filter: blur(24px); }
.glass-sidebar { background: rgba(255, 252, 248, 0.65); backdrop-filter: blur(30px); }
.glass-card    { background: rgba(255, 252, 248, 0.50); backdrop-filter: blur(16px); }
.glass-input   { background: rgba(255, 252, 248, 0.40); backdrop-filter: blur(12px); }
```

### 2.5 Typography Scale

| Element | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Page title (h1) | Playfair Display | 28-32px | 600 | -0.02em |
| Section title (h2) | Playfair Display | 22-24px | 600 | -0.02em |
| Card title (h3) | Playfair Display | 18-20px | 500 | -0.01em |
| Subtitle (h4) | Playfair Display | 16px | 500 | -0.01em |
| Body text | DM Sans | 14-15px | 400 | normal |
| Small text | DM Sans | 12-13px | 400 | normal |
| Button text | DM Sans | 14px | 500 | normal |
| Badge/chip | DM Sans | 12px | 500 | 0.02em |
| Code/mono | JetBrains Mono | 13px | 400 | normal |
| Metric number | Playfair Display | 28-36px | 600 | -0.02em |
| Metric label | DM Sans | 11-12px | 500 | 0.05em (uppercase) |

### 2.6 Component Patterns

**Buttons:**
- Primary: `bg-primary text-primary-foreground rounded-[var(--radius)]` hover opacity 0.9
- Secondary: `bg-secondary text-secondary-foreground border border-border`
- Destructive: `bg-destructive text-destructive-foreground`
- Ghost: `bg-transparent hover:bg-secondary/50`
- Outline: `bg-transparent border border-border text-foreground`

**Cards:**
```css
background: hsl(var(--card));
border: 1px solid hsl(var(--border));
border-radius: var(--radius);
padding: 1.25rem;
```
Minimal shadow (`shadow-sm` at most). No heavy drop shadows.

**Status Badges** (pill-shaped, `rounded-full text-xs px-2 py-0.5`):
- Active: `bg-green-50 text-green-700 border-green-200`
- Available: `bg-gray-50 text-gray-600 border-gray-200`
- Draft: `bg-amber-50 text-amber-700 border-amber-200`
- Error: `bg-red-50 text-red-700 border-red-200`
- Running: `bg-blue-50 text-blue-700 border-blue-200`

**Priority Badges:**
- CRITICAL: `bg-red-100 text-red-800 font-semibold uppercase text-xs`
- HIGH: `bg-amber-100 text-amber-800`
- MEDIUM: `bg-stone-100 text-stone-700`
- LOW: `bg-gray-100 text-gray-600`

**Tables:** Horizontal borders only, no alternating rows, uppercase 11px DM Sans headers with tracking-wide.

**Code blocks:**
- Input (dark): `bg-[hsl(25,30%,15%)] text-[hsl(36,20%,80%)]` mono 13px
- Output (tinted): `bg-[hsl(152,30%,92%)] text-[hsl(152,40%,20%)]` mono 13px

### 2.7 Icons

Lucide React exclusively. No emoji in UI chrome.

**Sidebar nav icons:**
| Page | Lucide Icon |
|---|---|
| Home | Home |
| Monthly Close | Calendar |
| Financial Reconciliation | RefreshCw |
| Regulatory Capital | Landmark |
| IFRS 9 ECL | BarChart3 |
| Daily Liquidity | Droplets |
| Regulatory Returns | FileText |
| Agent Studio | Bot |
| Skills Manager | Wrench |
| Knowledge Base | BookOpen |
| Integrations | Plug |
| Skill Flows | GitBranch |
| Decision Inbox | Inbox |
| Agent Runs | Search |
| Compliance & Guardrails | Shield |
| Audit Trail | ClipboardList |

**Pipeline step icons:**
| Step type | Icon | Color class |
|---|---|---|
| agent_init | Cpu | text-gray-500 |
| skill_discovery | Compass | text-blue-600 |
| skill_load | BookOpen | text-indigo-600 |
| memory_load | Brain | text-purple-600 |
| file_read | FileSearch | text-teal-600 |
| file_write | FilePlus | text-green-600 |
| tool_exec | Terminal | text-amber-600 |
| llm_thinking | Sparkles | text-violet-500 |
| wiki_update | Network | text-purple-600 |
| output_ready | CheckCircle | text-green-600 |
| error | AlertCircle | text-red-600 |

### 2.8 Animations

Install `framer-motion`.

- Pipeline steps: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}`
- Card hover: `whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}`
- Slide-over panels: `initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}`
- Spinners: `animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}`
- All animations 150-300ms. No bounce. No dramatic page transitions.

### 2.9 Spacing

| Token | Value | Usage |
|---|---|---|
| gap-2 | 8px | Between badges, icon+label |
| gap-3 | 12px | Between list items |
| gap-4 | 16px | Cards in grid, form fields |
| gap-6 | 24px | Sections within page |
| gap-8 | 32px | Major page sections |
| p-4 | 16px | Card padding (compact) |
| p-5 | 20px | Card padding (standard) |
| px-8 | 32px | Page horizontal padding |

---

## Part 3: Sidebar & Shell Layout

### 3.1 Configuration

```ts
// lib/config/journeys.ts
import {
  Home, Calendar, RefreshCw, Landmark, BarChart3, Droplets, FileText,
  Bot, Wrench, BookOpen, Plug, GitBranch, Inbox, Search, Shield, ClipboardList
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  description?: string;  // for journey cards on Command Center
}

export const NAV_HOME: NavItem = {
  id: "home", label: "Home", icon: Home, path: "/"
};

export const JOURNEYS: NavItem[] = [
  { id: "monthly-close", label: "Monthly Close", icon: Calendar, path: "/monthly-close",
    description: "Consolidation, trial balances, sub-ledger postings & close calendar" },
  { id: "financial-reconciliation", label: "Financial Reconciliation", icon: RefreshCw, path: "/financial-reconciliation",
    description: "GL vs sub-ledger matching, break identification & ageing analysis" },
  { id: "regulatory-capital", label: "Regulatory Capital", icon: Landmark, path: "/regulatory-capital",
    description: "CET1, RWA, leverage ratios & Basel III compliance assessment" },
  { id: "ifrs9-ecl", label: "IFRS 9 ECL", icon: BarChart3, path: "/ifrs9-ecl",
    description: "Expected credit loss staging, PD/LGD models & macro overlays" },
  { id: "daily-liquidity", label: "Daily Liquidity", icon: Droplets, path: "/daily-liquidity",
    description: "LCR, NSFR, cash flow forecasting & intraday position monitoring" },
  { id: "regulatory-returns", label: "Regulatory Returns", icon: FileText, path: "/regulatory-returns",
    description: "COREP, FINREP, FR Y-9C filing preparation & validation" },
];

export const BUILD_NAV: NavItem[] = [
  { id: "agent-studio", label: "Agent Studio", icon: Bot, path: "/agent-studio" },
  { id: "skills-manager", label: "Skills Manager", icon: Wrench, path: "/skills-manager" },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base" },
  { id: "integrations", label: "Integrations", icon: Plug, path: "/integrations" },
  { id: "skill-flows", label: "Skill Flows", icon: GitBranch, path: "/skill-flows" },
];

export const OBSERVE_NAV: NavItem[] = [
  { id: "decision-inbox", label: "Decision Inbox", icon: Inbox, path: "/decision-inbox" },
  { id: "agent-runs", label: "Agent Runs", icon: Search, path: "/agent-runs" },
  { id: "compliance", label: "Compliance & Guardrails", icon: Shield, path: "/compliance" },
  { id: "audit-trail", label: "Audit Trail", icon: ClipboardList, path: "/audit-trail" },
];
```

### 3.2 Shell Layout

```
┌──────────┬───────────────────────────────────────────────┐
│          │                                               │
│ Sidebar  │            Main Content                       │
│ 220px    │            flex-1                             │
│ fixed    │            px-8 pt-8 pb-4                     │
│ glass-   │            overflow-y-auto                    │
│ sidebar  │                                               │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

Sidebar: `w-[220px] shrink-0 h-screen sticky top-0 overflow-y-auto glass-sidebar border-r border-border`

Three nav sections with DM Sans 11px uppercase tracking-widest headers: "DOMAIN JOURNEYS", "BUILD", "OBSERVE".

Status bar at bottom:
```
⚡ Agent Active
Claude Sonnet 4.6
Powered by Lyzr AgenticOS
```

Active nav item: `bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))] rounded-[var(--radius)] font-medium`

---

## Part 4: Command Center

Route: `(shell)/page.tsx`

### 4.1 Layout

Centered, scrollable. Top to bottom:

1. **Hero:** Lyzr icon (48px) → "Welcome, {firstName}" (Playfair 28px 600) → tagline (DM Sans 14px muted)
2. **Search bar:** max-w-2xl, `glass-input`, rounded-2xl. Paperclip left, Send right. On submit → `router.push(\`/agent-console?message=\${encodeURIComponent(value)}\`)`
3. **Agent Journeys:** Sparkles icon + "AGENT JOURNEYS" header. 2-col grid of 6 journey cards from `JOURNEYS` config. Each: icon + Playfair title + DM Sans description + ChevronRight. First card tooltip.
4. **Bottom grid (2-col):**
   - Left: Agent Insights (sample data, severity-coded cards)
   - Right: Actions Required (from `GET /api/actions?status=pending&limit=5`, with Approve/Reject inline)

### 4.2 Agent Insights Sample Data

```ts
const SAMPLE_INSIGHTS = [
  {
    severity: "warning",
    title: "SMB Revenue Miss: -$12.4M (-6.9%)",
    detail: "SMB segment revenue of $168.6M came in $12.4M below the $181.0M forecast. Macro headwinds in the mid-market segment are the primary driver.",
    cta: { label: "Run Variance Analysis", journey: "financial-reconciliation" }
  },
  {
    severity: "critical",
    title: "Executive T&E Anomaly Detected",
    detail: "VP Sales James Mitchell T&E is 312% above peer average ($124,100 Q1 vs peer avg $30,567).",
    cta: { label: "View Expense Report", journey: "monthly-close" }
  },
  {
    severity: "warning",
    title: "5 Vendors Below Risk Threshold",
    detail: "High-risk vendors: CloudHost Inc (3.2/10), DataVault Systems (4.1/10), CloudBridge CDN (4.8/10), Innovatech Labs (3.8/10), DataProtect360 (4.4/10).",
    cta: { label: "Score Vendors", journey: "financial-reconciliation" }
  },
];
```

### 4.3 Actions Required

Pulls from existing Prisma Action model (`status: "pending"`, limit 5). Each rendered with:
- Title (headline), category tag (type), priority badge (severity mapped to CRITICAL/HIGH/MEDIUM), date (createdAt relative), amount (from detail parsing or null)
- Approve/Reject buttons calling existing `PATCH /api/actions/[id]`
- "Show N more" link → navigates to `/decision-inbox`

---

## Part 5: Agent Console

Route: `(shell)/agent-console/page.tsx`

### 5.1 Three-Panel Layout

```
┌─────────────────────────────────┬──────────────────────────┐
│     CHAT + PIPELINE (flex-1)    │   AGENT CONTEXT (320px)  │
│                                 │                          │
│  Agent header                   │  Collapsible sections    │
│  Message history (scrollable)   │  with live updates       │
│  Input bar (sticky bottom)      │                          │
└─────────────────────────────────┴──────────────────────────┘
```

### 5.2 SSE Streaming Rewrite

**Server (`/api/chat/route.ts`):** Rewrite to emit typed SSE events instead of raw text deltas.

New event types:
```ts
type FrontendEvent =
  | { event: "pipeline_step"; data: PipelineStep }
  | { event: "delta"; data: { text: string } }
  | { event: "thinking"; data: { text: string } }
  | { event: "done"; data: { finished: true } }
  | { event: "error"; data: { error: string } };

interface PipelineStep {
  id: string;
  type: "agent_init" | "skill_discovery" | "skill_load" | "memory_load" |
        "file_read" | "file_write" | "tool_exec" | "llm_thinking" |
        "wiki_update" | "output_ready" | "error";
  label: string;
  detail?: string;
  file?: string;
  status: "running" | "completed" | "failed";
  duration?: number;
  content?: string;
}
```

Server-side `classifyEvent(msg: GCMessage)` function maps raw gitclaw events to pipeline steps per AGENT_STREAMING.md Part 2.3:
- `tool_use` with `read` on SKILL.md → `skill_load`
- `tool_use` with `memory` action=load → `memory_load`
- `tool_use` with `read` on data files → `file_read`
- `tool_use` with `write` → `file_write` or `wiki_update`
- `tool_use` with custom tool names → `tool_exec`
- `delta` events → forwarded as `delta` (not pipeline steps)
- `tool_result` → updates previous step status + duration (not a new step)
- `task_tracker` update/loaded → suppressed

Abort flow: Stop button → `abortController.abort()` → `res.on("close")` (not `req.on("close")`) → server aborts gitclaw query.

**Note:** The current gitclaw integration uses `replaceBuiltinTools: true`, so the agent uses our custom tools (search_records, analyze_financial_data, etc.) instead of gitclaw's built-in read/write. The classifier must handle our custom tool names:
- `search_records` → `tool_exec` with label "Searching financial records"
- `analyze_financial_data` → `tool_exec` with label "Analyzing financial data"
- `create_actions` → `tool_exec` with label "Creating action items"
- `generate_commentary` → `tool_exec` with label "Generating commentary"
- `draft_email` / `draft_dunning_email` → `tool_exec` with label "Drafting email"
- `scan_ar_aging` → `tool_exec` with label "Scanning AR aging"
- `save_document` → `file_write` with label "Saving document"
- etc.

### 5.3 Frontend Hook

```ts
// hooks/use-chat-stream.ts
interface ChatState {
  messages: ChatMessage[];
  pipelineSteps: PipelineStep[];
  isStreaming: boolean;
  activeFiles: string[];
  activeSkill: string | null;
}

function useChatStream() → { ...ChatState, sendMessage, stopStream }
```

Parses SSE events from `fetch()` ReadableStream. Updates pipeline steps (add new or update existing by id). Accumulates delta text into the latest assistant message. Handles abort via AbortController.

### 5.4 Agent Header

```
🤖 CFO Agent
● Online & Ready
```

Name from agent.yaml. Green dot + status text.

### 5.5 Pipeline Visualization

Each step: one compact row.
- Lucide icon (16px, colored by step type)
- Status indicator: spinner (running), CheckCircle (completed), XCircle (failed)
- Label text (DM Sans 14px)
- Duration on right (when completed)
- Expand chevron (when expandable content exists)
- Framer Motion slide-in animation

Expanded view (on chevron click):
- `file_read`: dark code block with file path, size, content preview
- `skill_load`: skill name + rendered SKILL.md content
- `tool_exec`: input JSON (dark block) + output JSON (green-tinted block)

On completion: collapse into "▾ N STEPS COMPLETED" bar. Response stays visible below.

### 5.6 Agent Context Panel (Right Sidebar)

Three collapsible sections:

**Active Skills** (count badge): Read skill names from `agent/skills/` via `GET /api/agent/context`. Each skill is a chip with green dot. Shows first 4, "Show N More" expandable. Pulse animation when loaded during current conversation.

**Data Files** (count badge): Read from `agent/knowledge/`. Document icon + filename. Highlight on access.

**Compliance Guardrails** (count badge): Parsed from `agent/RULES.md`. Shield icon + one-line rule summary. Shows first 3.

New API endpoint:
```
GET /api/agent/context
→ { skills: string[], dataFiles: string[], guardrails: string[] }
```

Reads from filesystem at request time (skill dirs, knowledge files, RULES.md parsing).

### 5.7 Auto-Send from Command Center

```ts
useEffect(() => {
  const msg = searchParams.get("message");
  if (msg) {
    sendMessage(msg);
    router.replace("/agent-console");
  }
}, []);
```

### 5.8 Input Bar

- Placeholder: "Message CFO Agent..."
- Send button (Send icon) when idle
- Stop button (Square icon, red) when streaming — calls `stopStream()`
- Disclaimer below: "AI can make mistakes. Verify critical financial data." (DM Sans 11px muted)

### 5.9 Message Rendering

- User messages: right-aligned, primary bg, cream text
- Agent messages: left-aligned, card bg, with pipeline steps above + ReactMarkdown response below
- ReactMarkdown with existing `.doc-body` styles for headings, lists, tables, code blocks

---

## Part 6: Journey Pages

### 6.1 Shared Template

```ts
// components/journey/journey-page.tsx
interface JourneyPageProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  nudges: string[];
  children: React.ReactNode;
}
```

Layout:
1. **Header:** Icon (24px muted) + Playfair title (24px) + DM Sans description (14px muted)
2. **Content area:** `children` — journey-specific sample data
3. **Bottom-docked chat panel:** Collapsed bar → expandable to ~40% height

### 6.2 Journey Chat Panel

Collapsed state: `"Ask about this journey..."` input bar pinned to bottom.

Expanded state:
- Nudge chips (tappable, pre-fill the input)
- Compact chat history + pipeline steps
- Same `useChatStream` hook, passing `journeyId` to the API

API call includes `journeyId`:
```ts
fetch("/api/chat", {
  body: JSON.stringify({ message, journeyId: "monthly-close" })
})
```

Server uses `journeyId` to build scoped `systemPromptSuffix` with journey-relevant data.

### 6.3 Journey Content (Sample Data)

**Monthly Close:**
- Day 3 of 5 progress indicator
- 5-step tracker with completion counts:
  - Sub-ledger Close: 14/14 (green)
  - Interco Recon: 8/8 (green)
  - Journal Entries: 42/56 (amber, in progress)
  - Consolidation: 0/3 (gray, not started)
  - Reporting Package: 0/1 (gray)
- Blocking items list (3-4 items with entity names)
- Nudges: "Are we on track for close?", "What's still open?", "Draft board commentary"

**Financial Reconciliation:**
- 4 metric cards: Matched Transactions (4,105), Match Rate (94.85%), Exceptions (223), Aging >30d (47)
- Top exceptions table (5 rows): reference, amount, type (timing/missing/fee/error), age
- Nudges: "Show unmatched items", "Why is the match rate low?", "Classify exceptions"

**Regulatory Capital:**
- 3 gauge cards: CET1 13.2%, Tier 1 15.1%, Total Capital 17.8%
- All show green "Above minimum" indicator with minimum threshold line
- Basel III compliance status table
- Nudges: "Are we above minimums?", "What drives RWA?", "CET1 trend"

**IFRS 9 ECL:**
- Stage distribution: Stage 1 (Performing), Stage 2 (Under-performing +0.8% MoM), Stage 3 (Non-performing)
- Stage migration table: Stage 1→2 (¥12.3B, +0.8%), Stage 2→3 (¥2.1B, +0.3%)
- Nudges: "Stage 2 migration drivers?", "Update PD models", "Macro overlay impact"

**Daily Liquidity:**
- LCR: 141% (min required 100%), green indicator with +3% delta
- NSFR ratio card
- Cash position summary
- Nudges: "Current LCR?", "Cash forecast next 7 days", "Intraday stress"

**Regulatory Returns:**
- Filing checklist table: COREP (Draft), FINREP (Submitted), FR Y-9C (Validated)
- Each with due date, completion %, status badge
- Nudges: "Filing status?", "What's blocking COREP?", "Validate FR Y-9C"

### 6.4 Journey Context Functions

```ts
// lib/config/journey-context.ts
export async function buildJourneyContext(userId: string, journeyId: string): Promise<string> {
  switch (journeyId) {
    case "monthly-close":
      // Include: close calendar status, open journal entries, sub-ledger completion
      // Pull from: Action model (type: "variance"), FinancialRecord summary
      return buildMonthlyCloseContext(userId);
    case "financial-reconciliation":
      // Include: match results, exception list, aging breakdown
      return buildReconContext(userId);
    // ... etc for each journey
    default:
      return ""; // falls back to full context
  }
}
```

Each function queries Prisma for journey-relevant data and formats it as text for the systemPromptSuffix. For journeys without real data yet, returns a descriptive context string explaining the journey's scope.

---

## Part 7: Build Pages (Sample Data Shells)

All 5 Build pages share:
- "SAMPLE DATA" badge next to title
- `useSampleData()` hook with toggle
- Full design system styling
- Interactive elements show toast "Coming soon" on click

### 7.1 Agent Studio (`/agent-studio`)

**Header:** "Agent Studio" (Playfair 28px) + "Control center for all agents in the OS"

**Grid of agent cards (2-col):**
```ts
const SAMPLE_AGENTS = [
  {
    name: "CFO Office Agent",
    status: "active",
    model: "Claude Sonnet 4.6",
    description: "Primary agent for all financial journeys — reconciliation, close, capital, ECL, liquidity, returns",
    runsToday: 47,
    avgLatency: "12.4s",
    lastRun: "3 min ago",
    skills: ["monthly-financial-close", "financial-recon", "regulatory-capital-computation", "variance-review", "ar-followup"],
    isSubAgent: false,
  },
  {
    name: "AP Automation Agent",
    status: "active",
    model: "Claude Haiku 4.5",
    description: "Invoice processing, duplicate detection, PO matching",
    runsToday: 23,
    avgLatency: "4.2s",
    lastRun: "12 min ago",
    skills: ["invoice-processing", "duplicate-detection"],
    isSubAgent: true,
  },
  {
    name: "Variance Analysis Agent",
    status: "draft",
    model: "Claude Sonnet 4.6",
    description: "Budget vs actuals, commentary generation, board deck support",
    runsToday: 0,
    avgLatency: "—",
    lastRun: "—",
    skills: ["variance-review", "board-deck-generation"],
    isSubAgent: true,
  },
];
```

Each card: name, status badge, model tag, description, stats row, skill chips (max 4 + "+N more"), Configure/Test Runs/View Logs buttons.

"+ New Agent" button (disabled with tooltip).

### 7.2 Skills Manager (`/skills-manager`)

**Grid of skill cards (3-col):**

Reads actual skill names from `agent/skills/` where they exist, supplements with sample data for CFO-domain skills not yet created.

Each card: category icon, ACTIVE/AVAILABLE badge, kebab-case name, description, last used time, model tag.

Click opens modal with rendered SKILL.md content (actual file content for existing skills, sample markdown for others).

"+ Create Skill" button (disabled).

### 7.3 Knowledge Base (`/knowledge-base`)

**Two tabs: Sources | Wiki**

Sources tab: list of files from `agent/knowledge/` (actual) + sample entries. Upload area styled but limited to existing upload flow.

Wiki tab:
- Static D3 force-directed graph (~15 nodes)
- Sample nodes: entities (teal) — "GL Account Structure", "Vendor Registry", "Entity List", "Bank Accounts"; concepts (blue) — "Close Process", "Reconciliation Methodology", "Variance Thresholds", "IFRS 9 Staging", "Basel III Rules", "LCR Calculation"; synthesis (purple) — "Q1 Variance Summary", "AR Aging Analysis", "Capital Adequacy Review"
- Edges: ~42 connections
- Stats badge: "15 pages / 42 links"
- Node click opens side panel with sample wiki page (markdown rendered)
- Chat input "Ask the wiki agent..." (toast on send)
- Install `d3` for the graph

### 7.4 Integrations (`/integrations`)

Two sections with sample cards.

**Composio Integrations:** Gmail (Connected), Google Calendar (Connected), SAP, Oracle, QuickBooks, Xero, NetSuite, BlackLine, Slack (Connected). Each with placeholder icon (colored circle + initial letter), name, category, connection status, action chips.

**Direct API:** Google Sheets (API Key), Custom Webhook (OAuth2).

### 7.5 Skill Flows (`/skill-flows`)

**Header stats:** "3 Flows | 22 Total Steps | 4 Approval Gates | 3 Active"

**3 flow cards:**

1. Monthly Reconciliation Suite — 7 skill steps + 1 gate (Sub-ledger → Bank → AR → AP → IC → Exception → [Controller Review gate] → Adjustment). Progress 6/8.
2. Financial Close Pipeline — 5 steps + 2 gates (Pre-close validation → Journal posting → [Controller gate] → Consolidation → [CFO gate] → Reporting). Progress 3/7.
3. Regulatory Filing Workflow — 4 steps + 1 gate (Data extraction → Validation → [Compliance gate] → Filing → Confirmation). Progress 4/5.

Each card: name, description, step+gate counts, progress dot visualization, last run time, Run/Edit/History buttons.

---

## Part 8: Observe Pages (Sample Data Shells)

### 8.1 Decision Inbox (`/decision-inbox`)

**Metric cards:** 7 Pending (3 Critical), 1 Approved This Week, 0 Rejected, 1 Flagged by Compliance.

**Filter tabs:** All | Pending (7) | Approved | Rejected

**Sample decisions:**
```ts
const SAMPLE_DECISIONS: DecisionItem[] = [
  {
    id: "DI-001",
    title: "Post adjusting journal entry — ¥52.3M IC elimination",
    description: "Agent recommends posting intercompany elimination between Tokyo HQ and London Branch.",
    journey: "Monthly Close",
    journeyStep: "Step 4 (Consolidation)",
    priority: "critical",
    status: "pending",
    agent: "Monthly Close Orchestrator",
    requestedAt: "2 hours ago",
    amount: "¥52,300,000",
    entity: "Tokyo HQ ↔ London Branch",
    what: "Post adjusting journal entry for intercompany elimination...",
    evidence: [
      "Source: IC Reconciliation output — matched position confirmed",
      "Matching IC balance confirmed: ¥52,300,000 both sides",
      "Exchange rate: GBP/JPY 191.24 (BOJ fixing 2026-03-31)",
      "Previous month: similar elimination of ¥48.7M",
    ],
    skillUsed: "close-orchestration",
    triggeredBy: "Automated close pipeline — Step 4",
    complianceChecks: [
      { name: "Threshold & Authorization", verdict: "pass", detail: "Amount ¥52.3M is within Controller auto-approve threshold of ¥100M" },
      { name: "Audit Trail Completeness", verdict: "pass", detail: "Source reconciliation attached, matching positions verified" },
      { name: "Regulatory Compliance", verdict: "pass", detail: "IC elimination follows IFRS 10 consolidation requirements" },
    ],
  },
  // ... 6 more decisions (accrual journal, FX hedge, vendor renewal, T&E exception, etc.)
];
```

**Detail view (click a decision):**
- Back link, priority badge, journey + step, timestamp
- "THE DECISION" card with full description
- Amount, Entity, Triggered By metadata row
- Supporting evidence bullets
- **SVG Decision Tracing Diagram:** Three-column bezier-curve layout. Agent Decision (left, primary color) → 3 Compliance Check nodes (middle, colored by verdict) → Output (right, "Ready" or "Blocked"). Cubic bezier paths connecting them.
- Compliance check cards below (expandable with shield icon + verdict badge)
- Approve / Reject / Request Info buttons (toast on click)

### 8.2 Agent Runs (`/agent-runs`)

**Stats row:** 5 Runs Today, 83.5K Tokens, $0.25 Cost, 3 Safety Flags, 71% Success Rate.

**Table (7 sample runs):**

| Run ID | Journey | Status | Confidence | Duration | Tokens | Cost | Safety |
|---|---|---|---|---|---|---|---|
| a7f | Financial Recon | Done | 0.94 | 47s | 12,450/3,200 | $0.048 | Clean |
| b2c | Monthly Close | Live | 0.91 | — | 8,421/2,188 | $0.031 | Flag |
| c4d | Accounts Payable | Done | 0.96 | 8.1s | 6,234/1,847 | $0.024 | Clean |
| d5e | Daily Liquidity | Done | 0.92 | 11.8s | 10,156/2,847 | $0.039 | Clean |
| e6f | Regulatory Capital | Fail | 0.88 | 3.2s | 1,847/0 | $0.006 | Flag |
| f7g | IFRS 9 ECL | Done | 0.91 | 18.4s | 15,632/4,284 | $0.060 | Flag |
| g8h | Variance Analysis | Done | 0.93 | 15.2s | 11,284/3,102 | $0.043 | Clean |

**Filter tabs:** All | Completed | Running | Failed

**Execution trace (slide-over on eye icon click):**
- Metadata grid (agent, journey, trigger, model, tokens, cost, confidence)
- Input/Output code blocks
- 5 safety metric cards (PII Redaction, Data Boundary, Threshold Check, Hallucination Guard, Authorization)
- Step-by-step trace (chronological, typed icons, expandable)

### 8.3 Compliance & Guardrails (`/compliance`)

**Three tabs:**

Active Guardrails:
- "MUST ALWAYS" card: parsed from actual `agent/RULES.md` if exists, otherwise sample rules (Source every financial figure, Flag variance >5%, Apply materiality thresholds)
- "MUST NEVER" card: Fabricate/estimate numbers without labeling, Provide tax/legal advice, Override compliance holds
- "ESCALATION" card: >$1M requires human approval, Regulatory filings require CFO sign-off, Board materials require dual review
- Safety check statistics: aggregate pass rates

Regulatory Frameworks:
- SOX: Active, Last validated 2026-03-15
- SEC: Active, Last validated 2026-03-01
- GAAP/IFRS: Active, Last validated 2026-03-15

Validation Schedule:
- Quarterly: Internal controls testing — Next: 2026-06-30
- Monthly: Regulatory capital validation — Next: 2026-04-30
- Weekly: Threshold calibration review — Next: 2026-04-14

### 8.4 Audit Trail (`/audit-trail`)

**"Export Log" button** in header (toast "Export feature coming soon").

**Vertical timeline** with 2px left line, colored circular icons:

Sample events:
```ts
const SAMPLE_AUDIT_EVENTS: AuditEvent[] = [
  { id: "AE-1247", type: "agent_action", actor: "CFO Office Agent", journey: "Financial Reconciliation",
    action: "Started reconciliation analysis", details: "Loaded 6 data files — 4,328 transactions ingested", timestamp: "Today 08:42:15" },
  { id: "AE-1246", type: "agent_action", actor: "CFO Office Agent", journey: "Financial Reconciliation",
    action: "Auto-matched 4,105 transactions", details: "94.85% match rate — 223 exceptions surfaced", timestamp: "Today 08:42:18" },
  { id: "AE-1245", type: "guardrail_trigger", actor: "System", journey: "Financial Reconciliation",
    action: "Flagged 8 genuine errors", details: "¥47.2M exposure — routed to Decision Inbox", timestamp: "Today 08:42:22" },
  { id: "AE-1239", type: "user_decision", actor: "vidur@lyzr.ai", journey: "Monthly Close",
    action: "Approved FX hedge rollover", details: "GBP/JPY forward — GBP 45M — via Decision Inbox", timestamp: "Yesterday 18:15" },
  { id: "AE-1238", type: "system_event", actor: "System", journey: "Agent Configuration",
    action: "RULES.md updated", details: "Added threshold: regulatory filings require CFO sign-off", timestamp: "Yesterday 14:30" },
];
```

Event type icons: Bot (brown) for agent_action, User (blue) for user_decision, FileText (gray) for system_event, AlertTriangle (amber) for guardrail_trigger.

Filter dropdowns: event type, journey, actor, time range.

---

## Part 9: Shared Components

### New Components to Create

```
components/
├── shell/
│   ├── sidebar.tsx              # Three-section nav with status bar
│   ├── nav-item.tsx             # Single nav item with active state
│   └── agent-status-bar.tsx     # Bottom status bar
│
├── command-center/
│   ├── search-bar.tsx           # Glass input → Agent Console redirect
│   ├── journey-card.tsx         # Icon + title + desc + chevron + tooltip
│   ├── agent-insights.tsx       # Severity-coded insight list
│   ├── insight-card.tsx         # Single insight
│   ├── actions-required.tsx     # Pending actions preview
│   └── section-header.tsx       # Icon + uppercase label + count
│
├── agent-console/
│   ├── agent-header.tsx         # Name + status
│   ├── agent-context-panel.tsx  # Right sidebar (skills, files, guards)
│   ├── chat-message-list.tsx    # Scrollable message history
│   ├── user-message.tsx         # Right-aligned bubble
│   ├── assistant-message.tsx    # Left-aligned with pipeline + response
│   ├── chat-input.tsx           # Input with send/stop toggle
│   └── streaming-text.tsx       # Renders deltas as they arrive
│
├── pipeline/
│   ├── pipeline-container.tsx   # Wraps all steps, collapse/expand
│   ├── pipeline-step.tsx        # Single step row
│   ├── pipeline-step-expanded.tsx # Expanded content view
│   ├── pipeline-collapsed-bar.tsx # "N STEPS COMPLETED" summary
│   ├── step-status-indicator.tsx  # Spinner/check/X
│   └── step-icon.tsx            # Maps step type → Lucide icon + color
│
├── journey/
│   ├── journey-page.tsx         # Shared template (header + content + chat)
│   ├── journey-chat-panel.tsx   # Bottom-docked expandable chat
│   └── nudge-chips.tsx          # Tappable pre-built questions
│
├── shared/
│   ├── metric-card.tsx          # Reusable stat card (number + label)
│   ├── status-badge.tsx         # Active/Available/Draft/Error/Running
│   ├── priority-badge.tsx       # Critical/High/Medium/Low
│   ├── verdict-badge.tsx        # Pass/Flagged/Warning
│   ├── sample-data-badge.tsx    # "SAMPLE DATA" indicator
│   ├── no-data-state.tsx        # Empty state
│   └── section-divider.tsx      # Horizontal rule with label
│
├── build/                       # Build page shells
│   ├── agent-card.tsx
│   ├── skill-card.tsx
│   ├── skill-detail-modal.tsx
│   ├── integration-card.tsx
│   ├── flow-card.tsx
│   ├── flow-step-viz.tsx        # Progress dot visualization
│   └── wiki-graph.tsx           # D3 force-directed graph
│
├── observe/                     # Observe page shells
│   ├── decision-card.tsx
│   ├── decision-tracing-svg.tsx # Bezier compliance diagram
│   ├── compliance-check-card.tsx
│   ├── run-table.tsx
│   ├── execution-trace-panel.tsx
│   ├── trace-step-card.tsx
│   ├── safety-metric-card.tsx
│   ├── audit-event-card.tsx
│   └── audit-timeline.tsx
│
├── data-sources/                # Keep existing (re-styled)
├── documents/                   # Keep existing (re-styled)
├── feed/                        # Deprecated — replaced by command-center/actions-required
├── chat/                        # Deprecated — replaced by agent-console/
├── briefing/                    # Deprecated — replaced by journey chat
└── dashboard/                   # Deprecated — budget-chart moves to journey page
```

### Hooks

```
hooks/
├── use-chat-stream.ts           # SSE streaming with pipeline + abort
├── use-sample-data.ts           # Toggle sample/empty for shell pages
└── use-journey-chat.ts          # Wrapper around useChatStream with journeyId
```

### New API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/agent/context` | GET | Skills, data files, guardrails for context panel |
| `/api/dashboard/insights` | GET | Sample insights for Command Center |

All other endpoints are existing and unchanged.

---

## Part 10: New Dependencies

```
framer-motion    — animations (pipeline steps, slide-overs, card hover)
d3               — force-directed wiki graph in Knowledge Base
```

Already installed: `react-markdown`, `recharts`, `lucide-react`, `clsx`.

**Fonts:** Added via Google Fonts `<link>` in `layout.tsx` or `next/font/google`.

---

## Part 11: Migration Strategy

1. Create `(shell)` layout group alongside existing `(dashboard)` — both work simultaneously
2. Build new components and pages inside `(shell)`
3. Rewrite `globals.css` with new design system (this affects everything — do it when `(shell)` pages are ready)
4. Move data-sources, documents, settings pages into `(shell)` with re-styling
5. Delete `(dashboard)` layout group and all deprecated components
6. Update `/login` redirect to point to new `/` (Command Center)

---

## Part 12: What Stays Unchanged

- **Prisma schema** — all models (User, DataSource, FinancialRecord, Action, ChatMessage, ActionEvent, Invoice, Document)
- **Agent integration** — `lib/agent/index.ts`, `lib/agent/tools.ts`, `lib/agent/allowed-tools.ts`
- **Agent repo** — `agent/` directory (SOUL.md, RULES.md, DUTIES.md, agent.yaml, skills/, knowledge/, examples/)
- **API routes** — all existing routes under `app/api/` (except `/api/chat` which gets SSE format rewrite)
- **CSV parsing** — `lib/csv/` (variance-parser, ar-parser, llm-mapper)
- **Auth** — `lib/auth.ts`, login page
- **Database** — SQLite, existing seed data

---

## Verification Checklist

### Tier 1 (Live — must work end-to-end)

- [ ] Design system: warm cream/brown palette renders correctly. Playfair headings, DM Sans body, glassmorphism sidebar.
- [ ] Sidebar: three sections (Journeys, Build, Observe) with correct icons. Active item highlighting. Status bar at bottom.
- [ ] Command Center: search bar sends message to Agent Console. Journey cards navigate to journey pages. Actions Required shows real pending actions from Prisma.
- [ ] Agent Console: messages stream via SSE. Pipeline steps appear incrementally with correct icons and labels. Steps collapse on completion. Abort works (Stop button → stream stops). Auto-send from Command Center query param works.
- [ ] Agent Context Panel: shows actual skills from agent/skills/, actual files from agent/knowledge/, rules from RULES.md.
- [ ] Journey pages: all 6 render with correct sample data. Chat panel expands/collapses. Nudges pre-fill input. Chat is scoped to journey context.
- [ ] Existing features: data upload (variance + AR), Google Sheets link, re-analyze, documents generation — all still work under new shell layout.

### Tier 2 (Sample data — must render correctly)

- [ ] Agent Studio: 3 agent cards with correct fields and styling.
- [ ] Skills Manager: skill cards with actual + sample skills. Modal shows SKILL.md content.
- [ ] Knowledge Base: Sources tab lists files. Wiki tab shows D3 graph with draggable nodes.
- [ ] Integrations: Composio + Direct API sections with sample cards.
- [ ] Skill Flows: 3 flow cards with step visualization.
- [ ] Decision Inbox: list view with metric cards + colored borders. Detail view with SVG tracing diagram.
- [ ] Agent Runs: table with 7 sample runs. Slide-over trace panel with safety metrics.
- [ ] Compliance: 3 tabs with guardrails, frameworks, validation schedule.
- [ ] Audit Trail: vertical timeline with typed events.
- [ ] All shell pages: "SAMPLE DATA" badge visible. Toggle works (sample → empty state).

### Cross-cutting

- [ ] No emoji in UI chrome — Lucide icons only.
- [ ] No regressions in auth flow (login → redirect to Command Center).
- [ ] Mobile: sidebar collapses (hamburger menu) on small screens.
- [ ] Performance: D3 graph doesn't block page load (lazy import).
