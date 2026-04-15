# BUILD_JOURNEYS.md

# This file defines the standard Build section that exists in every Lyzr
# AgenticOS product. Give it to Replit / Claude Code alongside
# GITCLAW_FOUNDATION.md when building any vertical OS product.

# The Build section is where admins/power users create, configure, and
# extend the AgenticOS — adding skills, agents, knowledge, integrations,
# and deterministic skill flows.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 1: THE SIDEBAR — STANDARD STRUCTURE FOR EVERY AGENTICOS
# ═══════════════════════════════════════════════════════════════════════════════

## 1.1 The three sidebar sections

Every AgenticOS sidebar has three sections, in this order:

```
┌─────────────────────────┐
│  [Logo] Product Name    │
│  AgenticOS              │
│                         │
│  ── DOMAIN JOURNEYS ──  │  ← The vertical-specific pages
│  ▸ Journey A            │    (Financial Reconciliation,
│  ▸ Journey B            │     Leave Management, etc.)
│  ▸ Journey C            │    Each is a sidebar item with its
│  ▸ Journey D            │    own chat + context.
│                         │
│  ── BUILD ──            │  ← Where you construct the OS
│  ▸ Agent Studio         │    Standard across ALL verticals
│  ▸ Skills Manager       │    Same pages, same UX
│  ▸ Knowledge Base       │
│  ▸ Integrations         │
│  ▸ Skill Flows          │
│                         │
│  ── OBSERVE ──          │  ← Where you monitor the OS
│  ▸ Decision Inbox       │    Standard across ALL verticals
│  ▸ Agent Runs           │    Same pages, same UX
│  ▸ Compliance & Guards  │
│  ▸ Audit Trail          │
│                         │
│  ─────────────────────  │
│  Agent Active           │
│  ⚡ Claude Sonnet 4.6   │
│  Powered by Lyzr        │
└─────────────────────────┘
```

**What changes per vertical:** The DOMAIN JOURNEYS section. HR OS has Leave
Management, Payroll Processing, etc. CFO OS has Financial Reconciliation,
Monthly Close, etc. The journeys are defined in config.ts per vertical.

**What is ALWAYS the same:** BUILD and OBSERVE sections. Every AgenticOS has
the same five Build pages and the same four Observe pages, with identical
functionality. The content inside them (which skills, which agents, which
integrations) is vertical-specific, but the page structure and UX is standard.


## 1.2 The status bar at bottom

Every AgenticOS sidebar shows an agent status bar at the bottom:

```
┌─────────────────────────┐
│  ⚡ Agent Active         │
│  Claude Sonnet 4.6      │
│  Powered by Lyzr AgOS   │
└─────────────────────────┘
```

- Shows which model is currently active
- Shows agent status (Active / Idle / Error)
- "Powered by Lyzr AgenticOS" branding


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2: SKILL vs. SUB-AGENT — THE DECISION FRAMEWORK
# ═══════════════════════════════════════════════════════════════════════════════

Before defining the Build pages, you need to understand when something is a
skill vs. a sub-agent. This decision determines whether it shows up in
Skills Manager or Agent Studio.

## 2.1 What is a skill?

A skill is a SKILL.md file in `agent/skills/<name>/SKILL.md`. It is a set of
instructions that the EXISTING agent reads and follows. The agent does not
change identity. It gains expertise.

Think: giving a person a runbook. They're still the same person with the
same name, same role, same permissions. They just know how to do a new thing.

In GitClaw: the agent's `loadAgent()` scans skills/, lists their names and
descriptions in the system prompt, and the LLM discovers and reads them
at runtime via the `read` built-in tool.

**Examples (HR OS):** talent-acquisition, performance-management,
compensation-benchmarking, employee-engagement, workforce-planning,
compliance-monitoring, learning-development, diversity-equity-inclusion,
employee-onboarding, payroll-processing, succession-planning, hr-analytics,
employee-relations, bias-detection-fairness, bias-detection-regulatory,
candidate-scoring, attrition-risk-model, background-verification,
benefits-administration.

