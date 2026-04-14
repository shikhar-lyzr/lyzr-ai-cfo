# OBSERVE_JOURNEYS.md

# This file defines the standard Observe section that exists in every Lyzr
# AgenticOS product. Give it to Replit / Claude Code alongside
# GITCLAW_FOUNDATION.md and BUILD_JOURNEYS.md when building any vertical OS.

# The Observe section is the governance and transparency layer. While the
# domain journeys are where the agent DOES work, Observe is where humans
# VERIFY, APPROVE, and AUDIT that work.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 1: WHAT THE OBSERVE SECTION IS
# ═══════════════════════════════════════════════════════════════════════════════

## 1.1 The four questions Observe answers

Every AgenticOS has four Observe pages, each answering one governance question:

| Page | Question | Audience |
|---|---|---|
| Decision Inbox | "What does the agent need my approval for?" | Business owner, controller, manager |
| Agent Runs | "What did the agent actually do, step by step?" | Technical user, risk analyst, engineer |
| Compliance & Guardrails | "What safety checks are in place?" | Compliance officer, auditor |
| Audit Trail | "What happened, when, and who did it?" | CFO, GC, auditor, regulator |

## 1.2 Sidebar placement

These four pages always appear under the OBSERVE header in the sidebar,
after the BUILD section:

```
OBSERVE
  ✉  Decision Inbox
  🔍 Agent Runs
  🛡  Compliance & Guardrails
  📋 Audit Trail
```

Icons: Inbox (or Mail), Search, Shield, ClipboardList — from Lucide React.

## 1.3 What's standard vs. what's vertical-specific

The page STRUCTURE and UX is identical across all verticals. What changes
per vertical:

| What stays the same | What changes |
|---|---|
| Decision Inbox layout (list + detail views) | Decision content, amounts, entities |
| SVG decision tracing diagram | Compliance check names (SOX → HIPAA) |
| Agent Runs table columns | Journey and agent names |
| Execution trace card format | Trace details (file names, tool names) |
| Safety check rendering | Domain-specific check names |
| Audit Trail timeline format | Event descriptions |
| Data models (interfaces) | Thresholds, amounts, policy references |


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2: DECISION INBOX
# ═══════════════════════════════════════════════════════════════════════════════

## 2.1 What it is

The Decision Inbox is the human-in-the-loop review center. When an agent
makes a decision that exceeds a threshold, triggers a compliance rule, or
requires human judgment, it lands here for approval.

This is the most important page in the Observe section. It's the answer to
"Can I trust the agent?" — because the agent doesn't act unilaterally on
high-stakes decisions.

## 2.2 List view (/decision-inbox)

### Layout:

