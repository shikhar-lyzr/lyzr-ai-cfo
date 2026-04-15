# AGENT_STREAMING.md

# This file defines how GitClaw agent execution is displayed to users in
# real-time. It covers the Agent Console (full-screen chat), journey chat
# panels, and the pipeline visualization that appears during agent work.
#
# Give it to Replit / Claude Code alongside the other standard MD files.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 1: THE THREE SURFACES WHERE AGENTS APPEAR
# ═══════════════════════════════════════════════════════════════════════════════

## 1.1 One agent, three surfaces

Every AgenticOS has ONE agent (one SOUL.md, one memory, one skill set)
that appears on THREE different surfaces:

| Surface | Where | Context scope | Chat position |
|---|---|---|---|
| Command Center | Home page (/) | Full context — all skills, all data | Search bar at top → redirects to Agent Console |
| Journey Pages | /financial-reconciliation, etc. | Scoped to THAT journey's data | Bottom-docked chat panel |
| Agent Console | /agent-console | Full context — all skills, all data | Full-screen dedicated chat |

What changes between surfaces is the CONTEXT PAYLOAD (systemPromptSuffix),
not the agent itself. The agent on the Monthly Close page sees monthly close
data. The same agent on the Agent Console sees everything.

## 1.2 The Agent Console is the primary streaming surface

The Agent Console is where users see the full depth of agent execution.
It has three panels:

```
┌─────────────────────────────────┬──────────────────────────┐
│                                 │     AGENT CONTEXT        │
│     CHAT + PIPELINE             │     (right sidebar)      │
│                                 │                          │
│  [User message]                 │  ▸ Active Skills    21   │
│                                 │    variance-analysis     │
│  [Agent pipeline steps]         │    board-deck-generation │
│    Loading agent...             │    cash-flow-forecasting │
│    Skill loaded...              │    Show 17 More ▾        │
│    Reading files...             │                          │
│    Analyzing...                 │  ▸ Data Files       22   │
│                                 │    q1-actuals.json       │
│  [Agent response]               │    q1-forecast.json      │
│    Here is the Q1 budget...     │    budget-vs-actuals.json│
│    | Revenue | $498M | ...      │    Show 18 More ▾        │
│                                 │                          │
│                                 │  ▸ Compliance Guards  4  │
│                                 │    >$1M requires approval│
│                                 │    SOX compliance review │
│                                 │    PII masked externally │
│                                 │    Show 1 More ▾         │
├─────────────────────────────────┤                          │
│  [input] Message CFO Agent...   │                          │
│                    [Send/Stop]  │                          │
│  AI can make mistakes. Verify.  │                          │
└─────────────────────────────────┴──────────────────────────┘
```

### Agent header:
```
🤖 CFO Agent
● Online & Ready
```
Shows agent name (from agent.yaml) and status.

### Right sidebar — AGENT CONTEXT:
Three collapsible sections showing what the agent has access to:

**Active Skills** — all skills from agent/skills/ with count badge.
Shows first 4, then "Show N More" expandable. Each skill is a tag/chip
with a green dot indicating active status.

**Data Files** — all knowledge files from knowledge/. Shows first 4,
then "Show N More". Each is a file name with a document icon.

**Compliance Guardrails** — key rules from RULES.md. Shows first 3,
then "Show N More". Each is a short rule summary with a shield icon.

### Input bar:
- Placeholder: "Message CFO Agent..."
- Send button (arrow icon) when idle
- Stop button (red square) when streaming — calls abortController.abort()
- Disclaimer: "AI can make mistakes. Verify critical financial data."

## 1.3 Journey chat panel (bottom-docked)

Journey pages have a collapsed chat panel at the bottom. When expanded,
it shows the same pipeline + response format but smaller. The chat is
scoped to the journey's context via systemPromptSuffix.

Journey chat panels include domain-specific NUDGES — pre-built contextual
questions the user can tap instead of typing:

```
┌──────────────────────────────────────────────────────────────┐
│  Nudges: [Why is Frankfurt blocking?] [Are we on track?]    │
│  [input] Ask about this journey...              [Send/Stop] │
└──────────────────────────────────────────────────────────────┘
```


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2: THE PIPELINE — HOW AGENT EXECUTION IS DISPLAYED
# ═══════════════════════════════════════════════════════════════════════════════

## 2.1 The problem with showing raw GitClaw events

GitClaw streams GCMessage events that look like this:

```
tool_use: { toolName: "read", args: { file_path: "skills/budget-planning/SKILL.md" } }
tool_result: { toolName: "read", content: "---\nname: budget-planning\n..." }
tool_use: { toolName: "read", args: { file_path: "knowledge/financial-data/q1-actuals.json" } }
```

Showing these raw is unusable. The user sees:
```
read(skills/budget-planning/SKILL.md) read(skills/budget-planning/SKILL.md)
read: loaded
read(knowledge/financial-data/q1-actuals.json) read(knowledge/financial-data/q1-actuals.json)
read: loaded
```

This is technically accurate but tells the user nothing about WHAT is
happening or WHY.

## 2.2 The pipeline step types

Every GitClaw event should be classified into one of these step types,
each with a distinct icon, color, and human-readable label:

| Step type | Icon | Color | Label format | When |
|---|---|---|---|---|
| agent_init | Cpu | Gray | "Initializing agent..." | First event, agent loading |
| skill_discovery | Compass | Blue | "Discovering relevant skills..." | task_tracker begin |
| skill_load | BookOpen | Indigo | "Loading skill — {skill-name}" | read() on a SKILL.md file |
| memory_load | Brain | Purple | "Loading agent memory..." | memory(action:"load") |
| file_read | FileSearch | Teal | "Reading {filename}" | read() on knowledge/data files |
| file_write | FilePlus | Green | "Writing {filename}" | write() to any file |
| tool_exec | Terminal | Amber | "Running {tool-name}" | cli() or custom tool execution |
| llm_thinking | Sparkles | Violet | "Analyzing..." | When LLM is generating (delta events) |
| wiki_update | Network | Purple | "Updating wiki — {page}" | write() to memory/wiki/ |
| output_ready | CheckCircle | Green | "Output generated" | Final write or response start |
| error | AlertCircle | Red | "Error: {message}" | Error events |

## 2.3 How to classify GitClaw events

The server maps raw GCMessage events to pipeline step types:

```typescript
function classifyEvent(msg: GCMessage): PipelineStep | null {
  if (msg.type === "system" && msg.subtype === "session_start") {
    return { type: "agent_init", label: "Initializing agent..." };
  }

  if (msg.type === "tool_use") {
    const { toolName, args } = msg;

    // task_tracker — skill discovery
    if (toolName === "task_tracker") {
      if (args.action === "begin") {
        return {
          type: "skill_discovery",
          label: "Discovering relevant skills...",
          detail: args.objective || null,
        };
      }
      return null; // suppress task_tracker updates/loaded
    }

    // memory — loading/saving memory
    if (toolName === "memory") {
      if (args.action === "load") {
        return { type: "memory_load", label: "Loading agent memory..." };
      }
      if (args.action === "save") {
        return { type: "file_write", label: "Saving to memory..." };
      }
    }

    // read — skill vs. data file
    if (toolName === "read") {
      const path = args.file_path || args.path || "";
      if (path.includes("skills/") && path.endsWith("SKILL.md")) {
        const skillName = path.split("skills/")[1]?.split("/")[0];
        return {
          type: "skill_load",
          label: `Loading skill — ${skillName}`,
          file: path,
        };
      }
      if (path.includes("memory/wiki/")) {
        const pageName = path.split("/").pop()?.replace(".md", "");
        return {
          type: "file_read",
          label: `Reading wiki — ${pageName}`,
          file: path,
        };
      }
      // Knowledge or data file
      const fileName = path.split("/").pop();
      return {
        type: "file_read",
        label: `Reading ${fileName}`,
        file: path,
      };
    }

    // write
    if (toolName === "write") {
      const path = args.file_path || args.path || "";
      if (path.includes("memory/wiki/")) {
        const pageName = path.split("/").pop()?.replace(".md", "");
        return {
          type: "wiki_update",
          label: `Updating wiki — ${pageName}`,
          file: path,
        };
      }
      const fileName = path.split("/").pop();
      return {
        type: "file_write",
        label: `Writing ${fileName}`,
        file: path,
      };
    }

    // cli — command execution
    if (toolName === "cli") {
      return {
        type: "tool_exec",
        label: `Running command`,
        detail: args.command?.substring(0, 80),
      };
    }

    // Any other tool (custom tools, composio tools)
    return {
      type: "tool_exec",
      label: `Running ${toolName}`,
      detail: JSON.stringify(args).substring(0, 100),
    };
  }

  // tool_result — attach result to the previous step, don't show as new step
  if (msg.type === "tool_result") {
    return null; // handled by updating the previous step's status
  }

  // delta — text streaming, not a pipeline step
  if (msg.type === "delta") {
    return null;
  }

  return null;
}
```