**Examples (CFO OS):** financial-reconciliation, monthly-financial-close,
regulatory-capital-computation, variance-analysis, board-deck-generation,
expense-anomaly-detection, vendor-risk-scoring, internal-controls-testing.

## 2.2 What is a sub-agent?

A sub-agent is a separate agent definition inside `agent/agents/<name>/`.
It has its own `agent.yaml`, its own `SOUL.md`, its own `RULES.md`, and
potentially its own skills. It is a different identity.

Think: calling a specialist. A different person with different expertise,
different constraints, different permissions.

In GitAgent: the parent agent's `agent.yaml` declares sub-agents in the
`agents:` section with delegation config (auto/manual, triggers).

**Use a sub-agent when you need ONE OR MORE of:**

1. **Different identity (SOUL):** The sub-agent presents itself differently.
   "I am the AP Automation Agent" vs. "I am the CFO Office Agent."

2. **Different rules (RULES):** The sub-agent has stricter or different
   guardrails. An agent handling PII has different RULES than one handling
   public data.

3. **Different model:** Route routine/fast tasks to a cheaper model (Haiku)
   while complex analysis uses a more capable model (Sonnet/Opus).

4. **Operational isolation:** Separate run tracking, separate error
   containment, separate latency monitoring. If one sub-agent is slow or
   errors, the others continue working.

5. **Independent lifecycle:** The sub-agent runs on its own schedule, has
   its own run count, its own test suite. It's operationally independent.

**Examples (CFO OS):** CFO Office Agent (primary), AP Automation Agent
(invoice processing, duplicate detection, PO matching), Variance Analysis
Agent (budget vs actuals, commentary generation), Compliance Monitor
(regulatory thresholds, guardrail enforcement, audit trail generation).

## 2.3 The practical test

If you would give it its own card in **Agent Studio** with its own
"Configure / Test Runs / View Logs" — it's a **sub-agent**.

If it's a card in **Skills Manager** — it's a **skill**.

If you're unsure: start as a skill. Promote to sub-agent when you
observe one of the five triggers above.

## 2.4 How they appear in the sidebar

Skills don't appear as sidebar items. They are discovered automatically
by the agent.

Sub-agents don't appear as sidebar items either. They are managed in
Agent Studio.

Domain journeys appear as sidebar items. Each journey has a chat interface
and context function. The journey might invoke skills from the primary
agent OR delegate to a sub-agent — but the user doesn't see this distinction.
They just see the journey page.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 3: THE FIVE BUILD PAGES
# ═══════════════════════════════════════════════════════════════════════════════

## 3.1 Agent Studio

**What it is:** The control center for all agents in the OS. Shows every
agent (primary + sub-agents) as a card.

**URL:** /agent-studio

**Architecture mapping:** Each card maps to an agent definition. The primary
agent is `agent/` itself. Sub-agents are in `agent/agents/<name>/`.

### Card content:
```
┌──────────────────────────────────────────────┐
│  🤖 CFO Office Agent            ⊞ (split)   │
│  ● Active    ⚡ Claude Sonnet 4.6            │
│                                              │
│  Primary agent for all financial journeys    │
│  — reconciliation, close, capital, ECL,      │
│  liquidity, returns                          │
│                                              │
│  ⚡ 47 runs today  ⏱ 12.4s avg  ▷ 3 min ago │
│                                              │
│  monthly-financial-close  financial-recon    │
│  regulatory-capital-computation  +3 more     │
│                                              │
│  ⚙️ Configure   ▷ Test Runs   📋 View Logs   │
└──────────────────────────────────────────────┘
```