```
┌──────────────────────────────────────────────────────────────┐
│  Decision Inbox  [SAMPLE DATA]                               │
│  Human-in-the-loop review center for agent decisions         │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │    7     │  │    1     │  │    0     │  │    1     │    │
│  │ PENDING  │  │ APPROVED │  │ REJECTED │  │ FLAGGED  │    │
│  │ 3 Critical│ │ THIS WEEK│  │ THIS WEEK│  │BY COMPL. │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
├──────────────────────────────────────────────────────────────┤
│  [All]  [Pending (7)]  [Approved]  [Rejected]               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┃ green  CRITICAL  Monthly Close → Step 4 · Tokyo HQ ↔ London Branch │
│  ┃        Post adjusting journal entry — ¥52.3M IC elimination        │
│  ┃        Agent recommends posting intercompany elimination...         │
│  ┃        🤖 Monthly Close Orchestrator  ¥52,300,000                  │
│  ┃        ✅ 3/3 passed                               2 hours ago  >  │
│  ┃                                                  ⚠️ Requires Action │
│                                                              │
│  ┃ red    CRITICAL  Monthly Close → Step 3 · Multi-entity            │
│  ┃        Approve ¥156M accrual journal entries                       │
│  ┃        Controller approval required for 12 accrual entries...       │
│  ┃        🤖 Monthly Close Orchestrator  ¥156,000,000                 │
│  ┃        ⚠️ Threshold & Authorization  ✅ 2/3 passed  3 hours ago  > │
│  ┃                                                  ⚠️ Requires Action │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Key design details:

**Colored left border on each decision card:**
- Green left bar = all compliance checks passed
- Red left bar = one or more checks flagged
- Amber left bar = warning (not blocking, but attention needed)

**Priority badges:** CRITICAL (red), HIGH (amber), MEDIUM (neutral), LOW (gray)

**Compliance check indicators on the card (mini shields):**
- "✅ 3/3 passed" = all green, no issues
- "⚠️ Threshold & Authorization ✅ 2/3 passed" = specific check flagged, shown by name

**Right side of each card:**
- Time ago (2 hours ago, 3 hours ago)
- Status badge: "⚠️ Requires Action" (pending) or "● Pending" (queued)
- Chevron (>) for navigation to detail view

**Metric cards (top row):**
- Pending count (with "X Critical" sub-label)
- Approved this week
- Rejected this week
- Flagged by compliance

## 2.3 Detail view (/decision-inbox/:id)

### Layout:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Inbox / DI-001                                    │
│  CRITICAL  Monthly Close → Step 4 · 2 hours ago             │
│  Post adjusting journal entry — ¥52.3M IC elimination       │
│  Agent: Monthly Close Orchestrator · Skill: close-orchestration │
│                                   👍 Approve  ❌ Reject  ℹ️ Request Info │
├──────────────────────────────────────────────────────────────┤
│  THE DECISION                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Post adjusting journal entry for intercompany          │  │
│  │ elimination between Tokyo HQ and London Branch.        │  │
│  │ This eliminates the IC lending position (¥52.3M)...    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  AMOUNT              ENTITY                   TRIGGERED BY   │
│  ¥52,300,000         Tokyo HQ ↔ London Branch  Auto pipeline │
│                                                  — Step 4    │
├──────────────────────────────────────────────────────────────┤
│  SUPPORTING EVIDENCE                                         │
│  › Source: IC Reconciliation output — matched position...    │
│  › Matching IC balance confirmed: ¥52,300,000 both sides     │
│  › Exchange rate: GBP/JPY 191.24 (BOJ fixing 2026-03-31)   │
│  › Previous month: similar elimination of ¥48.7M             │
├──────────────────────────────────────────────────────────────┤
│  DECISION TRACING — COMPLIANCE CHECKS                        │
│                                                              │
│  ┌─────────────────┐     ┌────────────────────┐     ┌─────┐│
│  │  Agent Decision  │──╮──│Threshold & Auth    │──╮──│     ││
│  │  Monthly Close   │  │  │       PASS         │  │  │ Out-││
│  │  Orchestr...     │──┤──│Audit Trail Compl.  │──┤──│ put ││
│  │                  │  │  │       PASS         │  │  │     ││
│  │                  │──╯──│Regulatory Compliance│──╯──│Ready││
│  │                  │     │       PASS         │     │     ││
│  └─────────────────┘     └────────────────────┘     └─────┘│
│                                                              │
│  (SVG with bezier curves connecting left → middle → right)   │
│  (Middle nodes colored green for PASS, red for FLAGGED)      │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐              │
│  │ 🛡 Threshold & Authorization         PASS  >│              │
│  │   Amount ¥52.3M is within Controller auto- │              │
│  │   approve threshold of ¥100M               │              │
│  └────────────────────────────────────────────┘              │
│  ┌────────────────────────────────────────────┐              │
│  │ 🛡 Audit Trail Completeness          PASS  >│              │
│  │   Source reconciliation attached, matching  │              │
│  │   positions verified, exchange rate documented│            │
│  └────────────────────────────────────────────┘              │
│  ┌────────────────────────────────────────────┐              │
│  │ 🛡 Regulatory Compliance             PASS  >│              │
│  │   Intercompany elimination follows IFRS 10 │              │
│  │   consolidation requirements, SOX #AC-204  │              │
│  └────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

### Key design details:

**SVG Decision Tracing Diagram:**
- Three-column layout: Agent Decision (left) → Compliance Checks (middle) → Output (right)
- Bezier curves (cubic, not straight lines) connect left to each middle node, then each middle node to right
- Middle nodes are colored by verdict: green fill for PASS, red fill for FLAGGED, amber fill for WARNING
- The Agent Decision box uses the brand primary color (deep brown)
- Output box shows "Ready" or "Blocked" based on whether any checks are flagged

**When a check is FLAGGED:**
- The node turns red in the SVG diagram
- The compliance check card below is expanded by default
- An "EVIDENCE / POLICY REFERENCE" sub-section is visible showing the policy citation
- Approve button changes to "Approve with Override" (amber) and is disabled until justification text is entered
- A red warning banner appears explaining why the check failed

**Action buttons (top-right):**
- "Approve" (green/primary) — when all checks pass
- "Reject" (red outline)
- "Request Info" (neutral outline) — ask the agent for more evidence

**Compliance check cards (below SVG):**
- Shield icon colored by verdict (green/red/amber)
- Check name + short description
- Verdict badge (PASS / FLAGGED / WARNING) on the right
- Expandable via chevron — shows detailed evidence and policy references

## 2.4 Data model

```typescript
interface DecisionItem {
  id: string;                      // "DI-001"
  title: string;                   // Short headline
  description: string;             // One-line explanation
  journey: string;                 // "Monthly Close"
  journeyStep?: string;            // "Step 4 (Consolidation)"
  priority: "critical" | "high" | "medium" | "low";
  status: "pending" | "approved" | "rejected" | "escalated";
  agent: string;                   // "Monthly Close Orchestrator"
  requestedAt: string;             // "2 hours ago"
  amount?: string;                 // "¥52,300,000"
  entity?: string;                 // "Tokyo HQ ↔ London Branch"
  what: string;                    // Full decision description
  evidence: string[];              // Supporting evidence bullets
  skillUsed: string;               // "close-orchestration"
  triggeredBy: string;             // "Automated close pipeline run — Step 4"
  complianceChecks: ComplianceCheck[];
}