## 2.4 Pipeline step rendering

Each pipeline step renders as a compact row with icon, label, and status:

### Step states:

```
⟳ Running    — spinner animation, muted text
✓ Completed  — checkmark, normal text, optional duration
✗ Failed     — red X, error message
```

### Visual format (compact):

```
  ⚙️ ⟳  Initializing agent...
  🧭 ✓  Discovering relevant skills...
         "Retrieve and present budget information"
  🧠 ✓  Loading agent memory...
  📖 ✓  Loading skill — budget-planning                    0.3s
  📄 ✓  Reading q1-actuals.json                            0.5s  ›
  📄 ✓  Reading q1-forecast.json                           0.4s  ›
  📄 ✓  Reading budget-vs-actuals.json                     0.6s  ›
  ✨ ⟳  Analyzing...
```

### Key design rules:

1. **Each step is one line** (compact mode). Icon + status indicator + label + optional duration + optional expand chevron.

2. **Steps appear incrementally** as events arrive. New steps animate in (Framer Motion, slide down + fade in).

3. **Duration appears on the right** when a step completes. Calculated from step start to the corresponding tool_result.

4. **Expand chevron (›)** appears on steps that have expandable content (file reads, tool calls). Click to see the full input/output.

5. **The "Analyzing..." step** appears when the LLM is generating text (delta events are flowing). It stays in "running" state until the response is complete.

6. **Suppress noisy intermediate events.** Don't show every task_tracker update or "loaded" confirmation. The classification function returns null for these — they update the previous step's status instead of creating new rows.

7. **Completed step count** shows at the top when the pipeline is done: "▾ 16 STEPS COMPLETED" (collapsible).

## 2.5 Expanded view (when user clicks ›)

When a user clicks the expand chevron on a pipeline step, the step card
expands to show the full content:

### For file_read (knowledge files):

```
  📄 ✓  Reading q1-actuals.json                            0.5s  ▾
       ┌──────────────────────────────────────────────────────┐
       │ FILE: knowledge/financial-data/q1-actuals.json      │
       │ SIZE: 24 KB  ·  ROWS: 37 line items                │
       │                                                      │
       │ {                                                    │
       │   "period": "Q1 FY2026",                            │
       │   "currency": "USD",                                │
       │   "line_items": [                                   │
       │     { "name": "Total Revenue",                      │
       │       "actual": 487200000,                          │
       │       "budget": 498400000 },                        │
       │     ...                                             │
       │   ]                                                 │
       │ }                                                    │
       │                                    [Show Full File]  │
       └──────────────────────────────────────────────────────┘
```

- Dark background code block (monospace)
- File path, size, and row/item count at the top
- Preview of the content (first ~15 lines)
- "Show Full File" link for large files

### For skill_load:

```
  📖 ✓  Loading skill — budget-planning                    0.3s  ▾
       ┌──────────────────────────────────────────────────────┐
       │ SKILL: budget-planning                              │
       │ FILE: skills/budget-planning/SKILL.md               │
       │                                                      │
       │ # Budget Planning & Analysis                        │
       │                                                      │
       │ ## When to use                                      │
       │ When the user asks about budgets, forecasts,        │
       │ budget vs actuals, or spending plans.               │
       │                                                      │
       │ ## Methodology                                      │
       │ 1. Load budget and actuals data                     │
       │ 2. Calculate variance for each line item            │
       │ 3. Flag material variances (>5% or >$50K)           │
       │ 4. Generate executive commentary                    │
       │ ...                                                 │
       └──────────────────────────────────────────────────────┘
```

- Shows the skill name prominently
- Renders the SKILL.md content (or first ~20 lines with expand)
- This lets the user see exactly WHAT instructions the agent is following

### For tool_exec:

```
  ⚙️ ✓  Running reconciliation_matcher                     3.2s  ▾
       ┌──────────────────────────────────────────────────────┐
       │ TOOL: reconciliation_matcher                        │
       │                                                      │
       │ INPUT:                                              │
       │ { "source": "gl_trial_balance.csv",                 │
       │   "target": "bank_statements.csv",                  │
       │   "match_keys": ["reference", "amount", "date"] }   │
       │                                                      │
       │ OUTPUT:                                             │
       │ { "matched": 4105, "unmatched": 223,                │
       │   "match_rate": 0.9485,                             │
       │   "exceptions": [...] }                             │
       └──────────────────────────────────────────────────────┘
```