### Card fields:
- **Name** — from agent.yaml `name`
- **Status** — Active / Draft / Error
- **Model** — from agent.yaml `model.preferred`
- **Description** — from agent.yaml `description`
- **Runs today** — count of query() calls routed to this agent today
- **Avg latency** — average response time
- **Last run** — time since last execution
- **Skill tags** — skills listed in agent.yaml `skills:` or discovered in skills/
- **Actions:**
  - Configure — opens agent config editor (SOUL.md, RULES.md, agent.yaml)
  - Test Runs — opens a test chat that routes to this specific agent
  - View Logs — shows recent runs with tool traces

### "+ New Agent" button:
Opens a form with: Agent Name, Description, Model selection, initial SOUL.md
template. Creates `agent/agents/<name>/` with agent.yaml, SOUL.md, RULES.md.

### How it maps to GitAgent:
```
agent/
├── agent.yaml              ← Primary agent card
├── SOUL.md
├── agents/
│   ├── ap-automation/      ← Sub-agent card
│   │   ├── agent.yaml
│   │   ├── SOUL.md
│   │   └── RULES.md
│   └── variance-analysis/  ← Sub-agent card
│       ├── agent.yaml
│       ├── SOUL.md
│       └── RULES.md
```

### Backend:
- GET /api/agents — list all agents (primary + sub-agents) with metadata
- GET /api/agents/:name — get agent config
- PUT /api/agents/:name — update agent config (writes to yaml/md files + git commit)
- POST /api/agents — create new sub-agent
- POST /api/agents/:name/test — run a test prompt against specific agent
- GET /api/agents/:name/runs — get recent run logs for this agent


## 3.2 Skills Manager

**What it is:** Library of all skills available to the OS. Shows every skill
as a card with its status, description, and model indicator.

**URL:** /skills-manager (or /agent-skills)

**Architecture mapping:** Each card maps to a `skills/<name>/SKILL.md` file
in the agent repo.

### Card content:
```
┌──────────────────────────────────────────────┐
│  🔧            ● ACTIVE (or AVAILABLE)       │
│  attrition-risk-model                        │
│                                              │
│  Multi-dimensional attrition risk            │
│  ranking, root cause analysis, flight        │
│  risk scoring, tenure/performance/           │
│  department metrics. Integrates at           │
│  $85K/replacement cost impact.               │
│                                              │
│  ⏱ 0 mins ago        ⚡ Claude Sonnet 4.6   │
└──────────────────────────────────────────────┘
```

### Card fields:
- **Icon** — category-based icon (🔧 default, 👁 for detection, ♡ for people, $ for finance)
- **Status badge** — ACTIVE (skill is enabled in agent.yaml) or AVAILABLE (exists but not enabled)
- **Name** — from SKILL.md frontmatter `name` (kebab-case)
- **Description** — from SKILL.md frontmatter `description`
- **Last used** — time since the agent last read this SKILL.md
- **Model** — which model typically runs this skill

### "+ Create Skill" button:
Opens a modal with three fields:
- **Skill Name** — kebab-case (e.g., exit-interview-analysis)
- **Description** — what this skill does (one line)
- **Methodology (optional)** — longer description of the methodology, data
  sources, and output format

On submit: creates `agent/skills/<name>/SKILL.md` with proper frontmatter
and body from the provided fields. Git commits.

### Skill detail view (when you click a card):
Shows the full SKILL.md content in a rendered markdown view with:
- Edit button (opens markdown editor)
- Version history (git log of this file)
- Test button (sends a test prompt that should trigger this skill)
- References section (shows files in skills/<name>/references/)

### How it maps to GitClaw:
- Skills listed in agent.yaml `skills:` array = ACTIVE status
- Skills that exist in skills/ but not in agent.yaml = AVAILABLE status
- Activating a skill = adding its name to agent.yaml `skills:` array
- The agent discovers skills automatically — Skills Manager is just the
  admin view and creation interface

### Backend:
- GET /api/skills — list all skills with frontmatter metadata
- GET /api/skills/:name — get full SKILL.md content
- POST /api/skills — create new skill (writes SKILL.md + git commit)
- PUT /api/skills/:name — update skill content (writes SKILL.md + git commit)
- DELETE /api/skills/:name — remove skill directory
- POST /api/skills/:name/toggle — activate/deactivate skill in agent.yaml