interface ComplianceCheck {
  name: string;                    // "Threshold & Authorization"
  verdict: "pass" | "flagged" | "warning";
  detail: string;                  // What happened / why pass or fail
  evidence?: string;               // Policy reference (shown when expanded)
}
```

## 2.5 How Decision Inbox items are created

Currently: hardcoded DECISIONS array with sample data.

To make real: Decision items should be created when:
1. A Skill Flow reaches an `__approval_gate__` step
2. A tool call exceeds a threshold defined in RULES.md
3. A compliance check (run via preToolUse hook) returns "flagged"
4. The agent explicitly requests human review

The creation happens in the server, either via:
- preToolUse hook that detects threshold violations
- SkillFlow executor that hits a gate
- Post-processing after query() completes

## 2.6 Standard compliance checks by vertical

Every vertical should define 3-5 compliance checks that run on every decision:

**CFO OS:**
- Threshold & Authorization — amount vs. auto-approve threshold
- Audit Trail Completeness — supporting documentation attached
- Regulatory Compliance — regulatory framework requirements met

**HR OS:**
- Protected Characteristics Check — no bias in decision
- Statistical Fairness Analysis — four-fifths rule applied
- Regulatory Compliance — employment law compliance

**Legal OS:**
- Conflict of Interest — no conflicting representations
- Jurisdiction Validation — correct governing law applied
- Privilege Check — no privileged communications exposed

**The check names change per vertical. The SVG diagram, card rendering,
and override flow are always the same.**


# ═══════════════════════════════════════════════════════════════════════════════
# PART 3: AGENT RUNS
# ═══════════════════════════════════════════════════════════════════════════════

## 3.1 What it is

Agent Runs provides full execution transparency — every run of every agent,
with micro-level tracing of what happened at each step. This is the answer
to "Show me exactly what the agent did and why."

## 3.2 Runs list view (/agent-runs)

### Layout:

```
┌──────────────────────────────────────────────────────────────┐
│  Agent Runs  [SAMPLE DATA]                                   │
│  Full execution history with micro-level tracing and safety  │
├──────────────────────────────────────────────────────────────┤
│  ┌─────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐               │
│  │  5  │ │83.5K │ │$0.25 │ │  3   │ │ 71% │   [All] [Completed] │
│  │RUNS │ │TOKENS│ │ COST │ │FLAGS │ │SUCC.│   [Running] [Failed] │
│  │TODAY│ │      │ │      │ │      │ │     │               │
│  └─────┘ └──────┘ └──────┘ └──────┘ └─────┘               │
├──────────────────────────────────────────────────────────────┤
│ Run ID │ Journey              │ Status   │ Conf │ Dur  │ Tokens      │ Cost  │ Safety  │   │
│ a7f    │ Financial Recon      │ ✅ Done  │ 0.94 │ 47s  │ 12,450/3,200│ $0.048│ ✅ Clean│ 👁│
│ b2c    │ Monthly Close        │ 🔄 Live  │ 0.91 │ —    │ 8,421/2,188 │ $0.031│ ⚠ Flag │ 👁│
│ c4d    │ Accounts Payable     │ ✅ Done  │ 0.96 │ 8.1s │ 6,234/1,847 │ $0.024│ ✅ Clean│ 👁│
│ d5e    │ Daily Liquidity      │ ✅ Done  │ 0.92 │ 11.8s│ 10,156/2,847│ $0.039│ ✅ Clean│ 👁│
│ e6f    │ Regulatory Capital   │ ❌ Fail  │ 0.88 │ 3.2s │ 1,847/0     │ $0.006│ ⚠ Flag │ 👁│
│ f7g    │ IFRS 9 ECL           │ ✅ Done  │ 0.91 │ 18.4s│ 15,632/4,284│ $0.060│ ⚠ Flag │ 👁│
│ g8h    │ Variance Analysis    │ ✅ Done  │ 0.93 │ 15.2s│ 11,284/3,102│ $0.043│ ✅ Clean│ 👁│
└──────────────────────────────────────────────────────────────┘
```

### Key design details:

**Stats row (5 metric cards):**
- Runs Today — count
- Total Tokens — aggregate across all runs
- Credit Cost — total $ spent
- Safety Flags — count of runs with flagged safety checks
- Success Rate — percentage of completed runs

**Table columns:**
- Run ID — short hash (a7f, b2c, etc.)
- Journey — journey name + agent name as subtitle
- Status — Completed (green), Running (blue spinner), Failed (red), Queued (gray)
- Confidence — 0.88 to 0.96 range, rendered as bold number
- Duration — seconds or "—" if still running
- Tokens — in / out formatted
- Cost — dollar amount
- Safety — "Clean" (green) or "Flagged" (amber/red)
- Eye icon (👁) — click opens execution trace

**Filter tabs:** All / Completed / Running / Failed

## 3.3 Execution trace (right-panel slide-over)

When you click a run row or the eye icon, a right-panel slide-over opens
showing the full execution trace.

### Layout:

```
┌──────────────────────────────────────────────┐
│  Execution Trace                          X  │
│  run_2026-03-31_083815_b2c                   │
├──────────────────────────────────────────────┤
│  Agent     Monthly Close Orchestrator        │
│  Journey   Monthly Close                     │
│  Trigger   Scheduled — Daily 08:30           │
│  Started   Today 08:38:15 SGT                │
│  Duration  —                                 │
│  Model     Claude Sonnet 4                   │
│  Tokens    8,421 / 2,188                     │
│  Cost      $0.031                            │
│  Confidence 0.91                             │
│  Files     3 processed                       │
├──────────────────────────────────────────────┤
│  → RUN INPUT / OUTPUT                        │
│                                              │
│  INPUT                                       │
│  ┌──────────────────────────────────────┐    │
│  │ File: entity-list.csv               │    │
│  │ Size: 12 KB                         │    │
│  │ Entities: Tokyo HQ, London, New York│    │
│  │ Singapore, Hong Kong, Frankfurt...  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  OUTPUT                                      │
│  ┌──────────────────────────────────────┐    │
│  │ { "overall_progress": 0.68,         │    │
│  │   "stages": { "pre_close": {        │    │
│  │     "complete": 10, "total": 10 },  │    │
│  │   "sub_ledger": { "complete": 8,    │    │
│  │     "total": 10 }, ... }            │    │
│  │   "blocking_items": 4,              │    │
│  │   "estimated_completion": "..." }   │    │
│  └──────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│  🛡 SAFETY METRICS                           │
│                                              │
│  ┌ ✅ PII Redaction                    ┐     │
│  │    Employee names redacted from     │     │
│  │    accrual entries.                 │     │
│  └─────────────────────────────────────┘     │
│  ┌ ✅ Data Boundary                    ┐     │
│  │    All processing within VPC.       │     │
│  └─────────────────────────────────────┘     │
│  ┌ ⚠️ Threshold Check                  ┐     │
│  │    2 journal entries exceed ¥50M    │     │
│  │    threshold — routed to Decision   │     │
│  │    Inbox.                           │     │
│  └─────────────────────────────────────┘     │
│  ┌ ✅ Hallucination Guard              ┐     │
│  │    Figures verified against source. │     │
│  └─────────────────────────────────────┘     │
│  ┌ ✅ Authorization                    ┐     │
│  │    Within configured skill boundaries│    │
│  └─────────────────────────────────────┘     │
├──────────────────────────────────────────────┤
│  ⚡ STEP-BY-STEP TRACE — 6 STEPS            │
│                                              │
│  📄 Skill Loaded — monthly-financial-close   │
│     6-step close orchestration               │
│                              08:38:15.100    │
│                                              │
│  🗄 Data Ingestion — Entity List        0.5s │
│     10 entities loaded        08:38:16.000 > │
│                                              │
│  🗄 Data Ingestion — GL Trial Balance   1.1s │
│     37 line items             08:38:16.800 > │
│                                              │
│  🗄 Data Ingestion — Close Calendar     0.3s │
│     ...                       08:38:18.200 > │
│                                              │
│  🧠 LLM Call #1 — Initial Analysis     7.2s │
│     8,200→2,100 tokens        08:38:19.500 > │
│                                              │
│  ⚡ Output Generated                         │
│     close_status_march_2026.json             │
│                              08:38:27.000    │
└──────────────────────────────────────────────┘
```

### Key design details:

**Metadata grid (top):** Two-column key-value grid. Agent, Journey, Trigger,
Started on left. Model, Duration, Tokens, Cost, Confidence, Files on right.

**Run Input/Output section:**
- Collapsible (arrow toggle)
- INPUT: dark background code block showing input file/data
- OUTPUT: green-tinted code block showing JSON result
- These show the first/last substantive data in the run

**Safety Metrics:**
- Each safety check is a card with shield icon
- Green shield + green left accent = PASS
- Red shield + red left accent = FLAGGED (with explanation text)
- Shows 5 standard checks per run

**Step-by-Step Trace:**
- Chronological list of every step the agent took
- Each step shows: icon (by type), label, subtitle, duration, timestamp
- Expandable via chevron (>) — shows full input/output for that step
- Step types and icons:

| Type | Icon | Color | Represents |
|---|---|---|---|
| skill_load | FileText (📄) | Gray | Loaded a SKILL.md |
| data_ingestion | Database (🗄) | Blue | Parsed a CSV/JSON file |
| llm_call | Brain (🧠) | Violet | Called the LLM |
| tool_call | Cpu (⚙️) | Amber | Ran a deterministic tool |
| output | Zap (⚡) | Green | Final output generated |
| confidence | Activity (📊) | Brown | Bayesian confidence update |

## 3.4 Data model

```typescript
interface AgentRun {
  id: string;                      // "run_2026-03-31_084222_a7f"
  journey: string;                 // "Financial Reconciliation"
  agent: string;                   // "Financial Reconciliation Agent"
  status: "completed" | "running" | "failed" | "queued";
  startedAt: string;               // "Today 08:42:22 SGT"
  duration: string;                // "47s"
  tokensIn: number;                // 12450
  tokensOut: number;               // 3200
  creditCost: string;              // "$0.048"
  filesProcessed: number;          // 6
  confidence: number;              // 0.94
  trigger: string;                 // "User — Vidur" or "Scheduled — Daily 08:30"
  model: string;                   // "Claude Sonnet 4"
  input?: string;                  // Raw input data (for expanded view)
  output?: string;                 // Raw output data (for expanded view)
  safetyChecks: SafetyCheck[];
  trace: TraceStep[];
}