- Shows tool name, input (JSON), and output (JSON)
- Input block on dark background, output on tinted background

### For wiki_update:

```
  🔗 ✓  Updating wiki — leave-policy                       1.1s  ▾
       ┌──────────────────────────────────────────────────────┐
       │ WIKI PAGE: memory/wiki/concepts/leave-policy.md     │
       │ OPERATION: Updated existing page                    │
       │                                                      │
       │ CHANGES:                                            │
       │ + Added new section: "Q2 Policy Updates"            │
       │ + Updated casual leave count: 12 → 15 days          │
       │ + Added cross-reference: [[compliance-requirements]] │
       │                                                      │
       │ SOURCES ADDED:                                      │
       │ knowledge/docs/leave-policy-2026-update.md          │
       └──────────────────────────────────────────────────────┘
```

- Shows the wiki page path
- Shows what changed (additions, updates, new cross-references)
- Shows which source documents informed the update


# ═══════════════════════════════════════════════════════════════════════════════
# PART 3: THE EXECUTION SEQUENCE — WHAT THE USER SEES IN ORDER
# ═══════════════════════════════════════════════════════════════════════════════

## 3.1 Standard execution sequence

When a user sends a message, the pipeline should show steps in this
natural order. Not every step appears every time — it depends on what
the agent decides to do.

```
Phase 1: INITIALIZATION
  ⚙️  Initializing agent...                         ← always first
  🧭  Discovering relevant skills...                 ← task_tracker begin
       "Retrieve and present budget information"     ← shows the objective
  🧠  Loading agent memory...                        ← memory load

Phase 2: SKILL + DATA LOADING
  📖  Loading skill — budget-planning               ← read(SKILL.md)
  📄  Reading q1-actuals.json                        ← read(data file)
  📄  Reading q1-forecast.json                       ← read(data file)
  📄  Reading budget-vs-actuals.json                 ← read(data file)

Phase 3: EXECUTION
  ⚙️  Running reconciliation_matcher                ← tool/cli execution
  ⚙️  Running threshold_checker                     ← tool execution

Phase 4: ANALYSIS + RESPONSE
  ✨  Analyzing...                                   ← LLM generating response
  (streaming text appears below the pipeline)

Phase 5: POST-PROCESSING (if applicable)
  🔗  Updating wiki — budget-analysis               ← wiki auto-ingest
  ✅  Output generated                               ← file write
```

## 3.2 What gets suppressed

These GitClaw events should NOT create visible pipeline steps:

- `task_tracker` events with action "update" or "loaded" — noisy bookkeeping
- `tool_result` events — the result updates the previous step's status
- `delta` events — these are the streaming text, rendered below the pipeline
- `system` events other than session_start — internal lifecycle events
- Duplicate read events for the same file path within one turn

## 3.3 How the pipeline collapses after completion

When the agent finishes responding:
1. The pipeline steps collapse into a summary bar:
   ```
   ▾ 16 STEPS COMPLETED
   ```
2. Clicking the bar expands all steps
3. The agent's text response is always visible below (never collapsed)
4. The summary bar shows step count only — not duration or cost
   (those belong in Agent Runs, not inline)


# ═══════════════════════════════════════════════════════════════════════════════
# PART 4: REAL-TIME CONTEXT PANEL (RIGHT SIDEBAR)
# ═══════════════════════════════════════════════════════════════════════════════

## 4.1 What it shows

The right sidebar shows what the agent has access to — its current context.
Three sections:

### Active Skills (count badge)
- Lists all skills from agent/skills/ by name
- Each skill is a tag/chip with green dot for active
- Shows first 4, "Show N More" expandable
- When a skill is loaded during the current conversation, its tag
  briefly highlights (pulse animation) to show it was just used

### Data Files (count badge)
- Lists all knowledge files from knowledge/ directory
- Document icon + filename
- Shows first 4, "Show N More" expandable
- When a file is read during the current conversation, its entry
  briefly highlights to show it was just accessed

### Compliance Guardrails (count badge)
- Key rules from RULES.md and agent.yaml compliance block
- Shield icon + rule summary (one line)
- Shows first 3, "Show 1 More" expandable
- These are always-active constraints, not runtime checks

## 4.2 Live updates during streaming

As the agent executes, the right sidebar should update in real-time:

- When a skill is loaded: the skill's chip gets a brief glow/pulse
- When a file is read: the file's entry gets a brief glow/pulse
- When a guardrail is triggered: the guardrail entry turns amber