## 3.3 Knowledge Base

**What it is:** Interface for managing the raw source documents and the
LLM Wiki. Two tabs: Sources (raw documents) and Wiki (compiled knowledge).

**URL:** /knowledge-base

**Architecture mapping:** Sources tab maps to `agent/knowledge/docs/`.
Wiki tab maps to `agent/memory/wiki/`.

### Sources tab:
- List of all documents in knowledge/docs/
- Upload interface (drag-and-drop or file picker)
- For each document: name, type, size, date added, which wiki pages reference it
- Upload triggers auto-ingest into the wiki (via query() → wiki-ingest skill)
- Documents are immutable — can be replaced but not edited in place
- Add to knowledge/index.yaml with metadata (description, tags, always_load)

### Wiki tab:
- D3.js force-directed graph showing all wiki pages as nodes, [[links]] as edges
- Nodes colored by type: entity (teal), concept (blue), synthesis (purple)
- Click a node → loads page content in a side panel
- Conversational search: ask questions, agent streams answers with [[wiki-link]]
  citations that highlight matching nodes in the graph
- Wiki stats: total pages, entities, concepts, syntheses, last updated
- Manual ingest button: trigger wiki-ingest on a specific document
- Lint button: trigger wiki-lint health check

### Backend:
- See LLM_WIKI_IMPLEMENTATION.md for full API specification
- GET /api/knowledge/sources — list all source documents
- POST /api/knowledge/sources — upload new document + trigger ingest
- GET /api/wiki/pages, /api/wiki/graph, etc.


## 3.4 Integrations

**What it is:** Manage connections to external systems via Composio and
direct API integrations.

**URL:** /integrations

**Architecture mapping:** Maps to Composio adapter in GitClaw
(src/composio/adapter.ts) and environment variables for direct APIs.

### Layout:
Two sections:

**COMPOSIO INTEGRATIONS** (OAuth2 via Composio):
- Status badges: "Composio Active" + "SOC2 Compliant"
- Each integration is a card showing:
  - App logo + name + category (COMMUNICATION, HRIS & CORE HR, etc.)
  - Description of what it connects
  - Connection status: "Connected" (green) or "Connect via Composio" (button)
  - If connected: "Sync Now", "Configure", "Disconnect" actions
  - Available actions listed as chips (e.g., "Send Email", "Search Emails",
    "List Calendar Events", "Get Worker", etc.)

**DIRECT API INTEGRATIONS** (API Key / OAuth2):
- For systems not covered by Composio
- Each shows: app logo, name, category, auth type badge (API Key, OAuth2)
- Description + "Connect" button

### Standard integrations by vertical:

**HR OS:** Gmail, Google Calendar, Workday HCM, ServiceNow, Greenhouse (ATS),
Docebo (LMS), BambooHR, ADP, Slack

**CFO OS:** Gmail, Google Calendar, SAP, Oracle, QuickBooks, Xero, NetSuite,
BlackLine, Slack

**The integration set changes per vertical, but the page structure is always
the same.**

### How it maps to GitClaw:
- Composio integrations use the ComposioAdapter from GitClaw
- `COMPOSIO_API_KEY` env var required
- Connected integrations expose tools to the agent via `getToolsForQuery()`
- The agent discovers Composio tools automatically — naming: composio_{toolkit}_{slug}
- Direct API integrations are custom tools defined in config.ts

### Backend:
- GET /api/integrations — list all integrations with connection status
- GET /api/integrations/composio/toolkits — available Composio toolkits
- POST /api/integrations/composio/connect — initiate OAuth flow
- POST /api/integrations/composio/disconnect — disconnect an integration
- POST /api/integrations/composio/sync — force sync with Composio


## 3.5 Skill Flows

**What it is:** Deterministic multi-step pipelines that chain skills with
approval gates. Unlike the agentic loop (where the LLM decides what to do
next), Skill Flows enforce a fixed sequence.