interface TraceStep {
  id: string;
  label: string;                   // "LLM Call #1 — Initial Analysis"
  type: "skill_load" | "data_ingestion" | "llm_call" | "tool_call" | "output" | "confidence";
  timestamp: string;               // "08:42:27.000"
  duration?: string;               // "7.2s"
  detail: string;                  // Subtitle text
  input?: string;                  // Full input (shown when expanded)
  output?: string;                 // Full output (shown when expanded)
  tokens?: { in: number; out: number };
  model?: string;
  file?: string;                   // File path for data_ingestion
  rows?: number;                   // Row count for data files
}

interface SafetyCheck {
  name: string;                    // "PII Redaction"
  verdict: "pass" | "warning" | "fail";
  detail: string;                  // Human-readable explanation
}
```

## 3.5 How to make traces real

The GitClaw stream already emits the events needed. In the chat/analysis
route, capture events alongside forwarding them:

```typescript
const traceSteps: TraceStep[] = [];

for await (const msg of stream) {
  // Forward to frontend as before
  sseWrite(res, eventType, data);

  // Also capture for trace
  if (msg.type === "tool_use") {
    traceSteps.push({
      id: crypto.randomUUID(),
      type: classifyToolUse(msg.toolName, msg.args),
      label: formatTraceLabel(msg.toolName, msg.args),
      timestamp: new Date().toISOString(),
      detail: formatTraceDetail(msg.toolName, msg.args),
      input: JSON.stringify(msg.args),
    });
  }
}