This connects the pipeline (left) with the context (right) visually.
The user can see: "The agent loaded budget-planning skill" in the pipeline
AND see the budget-planning chip pulse in the sidebar simultaneously.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 5: THE SSE STREAMING IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

## 5.1 Server-side: mapping GitClaw events to frontend events

The server receives raw GCMessage events from GitClaw and maps them to
typed SSE events that the frontend understands:

```typescript
// Event types the frontend receives via SSE
type FrontendEvent =
  | { event: "pipeline_step"; data: PipelineStep }
  | { event: "delta"; data: { text: string } }
  | { event: "thinking"; data: { text: string } }
  | { event: "done"; data: { finished: true; usage: Usage } }
  | { event: "error"; data: { error: string } };

interface PipelineStep {
  id: string;
  type: StepType;
  label: string;
  detail?: string;        // subtitle or objective text
  file?: string;          // file path for read/write steps
  status: "running" | "completed" | "failed";
  duration?: number;      // milliseconds (set on completion)
  content?: string;       // file content (for expandable view)
}
```

### Server route pattern:

```typescript
for await (const msg of stream) {
  if (abortController.signal.aborted) break;

  // 1. Classify the event
  const step = classifyEvent(msg);

  // 2. Send pipeline step if classified
  if (step) {
    sseWrite(res, "pipeline_step", step);
  }

  // 3. When a tool_result arrives, update previous step status
  if (msg.type === "tool_result") {
    const duration = Date.now() - lastStepStartTime;
    sseWrite(res, "pipeline_step", {
      id: lastStepId,
      status: msg.isError ? "failed" : "completed",
      duration,
      content: msg.content?.substring(0, 2000), // preview for expand
    });
  }

  // 4. Stream text deltas
  if (msg.type === "delta") {
    sseWrite(res, "delta", { text: msg.content });
  }

  // 5. Stream thinking (extended thinking / chain-of-thought)
  if (msg.type === "thinking") {
    sseWrite(res, "thinking", { text: msg.content });
  }

  // 6. Complete
  if (msg.type === "assistant") {
    sseWrite(res, "done", { finished: true, usage: msg.usage });
  }
}
```

## 5.2 Frontend: the useChatStream hook

```typescript
interface ChatState {
  messages: ChatMessage[];
  pipelineSteps: PipelineStep[];
  isStreaming: boolean;
  activeFiles: string[];        // files being read/written
  activeSkill: string | null;   // currently loaded skill
}

function useChatStream() {
  const [state, setState] = useState<ChatState>({...});
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = async (content: string) => {
    abortRef.current = new AbortController();
    setState(s => ({
      ...s,
      isStreaming: true,
      pipelineSteps: [],
      messages: [...s.messages, { role: "user", content }],
    }));

    const response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...], sessionId, page }),
      signal: abortRef.current.signal,
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const eventLine = part.match(/^event: (.+)$/m)?.[1];
        const dataLine = part.match(/^data: (.+)$/m)?.[1];
        if (!eventLine || !dataLine) continue;
        const data = JSON.parse(dataLine);

        switch (eventLine) {
          case "pipeline_step":
            setState(s => {
              // Update existing step or add new one
              const existing = s.pipelineSteps.find(p => p.id === data.id);
              if (existing) {
                return {
                  ...s,
                  pipelineSteps: s.pipelineSteps.map(p =>
                    p.id === data.id ? { ...p, ...data } : p
                  ),
                };
              }
              return {
                ...s,
                pipelineSteps: [...s.pipelineSteps, data],
                activeSkill: data.type === "skill_load"
                  ? data.label.replace("Loading skill — ", "")
                  : s.activeSkill,
                activeFiles: data.file
                  ? [...s.activeFiles, data.file]
                  : s.activeFiles,
              };
            });
            break;

          case "delta":
            assistantText += data.text;
            setState(s => ({
              ...s,
              messages: updateLastAssistant(s.messages, assistantText),
            }));
            break;

          case "done":
            setState(s => ({ ...s, isStreaming: false }));
            break;
        }
      }
    }
  };

  const stopStream = () => {
    abortRef.current?.abort();
    setState(s => ({ ...s, isStreaming: false }));
  };

  return { ...state, sendMessage, stopStream };
}
```

## 5.3 The abort flow

```
User clicks Stop (red square button)
  → abortController.abort() in frontend
  → fetch throws AbortError (caught gracefully)
  → SSE connection closes
  → res.on("close") fires on server (NOT req.on — this is critical)
  → server's abortController.abort()
  → GitClaw stops the agentic loop
  → pipeline steps freeze at current state
  → "stopped" message appears below last step
```