**URL:** /skill-flows

**Architecture mapping:** Maps to `agent/workflows/*.yaml` (GitClaw SkillFlows).

### Page layout:

**Header stats:**
```
3 Flows  |  22 Total Steps  |  4 Approval Gates  |  3 Active
```

**Flow cards (collapsed view):**
```
┌──────────────────────────────────────────────────────────────┐
│  🔧 Monthly Reconciliation Suite          ● Active           │
│  End-to-end reconciliation across all 7 types,              │
│  exception classification, and adjustment proposals          │
│                                                              │
│  🔧 7 skills  🔒 1 gate  ━━━━━━━━ 6/8  ⏱ Today 08:42       │
│                                                              │
│  ○──○──○──○──○──○──🔒──○                                     │
│  Sub  Bank  AR  AP  IC  Exc  Review  Adj                    │
│                                                              │
│  ▷ Run Flow   ⚙️ Edit Flow   ⏱ Run History                  │
└──────────────────────────────────────────────────────────────┘
```

**Flow cards (expanded/editing view):**
```
⚙️ Editing Flow                              Cancel  💾 Save

  ⋮⋮ 🔧 Sub-ledger Verification                           🗑️
       financial-reconciliation
  ⋮⋮ 🔧 Bank Reconciliation                               🗑️
       financial-reconciliation
  ⋮⋮ 🔧 AR Reconciliation                                 🗑️
       financial-reconciliation
  ⋮⋮ 🔧 AP Reconciliation                                 🗑️
       financial-reconciliation
  ⋮⋮ 🔧 IC Position Matching                              🗑️
       financial-reconciliation
  ⋮⋮ 🔧 Exception Classification                          🗑️
       financial-reconciliation
  ⋮⋮ 🔒 Controller Review            ← highlighted yellow  🗑️
  ⋮⋮ 🔧 Adjustment Journal Posting                        🗑️
       financial-reconciliation

  + Add Skill Step    🔒 Add Gate

  ▷ Run Flow   ⚙️ Edit Flow   ⏱ Run History
```

### Key UX details:

**Steps** are draggable (⋮⋮ grip handle). Each step shows:
- Step name (human-readable, not the skill name)
- Associated skill (shown as tag below the name)
- Delete button (🗑️)

**Approval Gates** are visually distinct (highlighted background, lock icon 🔒).
Gates pause the flow and wait for human approval before continuing.

**Progress indicator** shows how far the current run has progressed (6/8).

**"+ Create New Flow" button:**
Opens a new flow builder with:
- Flow name field
- Flow description field
- Empty step list with "+ Add Skill Step" and "🔒 Add Approval Gate" buttons
- Save creates `agent/workflows/<flow-name>.yaml`

### How it maps to GitClaw SkillFlows:

```yaml
# agent/workflows/monthly-reconciliation-suite.yaml
name: monthly-reconciliation-suite
description: End-to-end reconciliation across all 7 types
steps:
  - name: Sub-ledger Verification
    skill: financial-reconciliation
    prompt: "Run sub-ledger verification against GL balances"
  - name: Bank Reconciliation
    skill: financial-reconciliation
    prompt: "Reconcile bank statements against cash GL"
  - name: AR Reconciliation
    skill: financial-reconciliation
    prompt: "Reconcile AR aging against customer statements"
  - name: AP Reconciliation
    skill: financial-reconciliation
    prompt: "Reconcile AP aging against vendor statements"
  - name: IC Position Matching
    skill: financial-reconciliation
    prompt: "Match intercompany positions across entities"
  - name: Exception Classification
    skill: financial-reconciliation
    prompt: "Classify all exceptions from previous steps"
  - name: Controller Review
    type: __approval_gate__
    channel: email
    message: "Reconciliation complete. Review exceptions before journal posting."
  - name: Adjustment Journal Posting
    skill: financial-reconciliation
    prompt: "Generate and post adjustment journal entries for approved exceptions"
enabled: true
```

