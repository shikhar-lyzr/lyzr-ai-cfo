# LLM_WIKI_IMPLEMENTATION.md

# This file ensures every GitClaw-based AgenticOS product implements the
# LLM Wiki pattern correctly. Give it to Replit / Claude Code alongside
# GITCLAW_FOUNDATION.md when building any vertical OS product.

# ═══════════════════════════════════════════════════════════════════════════════
# PART 1: WHAT THE LLM WIKI IS (for the coding agent to understand)
# ═══════════════════════════════════════════════════════════════════════════════

## 1.1 The core idea (Karpathy's pattern)

Most systems use RAG: upload documents → retrieve chunks at query time → generate
an answer. The LLM rediscovers knowledge from scratch on every question. Nothing
accumulates. Nothing compounds.

The LLM Wiki is different. Instead of retrieving from raw documents at query time,
the LLM **incrementally builds and maintains a persistent wiki** — a structured,
interlinked collection of markdown files. When new information enters the system,
the LLM reads it, extracts key knowledge, and integrates it into the existing wiki:
updating entity pages, revising topic summaries, noting contradictions, strengthening
or challenging the evolving synthesis.

**The wiki is a persistent, compounding artifact.** Cross-references are already
built. Contradictions are already flagged. Synthesis already reflects everything
ingested. The wiki gets richer with every source added and every question answered.