// After stream completes, persist the run
await persistAgentRun({ id, journey, agent, trace: traceSteps, ... });
```

Map GitClaw events to trace types:
- tool_use where toolName="read" reading a SKILL.md → skill_load
- tool_use where toolName="read" reading a data file → data_ingestion
- tool_use where toolName="cli" → tool_call
- tool_use where toolName="write" → output
- assistant (with usage stats) → llm_call


# ═══════════════════════════════════════════════════════════════════════════════
# PART 4: COMPLIANCE & GUARDRAILS
# ═══════════════════════════════════════════════════════════════════════════════

## 4.1 What it is

A dashboard showing all safety controls that are active in the OS. Gives
compliance officers visibility into what guardrails exist, their status,
and their enforcement history.

## 4.2 The five layers of compliance

Compliance is NOT a single feature — it's cross-cutting:

| Layer | What | Where it lives | When active |
|---|---|---|---|
| 1. Hard Rules | RULES.md constraints | agent/RULES.md | Every interaction (system prompt) |
| 2. Agent Config | Compliance metadata | agent.yaml compliance: block | Always (metadata) |
| 3. Compliance Skills | Domain-specific methodology | agent/skills/ | On demand when task requires |
| 4. Runtime Checks | Safety metrics per run | preToolUse hooks + postToolUse | During/after each run |
| 5. Decision Inbox | Human approval flow | UI workflow | When thresholds exceeded |

Layers 1-2 are always-on. Layers 3-5 are activated by context.

## 4.3 Page layout

```
┌──────────────────────────────────────────────────────────────┐
│  Compliance & Guardrails                                     │
│  Safety controls and compliance framework                    │
├──────────────────────────────────────────────────────────────┤
│  [Active Guardrails]  [Regulatory Frameworks]  [Validation]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ACTIVE GUARDRAILS tab:                                      │
│  Rules from RULES.md rendered as enforced constraint cards    │
│                                                              │
│  ┌ MUST ALWAYS                                         ┐     │
│  │ Source every financial figure to a specific dataset  │     │
│  │ Flag any variance exceeding 5%                      │     │
│  │ Apply materiality thresholds (>$50K or >5%)         │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌ MUST NEVER                                          ┐     │
│  │ Fabricate or estimate numbers without labeling       │     │
│  │ Provide tax advice or legal opinions                │     │
│  │ Override compliance holds or audit flags             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌ ESCALATION                                          ┐     │
│  │ Any transaction >$1M requires human approval        │     │
│  │ Regulatory filings require CFO sign-off             │     │
│  │ Board materials require dual review (CFO + Controller)│   │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  SAFETY CHECK STATISTICS:                                    │
│  Aggregate stats from Agent Runs safety checks               │
│  PII Redaction: 100% pass (47/47 runs)                      │
│  Data Boundary: 100% pass                                    │
│  Threshold Check: 89% pass (42/47 runs, 5 routed to DI)    │
│  Hallucination Guard: 100% pass                              │
│  Authorization: 100% pass                                    │
│                                                              │
│  REGULATORY FRAMEWORKS tab:                                  │
│  From compliance/regulatory-map.yaml                         │
│  SOX: Active | Last validated: 2026-03-15                   │
│  SEC: Active | Last validated: 2026-03-01                   │
│  GAAP: Active | Last validated: 2026-03-15                  │
│                                                              │
│  VALIDATION SCHEDULE tab:                                    │
│  From compliance/validation-schedule.yaml                    │
│  Quarterly: Internal controls testing — Next: 2026-06-30    │
│  Monthly: Regulatory capital validation — Next: 2026-04-30  │
│  Weekly: Threshold calibration review — Next: 2026-04-14    │
└──────────────────────────────────────────────────────────────┘
```

## 4.4 Backend

- GET /api/agent/compliance — aggregates data from:
  - agent/RULES.md (parsed into must-always, must-never, escalation sections)
  - agent.yaml compliance: block
  - compliance/regulatory-map.yaml
  - compliance/validation-schedule.yaml
- GET /api/agent/compliance/stats — aggregate safety check statistics from Agent Runs


# ═══════════════════════════════════════════════════════════════════════════════
# PART 5: AUDIT TRAIL
# ═══════════════════════════════════════════════════════════════════════════════

## 5.1 What it is

A chronological timeline of everything that happened in the system. Every
agent action, human decision, system event, and guardrail trigger. The
simple, non-technical view for executives and auditors.

## 5.2 Design principle

Audit Trail is a DERIVED VIEW — not a separate data store. It should be
a simplified, flattened timeline built from the same events that power
Agent Runs and Decision Inbox. Every trace step and every Decision Inbox
action automatically becomes an audit event.

## 5.3 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Audit Trail                               [Export Log]      │
│  Complete chronological record of all system activity         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  │ 🤖 Agent · CFO Office Agent · Financial Reconciliation    │
│  │    Started reconciliation analysis                        │
│  │    Loaded 6 data files — 4,328 transactions ingested     │
│  │    Today 08:42:15                                AE-1247 │
│  │                                                          │
│  │ 🤖 Agent · CFO Office Agent · Financial Reconciliation    │
│  │    Auto-matched 4,105 transactions                       │
│  │    94.85% match rate — 223 exceptions surfaced           │
│  │    Today 08:42:18                                AE-1246 │
│  │                                                          │
│  │ ⚠️ Guardrail · System · Financial Reconciliation          │
│  │    Flagged 8 genuine errors                              │
│  │    ¥47.2M exposure — routed to Decision Inbox            │
│  │    Today 08:42:22                                AE-1245 │
│  │                                                          │
│  │ 👤 User · vidur@lyzr.ai · Monthly Close                   │
│  │    Approved FX hedge rollover                            │
│  │    GBP/JPY forward — GBP 45M — via Decision Inbox       │
│  │    Yesterday 18:15                               AE-1239 │
│  │                                                          │
│  │ 📄 System · System · Agent Configuration                  │
│  │    RULES.md updated                                      │
│  │    Added threshold: regulatory filings require CFO       │
│  │    sign-off                                              │
│  │    Yesterday 14:30                               AE-1238 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 5.4 Event types

| Type | Icon | Color | Represents |
|---|---|---|---|
| agent_action | Bot (🤖) | Brown (primary) | Agent completed an action |
| user_decision | User (👤) | Blue | Human approval/rejection |
| system_event | FileText (📄) | Gray | System/infrastructure event |
| guardrail_trigger | AlertTriangle (⚠️) | Amber | Compliance rule activated |

## 5.5 Timeline design

- Vertical 2px line running down the left side
- Colored circular icon on the line for each event
- Event card to the right showing: type badge, actor, journey, action, details, timestamp, event ID
- Most recent events at top
- Filterable by: event type, journey, actor, time range

## 5.6 Export

"Export Log" button in header — exports filtered events as CSV or PDF.
Critical for audit compliance (SOX, GDPR, MiFID II require exportable logs).

## 5.7 Data model

```typescript
interface AuditEvent {
  id: string;                    // "AE-1247"
  timestamp: string;             // "Today 08:42:15"
  type: "agent_action" | "user_decision" | "system_event" | "guardrail_trigger";
  actor: string;                 // "CFO Office Agent" or "vidur@lyzr.ai"
  action: string;                // Short summary
  details: string;               // Detailed description with specific numbers
  journey?: string;              // Which journey
  entity?: string;               // Which entity
  relatedRunId?: string;         // Link to Agent Run
  relatedDecisionId?: string;    // Link to Decision Inbox item
}
```


# ═══════════════════════════════════════════════════════════════════════════════
# PART 6: IMPLEMENTATION RULES
# ═══════════════════════════════════════════════════════════════════════════════

## 6.1 Observe pages are READ-ONLY views over agent activity

Unlike Build pages (which write to the agent repo), Observe pages only
READ data. They display traces, decisions, and audit logs — they don't
modify the agent's skills, knowledge, or configuration.

The only WRITE action in Observe is approving/rejecting a Decision Inbox
item, which writes the approval status to the decision store.

## 6.2 Sample data pattern

Until the backend persists real run data, use the `useSampleData()` hook:
- When sample data toggle is ON: render hardcoded demo data
- When sample data toggle is OFF: show empty state
- Show "SAMPLE DATA" badge next to the page title when using demo data

This lets the product demo convincingly while communicating honestly.

## 6.3 Observe pages are the same across verticals

When building a new AgenticOS, copy all four Observe pages and change ONLY:
1. Decision content (amounts, entities, journey references)
2. Compliance check names (SOX → HIPAA, etc.)
3. Agent and journey names
4. Safety check names
5. Sample data content

The page layouts, component structure, SVG tracing diagram, trace card
rendering, timeline format — all stay identical.

## 6.4 Audit Trail is a derived view

DO NOT maintain a separate audit event store. Derive audit events from:
- Agent Run trace steps → agent_action events
- Decision Inbox status changes → user_decision events
- Config file changes (git commits in agent repo) → system_event events
- Safety check failures → guardrail_trigger events

## 6.5 The SVG decision tracing diagram is standard

The three-column bezier-curve diagram (Agent Decision → Compliance Checks → Output)
is the same visual in every AgenticOS. Only the compliance check node labels
change per vertical.

Implementation notes:
- Use cubic bezier paths (C command in SVG path d attribute)
- Fan out from the right edge of the left box to each middle node
- Fan in from each middle node to the left edge of the right box
- Color nodes by verdict: green fill for pass, red fill for flagged, amber for warning
- Agent Decision box uses brand primary color
- Output box uses neutral color


# ═══════════════════════════════════════════════════════════════════════════════
# PART 7: FRONTEND COMPONENT CHECKLIST
# ═══════════════════════════════════════════════════════════════════════════════

## OBSERVE components:

- [ ] DecisionInboxPage — list view with metric cards, filter tabs, decision cards
- [ ] DecisionDetailPage — full decision view with SVG tracing + compliance checks
- [ ] DecisionTracingSVG — bezier-curve compliance check visualization
- [ ] ComplianceCheckCard — expandable card with verdict badge and evidence
- [ ] OverrideSection — justification input + "Approve with Override" (for flagged decisions)
- [ ] AgentRunsPage — table with stats row and filter tabs
- [ ] ExecutionTracePanel — right slide-over with metadata, I/O, safety, trace steps
- [ ] TraceStepCard — expandable step with icon, label, duration, timestamp, I/O
- [ ] SafetyMetricCard — shield icon with verdict and explanation
- [ ] ComplianceGuardrailsPage — three-tab layout (Guardrails, Frameworks, Validation)
- [ ] AuditTrailPage — vertical timeline with typed events
- [ ] AuditEventCard — icon + type badge + actor + action + details + timestamp

## Shared between Observe pages:

- [ ] PriorityBadge — CRITICAL (red), HIGH (amber), MEDIUM (neutral), LOW (gray)
- [ ] VerdictBadge — PASS (green), FLAGGED (red), WARNING (amber)
- [ ] StatusBadge — Completed (green), Running (blue), Failed (red), Queued (gray)
- [ ] SampleDataBadge — shows when viewing demo data
- [ ] NoDataState — empty state when sample data is off
- [ ] MetricCard — reusable stat card (count, label, optional sub-label)