**The flow YAML is the source of truth.** The frontend is just a visual
editor for this YAML. When the user adds a step, reorders, or removes —
the YAML is updated and git-committed.

### Backend:
- GET /api/flows — list all flows with metadata and step counts
- GET /api/flows/:name — get flow definition (the YAML)
- POST /api/flows — create new flow
- PUT /api/flows/:name — update flow (reorder, add/remove steps)
- POST /api/flows/:name/run — trigger a flow run
- GET /api/flows/:name/runs — get run history
- POST /api/flows/:name/gate/:stepIndex/approve — approve a gate


# ═══════════════════════════════════════════════════════════════════════════════
# PART 4: IMPLEMENTATION RULES FOR THE BUILD SECTION
# ═══════════════════════════════════════════════════════════════════════════════

## 4.1 Build pages are CRUD interfaces over the agent repo

Every Build page is fundamentally a visual editor for files in the GitAgent
repo. They read files, display them in a user-friendly way, and write changes
back to files with git commits.

- Skills Manager → reads/writes `agent/skills/<name>/SKILL.md`
- Agent Studio → reads/writes `agent/agents/<name>/agent.yaml`, SOUL.md, RULES.md
- Knowledge Base → reads/writes `agent/knowledge/` and `agent/memory/wiki/`
- Integrations → reads Composio state + env vars
- Skill Flows → reads/writes `agent/workflows/<name>.yaml`

**Build pages NEVER call query().** They are pure file management.
The only exception is Knowledge Base's wiki features, which trigger
query() for ingest/query/lint operations.

## 4.2 Every file change is a git commit

When a user creates a skill, edits a SOUL.md, adds a workflow step —
the change MUST be committed to git in the agent repo.

```typescript
// Standard pattern for any Build page mutation
async function updateAgentFile(path: string, content: string, message: string) {
  await fs.writeFile(path, content);
  execSync(`cd agent && git add ${path} && git commit -m "${message}"`);
}
```

## 4.3 Build pages share a consistent visual language

- **Cards** for browsable items (skills, agents, flows, integrations)
- **Status badges** — Active (green), Available (neutral), Draft (amber), Error (red)
- **Action buttons** in consistent positions — primary actions left, destructive right
- **Tags/chips** for associated skills, models, categories
- **Stats row** with run count, latency, last run time
- **Warm beige/brown color palette** consistent with Lyzr brand
- **Modals** for create/edit operations (not separate pages)

## 4.4 Build pages are the same across verticals

When building a new AgenticOS for a new vertical (CMO OS, Procurement OS,
Banking OS), you copy the Build section verbatim. You don't redesign Agent
Studio or Skills Manager. You only:
1. Change which skills are pre-loaded
2. Change which integrations are shown
3. Change which flows are pre-configured
4. Change the domain journey pages in the sidebar above BUILD

The BUILD and OBSERVE sections are the platform layer. The DOMAIN JOURNEYS
section is the vertical layer.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 5: CUSTOMIZATION GUIDE — WHAT TO CHANGE PER VERTICAL
# ═══════════════════════════════════════════════════════════════════════════════

When building a new AgenticOS product for a new vertical, here is exactly
what changes and what stays the same:

## 5.1 What you customize:

1. **DOMAIN JOURNEYS** — the sidebar items above BUILD
   - Define in config.ts journeys array
   - Each journey has: id, name, icon, context() function
   - Example HR: leave-management, payroll-processing, engagement-survey
   - Example CFO: financial-reconciliation, monthly-close, regulatory-capital

2. **Skills** — pre-create in agent/skills/
   - Write SKILL.md files for the vertical's domain expertise
   - Example HR: 26 skills (talent-acquisition through employee-relations)
   - Example CFO: 8+ skills (financial-reconciliation through board-deck-generation)

3. **Sub-agents** — pre-create in agent/agents/ if needed
   - Only when the vertical needs operationally independent agents
   - Example CFO: AP Automation Agent, Variance Analysis Agent
   - Example HR: might not need sub-agents initially