Always use `res.on("close")`, never `req.on("close")`. The request close
event fires when the POST body is consumed (immediately). The response
close event fires when the client disconnects (what you actually want).


# ═══════════════════════════════════════════════════════════════════════════════
# PART 6: RESPONSE RENDERING
# ═══════════════════════════════════════════════════════════════════════════════

## 6.1 Text response rendering

The agent's text response renders below the pipeline steps using:
- ReactMarkdown with remark-gfm for GitHub Flavored Markdown
- Tables, code blocks, bold, italic, links — all rendered properly
- No emojis in the rendering — use Lucide icons instead
- Status indicators in tables: ✅ (green check) and ⚠️ (amber warning)
  rendered as colored SVG icons, not emoji

## 6.2 Response appears WHILE the pipeline is still showing

The pipeline steps and the response are NOT sequential in the UI. The
response starts streaming as soon as delta events arrive, which may be
while tool calls are still completing. The layout is:

```
[Pipeline steps — fixed at top of the turn]
  ⚙️ ✓ Initializing agent...
  📖 ✓ Loading skill — budget-planning
  📄 ✓ Reading q1-actuals.json
  ✨ ⟳ Analyzing...                         ← still running

[Response — streams below, growing as deltas arrive]
  Here is the complete Q1 FY2026 Budget Overview —
  sourced from the board-approved forecast...

  | Line Item     | Budget  | Actual  | Variance |
  |---------------|---------|---------|----------|
  | Total Revenue | $498.4M | $487.2M | ($11.2M) |
  ...
```

## 6.3 Structured output (journey analysis)

For journey analysis runs (POST /api/journey/analyze), the response uses
`[SECTION]...[/SECTION]` blocks that the frontend parses into rich cards
with metrics, status badges, and expandable markdown details. See the
existing AiConclusion component.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 7: COMPONENT CHECKLIST
# ═══════════════════════════════════════════════════════════════════════════════

## Agent Console components:
- [ ] AgentConsolePage — three-panel layout (sidebar, chat, context)
- [ ] AgentHeader — agent name, status, model
- [ ] AgentContextPanel — right sidebar with skills, files, guardrails
- [ ] SkillChip — tag for active skill with pulse animation on use
- [ ] DataFileEntry — file listing with highlight on read
- [ ] GuardrailEntry — rule summary with shield icon

## Pipeline components:
- [ ] PipelineContainer — wraps all steps, handles collapse/expand
- [ ] PipelineStep — single step row with icon, label, status, duration
- [ ] PipelineStepExpanded — expanded view with file content or I/O
- [ ] PipelineCollapsedBar — "N STEPS COMPLETED" summary after done
- [ ] StepStatusIndicator — spinner (running), check (done), X (failed)
- [ ] StepIcon — maps step type to Lucide icon with correct color

## Chat components:
- [ ] ChatMessageList — scrollable message history
- [ ] UserMessage — right-aligned message bubble
- [ ] AssistantMessage — left-aligned with pipeline + response
- [ ] ChatInput — input with send/stop toggle
- [ ] StopButton — red square, calls abort
- [ ] StreamingText — renders delta events as they arrive

## Shared:
- [ ] useChatStream — hook managing SSE connection, state, abort
- [ ] classifyEvent — server-side event classifier (Part 2.3)
- [ ] sseWrite — server utility for writing SSE events

## Step type → icon mapping (for StepIcon component):
```typescript
const STEP_ICONS: Record<StepType, { icon: LucideIcon; color: string }> = {
  agent_init:      { icon: Cpu,          color: "text-gray-500" },
  skill_discovery: { icon: Compass,      color: "text-blue-600" },
  skill_load:      { icon: BookOpen,     color: "text-indigo-600" },
  memory_load:     { icon: Brain,        color: "text-purple-600" },
  file_read:       { icon: FileSearch,   color: "text-teal-600" },
  file_write:      { icon: FilePlus,     color: "text-green-600" },
  tool_exec:       { icon: Terminal,     color: "text-amber-600" },
  llm_thinking:    { icon: Sparkles,     color: "text-violet-500" },
  wiki_update:     { icon: Network,      color: "text-purple-600" },
  output_ready:    { icon: CheckCircle,  color: "text-green-600" },
  error:           { icon: AlertCircle,  color: "text-red-600" },
};
```