The human (or in our case, the agent's workflow) owns sourcing and asking good
questions. The LLM owns all the grunt work: summarizing, cross-referencing, filing,
and bookkeeping.

## 1.2 Three layers

| Layer | What it is | Who owns it | Mutability |
|---|---|---|---|
| **Raw sources** | Original documents, uploads, API outputs, task results | The system/user | Immutable — never modified |
| **The wiki** | LLM-generated markdown pages with cross-references | The LLM | LLM writes, humans read |
| **The schema** | Rules for how the wiki is structured and maintained | The product team | Co-evolved over time |

In a GitClaw AgenticOS context:
- Raw sources = knowledge documents, task outputs, API responses, uploaded files
- The wiki = `agent/memory/wiki/` directory
- The schema = the wiki skills (ingest, query, lint) in `agent/skills/`

## 1.3 Three operations

**Ingest** — New information enters the system. The LLM reads the source, extracts
entities/concepts/metrics, checks existing wiki pages for overlap, updates existing
pages with new data, creates new pages if needed, updates `index.md`, and logs the
change in `log.md`. A single source might touch 10-15 wiki pages.

**Query** — A user asks a question. The LLM reads `index.md` to find relevant pages,
reads those pages, and synthesizes an answer with `[[wiki-link]]` citations. Good
answers can be filed back into the wiki as synthesis pages — so explorations compound
just like ingested sources do.

**Lint** — Periodic health check. Find: orphan pages (no inbound links), broken
`[[links]]`, stale content superseded by newer sources, contradictions between pages,
important concepts mentioned but lacking their own page, missing cross-references.

## 1.4 Why this matters for AgenticOS products

In an HR OS, the wiki accumulates knowledge about HR policies, leave edge cases,
payroll rules, compliance requirements — compiled from uploaded policy documents,
resolved support tickets, and agent interactions. Over time, the agent doesn't need
to re-read the 200-page employee handbook on every query. The knowledge is already
compiled, cross-referenced, and current.

In a CFO OS, the wiki accumulates knowledge about financial close processes, audit
requirements, regulatory frameworks, vendor contracts — compiled from uploaded SOPs,
completed reconciliations, and compliance documents.

The wiki IS the domain knowledge layer. It replaces RAG with compiled intelligence.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2: FILE STRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════

## 2.1 Directory layout inside the GitAgent repo

```
agent/
├── knowledge/                    ← Raw sources (Layer 1 — immutable)
│   ├── index.yaml                ← GitAgent knowledge index
│   └── docs/
│       ├── leave-policy.md       ← Uploaded/curated source documents
│       ├── employee-handbook.md
│       └── payroll-guide.pdf
│
├── memory/
│   ├── MEMORY.md                 ← Agent's working memory (GitClaw standard)
│   └── wiki/                     ← The compiled wiki (Layer 2 — LLM-maintained)
│       ├── index.md              ← Master catalog of all wiki pages
│       ├── log.md                ← Chronological record of all operations
│       ├── entities/             ← Named things (people, teams, systems, vendors)
│       │   ├── hr-department.md
│       │   ├── workday-system.md
│       │   └── benefits-provider.md
│       ├── concepts/             ← Abstract knowledge (policies, processes, rules)
│       │   ├── leave-policy.md
│       │   ├── payroll-cycle.md
│       │   └── compliance-requirements.md
│       └── synthesis/            ← Agent-generated cross-referencing answers
│           ├── leave-vs-pto-comparison.md
│           └── q1-policy-changes-summary.md
│
├── skills/
│   ├── wiki-ingest/SKILL.md      ← Ingest skill
│   ├── wiki-query/SKILL.md       ← Query skill
│   └── wiki-lint/SKILL.md        ← Lint/maintenance skill
│
├── SOUL.md
├── RULES.md
└── agent.yaml
```

## 2.2 Wiki page format (every page follows this structure)

```markdown
---
title: Leave Policy
type: concept                    # entity | concept | synthesis | source-summary
category: hr-policies
updated: 2026-04-12
sources:
  - knowledge/docs/leave-policy.md
  - knowledge/docs/employee-handbook.md
tags: [leave, pto, policy, compliance]
---

# Leave Policy

[Content compiled by the LLM from raw sources]

Types of leave available: casual (12 days), sick (10 days), earned (15 days).
See also [[payroll-cycle]] for leave encashment rules.
[[benefits-provider]] handles leave insurance claims.

## Key rules
- Leave cannot be carried forward beyond Q1 of next fiscal year
- Manager approval required for >3 consecutive days
- See [[compliance-requirements]] for regulatory obligations

## Contradictions / open questions
- Employee handbook says 12 casual days but the 2025 policy update says 15.
  Source: knowledge/docs/leave-policy.md vs knowledge/docs/employee-handbook.md
  **Status: needs clarification from HR**
```

## 2.3 index.md format

```markdown
# Wiki Index

Last updated: 2026-04-12T14:30:00Z
Total pages: 28

## Entities
- [[hr-department]] — Internal HR team structure and contacts
- [[workday-system]] — HRIS platform used for employee records
- [[benefits-provider]] — External benefits administration vendor

## Concepts
- [[leave-policy]] — Types of leave, accrual rules, approval process
- [[payroll-cycle]] — Monthly payroll timeline, cutoff dates, encashment
- [[compliance-requirements]] — Regulatory requirements for HR operations

## Synthesis
- [[leave-vs-pto-comparison]] — Analysis of leave vs PTO models (2 sources)
- [[q1-policy-changes-summary]] — Summary of all Q1 2026 policy updates (4 sources)
```

## 2.4 log.md format

```markdown
# Wiki Log

## [2026-04-12] ingest | Employee Handbook 2026
- Source: knowledge/docs/employee-handbook.md
- Pages updated: leave-policy, payroll-cycle, compliance-requirements
- Pages created: benefits-provider, hr-department
- Index updated: +2 entities

## [2026-04-12] query | "What is the leave encashment policy?"
- Pages consulted: leave-policy, payroll-cycle
- Answer filed as: synthesis/leave-encashment-rules.md

## [2026-04-11] lint | Health check
- Orphan pages found: 1 (workday-system — no inbound links)
- Broken links found: 0
- Stale pages: compliance-requirements (source updated 30 days ago)
```


# ═══════════════════════════════════════════════════════════════════════════════
# PART 3: THE THREE SKILLS
# ═══════════════════════════════════════════════════════════════════════════════

## 3.1 wiki-ingest skill

```markdown
---
name: wiki-ingest
description: Ingest a raw source document into the wiki — extract entities, concepts, and metrics, update existing pages, create new ones, maintain index and log
---

# Wiki Ingest

## When to use
When new knowledge documents are uploaded, when task outputs contain reusable
knowledge, or when the system explicitly triggers ingestion after a significant
agent interaction.

## Steps

1. Read the source document fully
2. Read `memory/wiki/index.md` to understand existing wiki structure
3. Identify entities (named things: people, teams, systems, vendors, products)
4. Identify concepts (abstract knowledge: policies, processes, rules, frameworks)
5. Identify metrics and data points
6. For EACH identified entity/concept:
   a. Check if a wiki page already exists (search index.md)
   b. If exists: read the existing page, MERGE new information (don't overwrite),
      note contradictions, update the `updated` date and `sources` list
   c. If new: create a new page following the standard format (frontmatter + content)
   d. Add `[[wiki-links]]` to related pages in both directions
7. Update `memory/wiki/index.md` — add new pages, update summaries
8. Append entry to `memory/wiki/log.md` with date, source, pages touched
9. Commit: `git add memory/wiki/ && git commit -m "wiki: ingest <source-name>"`

## Rules
- NEVER modify files in `knowledge/` — raw sources are immutable
- ALWAYS read existing pages before updating — merge, don't replace
- ALWAYS add cross-references in both directions (if A links B, B should link A)
- ALWAYS use `[[slug]]` format for wiki links (not markdown links)
- Page slugs are kebab-case, matching the filename without .md
- Frontmatter is mandatory on every page (title, type, category, updated, sources, tags)
- Flag contradictions explicitly — don't silently pick one version
- Keep pages focused — one entity or concept per page, not mega-pages
```

## 3.2 wiki-query skill

```markdown
---
name: wiki-query
description: Answer questions by searching the wiki, synthesizing from multiple pages, citing sources with [[wiki-links]]
---

# Wiki Query

## When to use
When the user asks a domain question that the wiki might contain knowledge about.

## Steps

1. Read `memory/wiki/index.md` to find relevant pages
2. Read each relevant page (typically 2-5 pages)
3. Synthesize an answer that draws from multiple pages
4. Cite sources using `[[wiki-link]]` format
5. If the answer is substantial (draws from 3+ pages, produces new insight):
   create a new synthesis page in `memory/wiki/synthesis/` and update index
6. If the answer reveals a gap (no wiki page covers this topic):
   note the gap for future ingestion

## Rules
- ALWAYS read index.md first — don't guess which pages exist
- ALWAYS cite which wiki pages informed the answer
- NEVER fabricate wiki content — if the wiki doesn't cover it, say so
- Good synthesis answers should be filed back as synthesis pages
- Synthesis pages get their own frontmatter with `type: synthesis`

## Output format
Answer with `[[wiki-link]]` citations inline. Example:
"Leave encashment is processed during the [[payroll-cycle]] at the end of Q4.
The [[leave-policy]] allows encashment of up to 5 unused earned leave days.
See [[compliance-requirements]] for tax implications."
```

## 3.3 wiki-lint skill

```markdown
---
name: wiki-lint
description: Health-check the wiki — find orphans, broken links, stale content, contradictions, and gaps
---

# Wiki Lint

## When to use
Periodically (can be scheduled via the scheduler), or when explicitly asked
to check wiki health.

## Steps

1. Read ALL pages in `memory/wiki/` (entities/, concepts/, synthesis/)
2. Parse all `[[wiki-links]]` from every page
3. Check for:
   - **Orphan pages**: pages with zero inbound links from other pages
   - **Broken links**: `[[slug]]` references to pages that don't exist
   - **Missing backlinks**: if A links B, does B link back to A?
   - **Stale content**: pages whose source documents have been updated since
     the page was last modified
   - **Contradictions**: claims on one page that conflict with claims on another
   - **Gaps**: entities or concepts mentioned in text but lacking their own page
4. Generate a lint report
5. For fixable issues (broken links, missing backlinks), fix them automatically
6. For judgment calls (contradictions, gaps), list them for human review
7. Append lint results to `memory/wiki/log.md`
8. Commit fixes: `git add memory/wiki/ && git commit -m "wiki: lint pass"`

## Output format
Lint report with sections: Orphans, Broken Links, Stale Pages, Contradictions, Gaps.
Each item should include the affected page and a suggested action.
```


# ═══════════════════════════════════════════════════════════════════════════════
# PART 4: INTEGRATION WITH THE APP
# ═══════════════════════════════════════════════════════════════════════════════

## 4.1 Auto-ingest from task outputs

After any substantive agent task (not simple Q&A), the server should trigger wiki
ingestion on the task output. This is how the wiki grows automatically from usage.

```typescript
// In your chat route, after query() completes:
const taskOutput = collectedMessages
  .filter(m => m.type === "assistant")
  .map(m => m.content)
  .join("\n");

// If the output is substantial enough, auto-ingest
if (taskOutput.length > 500 && isSubstantiveTask(journeyId)) {
  // Fire and forget — don't block the user's response
  query({
    prompt: `Ingest this task output into the wiki. Extract any reusable knowledge
             (entities, concepts, metrics, patterns, edge cases).
             Task output:\n${taskOutput}`,
    dir: "./agent",
    maxTurns: 10,
  }).then(async (stream) => {
    for await (const _ of stream) {} // drain
  }).catch(console.error);
}
```

## 4.2 Wiki query in the chat flow

The wiki-query skill is discovered automatically by the agent (via task_tracker
skill matching). When a user asks a domain question, the agent will find and use
the wiki-query skill, search the wiki, and cite pages in its response.

You do NOT need to route wiki queries explicitly. The agent handles it.

However, you SHOULD inject wiki awareness into the systemPromptSuffix:

```typescript
const wikiContext = await getWikiSummary("./agent/memory/wiki");
// Returns: "Wiki contains 28 pages: 8 entities, 15 concepts, 5 syntheses.
//           Last updated: 2026-04-12. Recent: leave-policy, payroll-cycle."

systemPromptSuffix += `\n\n${wikiContext}`;
```

## 4.3 Scheduled lint

Add a schedule in `agent/schedules/wiki-lint.yaml`:

```yaml
id: wiki-lint
prompt: "Run wiki-lint to health-check the wiki. Fix what you can automatically. Report what needs human review."
cron: "0 2 * * 0"    # Every Sunday at 2 AM
mode: repeat
enabled: true
```

## 4.4 API routes for the frontend

```typescript
// GET /api/wiki/pages — list all wiki pages with metadata
app.get("/api/wiki/pages", async (req, res) => {
  const pages = await listWikiPages("./agent/memory/wiki");
  res.json(pages);
});

// GET /api/wiki/page/:slug — read a specific wiki page
app.get("/api/wiki/page/:slug", async (req, res) => {
  const content = await readWikiPage("./agent/memory/wiki", req.params.slug);
  res.json(content);
});

// GET /api/wiki/graph — build node-edge graph from pages and [[links]]
app.get("/api/wiki/graph", async (req, res) => {
  const graph = await buildWikiGraph("./agent/memory/wiki");
  // Returns: { nodes: [{id, title, type, category}], edges: [{source, target}] }
  res.json(graph);
});

// POST /api/wiki/chat/stream — stream a wiki-powered Q&A session
app.post("/api/wiki/chat/stream", async (req, res) => {
  const { question } = req.body;
  const result = query({
    prompt: `Use wiki-query to answer: ${question}`,
    dir: "./agent",
  });
  // Stream SSE...
});

// POST /api/wiki/ingest — manually trigger ingestion of a document
app.post("/api/wiki/ingest", async (req, res) => {
  const { sourcePath } = req.body;
  const result = query({
    prompt: `Ingest this document into the wiki: ${sourcePath}`,
    dir: "./agent",
  });
  // Stream or await...
});

// POST /api/wiki/lint — trigger a lint pass
app.post("/api/wiki/lint", async (req, res) => {
  const result = query({
    prompt: "Run wiki-lint. Fix automatic issues. Report manual ones.",
    dir: "./agent",
  });
  // Stream or await...
});
```

## 4.5 Frontend: The Wiki Page (/wiki)

The wiki page is a three-panel layout: graph (center), wiki agent chat
(right), and optionally a page viewer (overlay on the graph).

### 4.5.1 Full page layout

```
┌──────────────────────────────────────────┬──────────────────────────┐
│  My Wiki                                 │  Wiki Agent              │
│  Organisation-wide compiled knowledge    │  LLM-powered synthesis   │
│                                          │  across the knowledge    │
│  [My Wiki] [Org Wiki]                    │  graph.                  │
│                                          │                          │
│  ● Entity (12)  ● Concept (16)  ○ System │  "Ask a question and the │
│  33 pages / 192 links                    │  agent will read relevant│
│                                          │  wiki pages, synthesize  │
│  ┌────────────────────────────────────┐  │  across them, and stream │
│  │                                    │  │  its analysis."          │
│  │       D3.js Force-Directed Graph   │  │                          │
│  │                                    │  │  ┌────────────────────┐  │
│  │    ●           ●                   │  │  │ Which campaign     │  │
│  │      ●     ●       ●              │  │  │ worked best?       │  │
│  │         ●        ●                 │  │  ├────────────────────┤  │
│  │    ●        ●     ●    ●          │  │  │ What patterns are  │  │
│  │       ●         ●                  │  │  │ emerging?          │  │
│  │              ●        ●           │  │  ├────────────────────┤  │
│  │    ●     ●                         │  │  │ Youth segment vs   │  │
│  │         ●   ●    ●                │  │  │ channels           │  │
│  │                                    │  │  ├────────────────────┤  │
│  └────────────────────────────────────┘  │  │ Run wiki health    │  │
│                                          │  │ check              │  │
│                                          │  └────────────────────┘  │
│                                          │                          │
│                                          │  [Ask the wiki agent...] │
│                                          │  [Health check] [Clear]  │
└──────────────────────────────────────────┴──────────────────────────┘
```

### 4.5.2 The D3.js knowledge graph

**Node types and colors:**
- Entity nodes — teal (e.g., "Audience Segments", "BT Group Context")
- Concept nodes — purple (e.g., "Segmentation Methodology", "NBA Logic")
- System nodes — gray (e.g., "Wiki Index", "Wiki Log")
- Synthesis nodes — yellow/gold (agent-generated cross-references)

**Graph behavior:**
- Force-directed simulation with zoom, pan, and drag
- Nodes are labeled with their page title
- Edges represent [[wiki-link]] connections between pages
- Node size can scale with inbound link count (more linked = larger)
- Stats badge in top-left: "33 pages / 192 links"

**Node click → page viewer overlay:**
When a user clicks a node, an overlay panel appears on top of the graph:
```
┌──────────────────────────────────────┐
│  CONCEPT   6 / 33     < > X         │
│  Churn Prediction Model              │
│  Updated: 2026-03-15                 │
│                                      │
│  churn  prediction  retention  model │
│                                      │
│  # Churn Prediction Model            │
│                                      │
│  Propensity model used for retention │
│  campaign targeting. Referenced by   │
│  [[nba-logic]], [[segments]], and    │
│  [[campaign-learnings]].             │
│                                      │
│  ## Model Overview                   │
│  - Gradient boosted tree model       │
│    updated monthly                   │
│  - Input features: usage patterns,   │
│    billing history, complaint stage  │
│  - Output: churn probability 0-100   │
│  ...                                 │
└──────────────────────────────────────┘
```

This overlay shows:
- Type badge (ENTITY / CONCEPT / SYNTHESIS) with page number (6/33)
- Navigation arrows (< >) to browse through all pages
- Close button (X)
- Page title, updated date, tags as chips
- Full page content rendered as markdown
- [[wiki-links]] in the content are clickable — clicking one navigates
  to that node in the graph and opens its viewer

### 4.5.3 The wiki agent chat (right panel)

**Idle state:**
- Title: "Wiki Agent"
- Subtitle: "LLM-powered synthesis across the knowledge graph."
- Description text explaining what it does
- Note: "Valuable answers are written back to the wiki."
- Pre-built question nudges (4 tappable cards with domain questions)
- Input bar: "Ask the wiki agent..." + Send button
- Action buttons: "Health check" (triggers wiki-lint), "Clear chat"

**Active state (query in progress):**
When the user asks a question, the right panel shows:

```
┌──────────────────────────────────────┐
│  Wiki Agent                          │
│                                      │
│  ┌ User question (highlighted bg) ┐  │
│  │ How does youth segment          │  │
│  │ performance compare across      │  │
│  │ channels?                       │  │
│  └─────────────────────────────────┘  │
│                                      │
│  ● Wiki Agent session: ee-companion  │
│                                      │
│  AGENT ACTIVITY                      │
│  • Loading skill: wiki-query         │
│    agents/.../skills/wiki-query/...  │
│  • Discovered 33 wiki files          │
│  • Reading: synthesis-how-does-...   │
│    synthesis/synthesis-how-does-...  │
│  • Reading: Segmentation Methodology │
│    concepts/segmentation-method...   │
│  • Reading: Audience Segments        │
│    entities/segments.md              │
│  • Reading: Audience Segments Deep   │
│    concepts/audience-segments-...    │
│  • Reading: Channel Performance      │
│    concepts/channel-performance.md   │
│  • Reading: Wiki Log                 │
│    log.md                            │
│  • Synthesising response             │
│                                      │
│  (streaming response appears here)   │
└──────────────────────────────────────┘
```

The AGENT ACTIVITY section shows each wiki page the agent reads, with
the file path as a subtitle. This is generated from the GitClaw stream
events — each read() on a wiki file becomes an activity entry.

**CRITICAL: Graph highlighting during query**

As the agent reads wiki pages, the corresponding nodes in the D3 graph
should highlight in real-time:

1. When the agent reads a page → that node in the graph grows slightly
   larger, gets a glowing border, and its color intensifies
2. The legend updates to show "Referenced (N)" as a new color category
3. Nodes that were NOT referenced become slightly faded (reduced opacity)
4. This creates a visual "spotlight" effect showing exactly which parts
   of the knowledge graph the agent is drawing from

After the query completes, a "Clear highlights" link appears in the
top-right of the graph area to reset the visual state.

### 4.5.4 Response + post-query actions

After the agent streams its response (with [[wiki-link]] citations inline),
the right panel shows two additional sections:

**PAGES IMPROVED section:**
When the agent updates existing wiki pages (via wiki-ingest after a good
query), list each updated page:

```
PAGES IMPROVED
● synthesis-how-does-youth-segment
  "I'll query the wiki to analyze youth segment
  performance across different channels..."
● segmentation-methodology
  # Segmentation Methodology
● segments
  Core segment definitions used across...
● audience-segments
  # Audience Segments Deep Dive
● channel-performance
  # Channel Performance
● log
  ## 2026-04-08 - Updated [[performance-benchmarks]]...
```

Each page entry shows: green dot (updated), page slug as link, preview
of the page content or what changed.

**SOURCES CITED section:**
Shows which wiki pages informed the answer as clickable [[wiki-link]] chips:

```
SOURCES CITED
  [[segmentation-methodology]]  [[audience-segments]]
  [[channel-performance]]       [[nba-logic]]
```

Clicking a chip highlights that node in the graph and opens its viewer.

**NEW PAGE CREATED section (if applicable):**
When the agent creates a new synthesis page:

```
NEW PAGE CREATED
● synthesis-how-does-youth-segment
  Synthesis written back to the knowledge graph.
```

### 4.5.5 My Wiki vs. Org Wiki tabs

The wiki page has two tabs:
- **My Wiki** — personal wiki pages (per-user, if multi-tenancy is enabled)
- **Org Wiki** — organisation-wide compiled knowledge (shared)

In single-tenant mode, only Org Wiki is relevant. The tab structure exists
to support future multi-tenancy.

### 4.5.6 Wiki page component checklist

- [ ] WikiPage — three-panel layout (graph + chat + optional page viewer)
- [ ] WikiGraph — D3.js force-directed graph with zoom, pan, drag
- [ ] WikiGraphLegend — type legend with counts + "Referenced (N)" dynamic
- [ ] WikiNodeViewer — overlay panel for viewing a wiki page (click on node)
- [ ] WikiAgentPanel — right panel with chat, nudges, activity, results
- [ ] WikiAgentActivity — pipeline showing which pages the agent is reading
- [ ] WikiHighlighter — manages graph node highlighting during queries
- [ ] PagesImprovedList — shows pages updated after a query
- [ ] SourcesCitedChips — clickable [[wiki-link]] chips
- [ ] NewPageCreated — notification for newly created synthesis pages
- [ ] WikiNudges — pre-built question cards
- [ ] WikiInput — input bar with Send, Health check, Clear chat buttons

## 4.6 Frontend: Knowledge Base page (/knowledge-base)

This is a separate page (part of the BUILD section in the sidebar) that
shows raw source documents:

- Lists all documents in knowledge/docs/
- For each: name, type icon, size, date added
- Shows which wiki pages reference each source (link count)
- Upload interface (drag-and-drop or file picker)
- Upload triggers auto-ingest into the wiki
- Documents are immutable — can be replaced but not edited in place

## 4.7 Frontend: Sources/Inspector page (/sources) — optional

Power-user file explorer for the agent directory:
- Tree-view sidebar with expandable directories
- Line-numbered code viewer with syntax-aware styling
- Shows memory files, skill definitions, workflow configs
- Raw view of wiki pages with frontmatter visible


# ═══════════════════════════════════════════════════════════════════════════════
# PART 5: IMPLEMENTATION RULES
# ═══════════════════════════════════════════════════════════════════════════════

## 5.1 The wiki lives in the agent repo, NOT in a database

- Wiki pages are markdown files in `agent/memory/wiki/`
- They are git-committed (just like GitClaw memory)
- They are readable by the agent via the `read` built-in tool
- They are writable by the agent via the `write` built-in tool
- DO NOT store wiki content in PostgreSQL, SQLite, or any database
- DO NOT build a separate wiki service or API — the agent IS the wiki engine
- The only database involvement is the knowledge table for org-level reference
  data that the frontend displays on the Knowledge Base page

## 5.2 The agent maintains the wiki, NOT your code

- The three skills (ingest, query, lint) are SKILL.md files in the agent repo
- The agent discovers and uses them via task_tracker (standard GitClaw pattern)
- Your application code NEVER reads or writes wiki pages directly
- Your application code NEVER parses wiki pages to extract knowledge
- Your application code ONLY:
  - Triggers `query()` with prompts that invoke wiki skills
  - Reads wiki files for the FRONTEND DISPLAY (listing pages, building graph)
  - Provides API routes that serve wiki content to the UI

## 5.3 Wiki links use [[slug]] format

- Internal references use `[[slug]]` wikilink format
- Slug = filename without .md extension, kebab-case
- Example: `[[leave-policy]]` links to `memory/wiki/concepts/leave-policy.md`
- Links should be bidirectional — if A references B, B should reference A
- The frontend graph is built by parsing `[[...]]` patterns from all pages

## 5.4 Raw sources are immutable

- Files in `knowledge/docs/` are NEVER modified by the agent
- They are the source of truth that wiki pages compile from
- When a source is updated (new version uploaded), the agent re-ingests it
  and updates the wiki pages that reference it
- The wiki page's `sources` frontmatter field tracks which raw sources it compiled from

## 5.5 Auto-ingest from agent interactions

- After any substantive task completion, trigger wiki ingestion on the output
- This is how the wiki grows from usage — not just from document uploads
- "Substantive" = task involved tools, produced structured output, resolved
  something non-trivial. Skip simple greetings or one-line answers.
- Auto-ingest is fire-and-forget — don't block the user's response

## 5.6 Frontmatter is mandatory

Every wiki page MUST have YAML frontmatter with at minimum:
- `title` — human-readable page title
- `type` — entity | concept | synthesis | source-summary
- `category` — domain-specific (hr-policies, payroll, compliance, etc.)
- `updated` — ISO date of last modification
- `sources` — list of raw source paths this page was compiled from
- `tags` — searchable tags

## 5.7 Scaffold on project init

When setting up a new AgenticOS project, create the wiki structure and skills:

```bash
# Create wiki directory structure
mkdir -p agent/memory/wiki/entities
mkdir -p agent/memory/wiki/concepts
mkdir -p agent/memory/wiki/synthesis

# Create initial index.md
cat > agent/memory/wiki/index.md << 'EOF'
# Wiki Index

Last updated: (not yet populated)
Total pages: 0

## Entities
(none yet)

## Concepts
(none yet)

## Synthesis
(none yet)
EOF

# Create initial log.md
cat > agent/memory/wiki/log.md << 'EOF'
# Wiki Log
EOF

# Create the three wiki skills
# (see Part 3 for full SKILL.md content for each)
mkdir -p agent/skills/wiki-ingest
mkdir -p agent/skills/wiki-query
mkdir -p agent/skills/wiki-lint

# Commit
cd agent && git add memory/wiki/ skills/wiki-* && git commit -m "scaffold wiki system"
```

## 5.8 Confirming the pattern (based on prior EE implementation)

The EE Campaign Companion implementation established the correct pattern:

- Three-skill architecture (ingest, query, lint) ✓
- Wiki pages as markdown files with YAML frontmatter ✓
- `[[wiki-link]]` cross-references ✓
- index.md as master catalog ✓
- log.md as chronological audit trail ✓
- D3.js graph visualization on the frontend ✓
- Auto-ingest from task outputs ✓
- Synthesis pages filed back from good query answers ✓
- Agent uses built-in `read`/`write` tools for all wiki file operations ✓
- Wiki operations triggered through `query()` like any other agent task ✓

**The only things to verify on each new build:**
- Skills have proper GitAgent frontmatter (`name` + `description` in YAML)
- Wiki directory is inside the agent repo where `read`/`write` can reach it
- No wiki content manipulation logic is duplicated in server.ts or config.ts
  (the skills handle all wiki logic — app code only triggers `query()` and
  serves files to the frontend for display)

## 5.9 Validation

After implementing, verify:

```bash
# Wiki directory exists with structure
ls agent/memory/wiki/index.md agent/memory/wiki/log.md

# Wiki skills exist
ls agent/skills/wiki-ingest/SKILL.md
ls agent/skills/wiki-query/SKILL.md
ls agent/skills/wiki-lint/SKILL.md

# Skills have valid frontmatter
grep "^name:" agent/skills/wiki-*/SKILL.md

# No wiki logic in application code (should be in skills only)
grep -rn "wiki" --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v agent/ | grep -v ".md"
# Should only show API routes and frontend helpers, NOT wiki content manipulation

# Agent can discover wiki skills
npx gitagent validate -d ./agent
```