4. **Integrations** — which Composio toolkits and direct APIs to show
   - HR: Workday, BambooHR, Greenhouse, ADP
   - CFO: SAP, Oracle, QuickBooks, BlackLine

5. **Skill Flows** — pre-built deterministic pipelines
   - HR: employee-onboarding-pipeline, performance-review-cycle
   - CFO: monthly-reconciliation-suite, financial-close-pipeline

6. **SOUL.md and RULES.md** — vertical-specific identity and constraints
   - HR SOUL: "I am an HR operations expert..."
   - CFO SOUL: "I am a financial operations expert..."

7. **Knowledge documents** — domain reference material
   - HR: leave policies, employee handbook, compliance regulations
   - CFO: GAAP standards, close procedures, regulatory frameworks

## 5.2 What stays identical:

1. BUILD section — all 5 pages (Agent Studio, Skills Manager, Knowledge Base,
   Integrations, Skill Flows). Same layout, same UX, same API routes.

2. OBSERVE section — all 4 pages (Decision Inbox, Agent Runs, Compliance &
   Guardrails, Audit Trail). Same layout, same UX, same API routes.

3. Agent status bar in sidebar.

4. Chat interface pattern — SSE streaming, tool trace rendering, GCMessage
   handling.

5. Server architecture — one query() call, context injection via
   systemPromptSuffix, custom tools pattern.

6. LLM Wiki — same three skills, same file structure, same graph view.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 6: FRONTEND COMPONENT CHECKLIST
# ═══════════════════════════════════════════════════════════════════════════════

When building the frontend, implement these components:

## BUILD components:
- [ ] AgentStudioPage — grid of agent cards, "+ New Agent" modal
- [ ] AgentConfigEditor — edit SOUL.md, RULES.md, agent.yaml for any agent
- [ ] SkillsManagerPage — grid of skill cards, "+ Create Skill" modal
- [ ] SkillDetailView — full SKILL.md viewer/editor with version history
- [ ] KnowledgeBasePage — two-tab layout (Sources + Wiki)
- [ ] SourcesTab — document list with upload, file type icons
- [ ] WikiTab — D3.js graph + conversational search + page viewer
- [ ] IntegrationsPage — Composio cards + Direct API cards
- [ ] SkillFlowsPage — flow cards with step visualizations
- [ ] FlowBuilder — drag-and-drop step editor with gate support
- [ ] FlowRunner — run a flow and show progress through steps

## Shared components:
- [ ] Sidebar — three-section layout with collapsible sections
- [ ] StatusBadge — Active/Available/Draft/Error with color coding
- [ ] SkillTag — chip showing skill name with link to Skills Manager
- [ ] ModelBadge — shows model name with provider icon
- [ ] ChatInterface — SSE streaming with tool trace rendering
- [ ] AgentStatusBar — bottom sidebar component

## Data types (TypeScript):
```typescript
interface Agent {
  name: string;
  description: string;
  model: string;
  status: 'active' | 'draft' | 'error';
  runsToday: number;
  avgLatency: number;
  lastRun: Date;
  skills: string[];
  isSubAgent: boolean;
}

interface Skill {
  name: string;             // kebab-case
  description: string;
  status: 'active' | 'available';
  lastUsed: Date | null;
  model: string;
}

interface SkillFlow {
  name: string;
  description: string;
  steps: FlowStep[];
  enabled: boolean;
  lastRun: Date | null;
  progress: { completed: number; total: number };
}

interface FlowStep {
  name: string;
  type: 'skill' | 'gate';
  skill?: string;           // for type: 'skill'
  prompt?: string;
  channel?: string;         // for type: 'gate'
  status: 'pending' | 'running' | 'completed' | 'waiting-approval';
}

interface Integration {
  name: string;
  category: string;
  type: 'composio' | 'direct';
  connected: boolean;
  authType: 'oauth2' | 'api-key' | 'basic-auth';
  availableActions: string[];
}
```
