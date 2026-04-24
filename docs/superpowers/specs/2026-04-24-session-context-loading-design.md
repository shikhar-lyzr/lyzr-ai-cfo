# Session Context Loading — Design

**Date:** 2026-04-24
**Status:** Approved (ready for implementation plan)
**Scope:** Minimize per-session context overhead for Claude by making CLAUDE.md the index, restoring `gitclaw.md` at root, patching the README for newly-shipped work, and refreshing the auto-memory project snapshot. No new "handoff" artifact.

## Goal

Every time Claude opens this repo, it should get to productive work with minimal tool-calls. Today, `CLAUDE.md` is two lines and `gitclaw.md` is missing, so Claude re-derives project state from file exploration each session. This spec lands a small, lifecycle-aware set of documents that load context cheaply.

## Design philosophy

Different documents have different lifecycles. Treat them accordingly:

- **`CLAUDE.md`** — auto-loaded every turn, costs tokens. Index + directives only. Changes when doc categories move.
- **`README.md`** — public-facing deep dive. Read on demand when the task needs it. Changes when major features ship.
- **`gitclaw.md`** — SDK reference at root. Read on demand when touching agent code. Changes when the SDK upgrades.
- **Memory (`~/.claude/.../memory/`)** — cross-session facts and feedback. Read when relevant or when user references past context. Changes as understanding evolves.

This avoids a fourth "handoff" artifact that would duplicate content across three lifecycles.

## Non-goals

- No separate "session log" or "handoff" file. Memory + git log already do this job.
- No full README rewrite. Only stale sections get patched.
- No diagrams or architecture changes. Capital is "just another journey" at the architectural abstraction the README already documents.
- No new top-level docs or folders.
- No auto-loading of README or gitclaw.md into context each session — they are read on demand.

## Scoping decisions (captured from brainstorm)

- **Handoff mechanism:** No separate artifact. CLAUDE.md + README + memory jointly serve as the handoff.
- **CLAUDE.md shape:** Hybrid — directives that override defaults, a reading map (pointers to authoritative docs), and a state snapshot updated at major-feature cadence.
- **gitclaw.md restoration:** Re-create at project root and commit. Not `node_modules`-dependent, not compressed into memory. The file is the reference.

## Deliverables

### 1. `CLAUDE.md` restructured

Replaces the current 2-line file (`@AGENTS.md` only) with three regions: directives, reading map, state snapshot.

```markdown
# Project: Lyzr AI CFO — AgenticOS

<!-- DIRECTIVES (priority over defaults) -->
@AGENTS.md

Stack: Next.js 16 App Router + Prisma + Neon Postgres + gitclaw SDK.
Shell: bash (Unix syntax, forward slashes, `/dev/null` not `NUL`).
Tests: `npx vitest run` (integration tests hit live Neon; ~60s full run).

<!-- READING MAP -->
## Where things live

- Architecture + routes + data model → `README.md`
- gitclaw SDK (agent engine we build on) → `gitclaw.md` (root)
- Current work history → `docs/superpowers/specs/` (brainstormed designs)
  and `docs/superpowers/plans/` (executed implementation plans)
- Audit reports → `docs/audits/`
- Project facts across sessions → your auto-memory (`MEMORY.md` index)

## When you need to …

- Understand a feature → its spec + plan under `docs/superpowers/`
- Write code that touches the agent → `README.md` "Agent System" + `gitclaw.md`
- Add a new CSV shape → look at `lib/csv/detect-shape.ts` + `lib/csv/utils.ts`
  + any existing parser
- Add a new journey page → copy the monthly-close pattern
  (page.tsx + period-picker.tsx + explain-button.tsx + journey-context builder)

<!-- STATE SNAPSHOT (update when major features ship) -->
## Current state (as of 2026-04-24)

- **Domain journeys with real data:** monthly-close, financial-reconciliation,
  regulatory-capital.
- **Placeholder journeys (static mock):** ifrs9-ecl, daily-liquidity,
  regulatory-returns.
- **CSV parsers:** 55/56 variants pass the robustness audit. The one PARTIAL
  is the AR accounting-parens case — intentional (invoices can't be negative).
- **Last major merge:** `b31e8e7` (regulatory-capital flow + CSV robustness,
  2026-04-24).
```

**Rationale per region:**
- The `@AGENTS.md` reference is preserved (it carries the "this is not standard Next.js" override).
- Stack + shell + tests lines prevent Claude from re-discovering these per session.
- The reading map tells Claude where to go for details, rather than inlining details (cheap).
- The state snapshot answers "what's real vs placeholder" — a question that comes up often when the user references a journey.

**Ordering is deliberate:** Directives first (override behavior), then reading map (tell Claude where to look), then state snapshot (answer common questions). A reader scanning top-down gets the highest-priority content first. The snapshot is last because it's the most volatile — putting it at the end keeps the stable regions at the top stable.

### 2. `gitclaw.md` restored at root

Re-create verbatim the 1178-line gitclaw SDK documentation that was present earlier in the session. Content covers:

- Quick Start / Installation / CLI Reference
- Agent Configuration (`agent.yaml` schema)
- Models & Providers (including Lyzr integration specifics)
- Voice Mode / Web UI
- Built-in Tools / Skills / Workflows / Hooks / Plugins
- Memory System / Schedules & Cron / Integrations
- Compliance & Audit
- SDK (Programmatic Usage) — `query()`, `tool()`, `buildTool()`, hooks, context compaction, cost tracking
- Security / Directory Structure / Environment Variables

Commit as a tracked file. Not gitignored. The prior copy was untracked (hence lost during merge cleanup).

### 3. `README.md` patches

Three targeted edits. No other sections touched.

**Patch A — add "Data-driven" column to the journeys table in "What Is It?"**

Currently the table lists three surfaces (Run / Build / Observe). The Run row names all six journeys as equivalent. Add a second table (or expand the first) with a per-journey "Has real data?" column:

| Journey | Route | Has real data? |
|---|---|---|
| Monthly Close | `/monthly-close` | ✓ |
| Financial Reconciliation | `/financial-reconciliation` | ✓ |
| Regulatory Capital | `/regulatory-capital` | ✓ |
| IFRS 9 ECL | `/ifrs9-ecl` | — (placeholder) |
| Daily Liquidity | `/daily-liquidity` | — (placeholder) |
| Regulatory Returns | `/regulatory-returns` | — (placeholder) |

**Patch B — add "Regulatory Capital" subsection under "CSV Ingestion"**

After the existing variance/AR/GL/sub-ledger/FX parser descriptions, add:

```markdown
### Regulatory Capital parsers

Two shapes, auto-detected by `lib/csv/detect-shape.ts`:

- **`capital_components`** — headers include `period`, `component`, `amount`
  (optionally `currency`). Component values: `cet1_capital`,
  `additional_tier1`, `tier2`, `goodwill`, `dta`, `other_deduction`,
  `total_rwa`. Unknown components fall to `other_deduction` with a
  skipped-row note.
- **`rwa_breakdown`** — headers include `period`, `risk_type`,
  `exposure_class`, `exposure_amount`, `risk_weight`, `rwa`. Risk type is
  `credit` / `market` / `operational`. Risk weight accepts `0.5` or `50%`.

Uploads route through `/api/upload` → `lib/capital/persist.ts` →
`prisma.$transaction` wrapping `DataSource` + row create + status="ready"
update → snapshot recompute. The snapshot stores the ratios (`cet1Ratio`,
`tier1Ratio`, `totalRatio`) plus capital amounts and `totalRwa`, derived
from `lib/capital/stats.ts`'s pure `computeSnapshot(components, rwaLines)`.
Minimums live in `lib/capital/minimums.ts` (Basel III Pillar 1) with an
`effectiveMinimum()` indirection that C-phase buffer logic can extend
without changing callers.

Full spec:
`docs/superpowers/specs/2026-04-23-regulatory-capital-flow-design.md`.
Full plan:
`docs/superpowers/plans/2026-04-23-regulatory-capital-flow.md`.
```

**Patch C — add "CSV robustness" note to the CSV Ingestion section**

Placement: at the end of the CSV Ingestion section, after Patch B lands.

```markdown
### CSV robustness

All five parsers (variance, AR, GL, sub-ledger, FX) plus the new capital
parsers share `lib/csv/utils.ts` helpers for header matching, amount
parsing (thousands separators, accounting parens for negatives, currency
prefixes), and date parsing (ISO, US, EU, named-month).

Regression guard: `scripts/audit-csv-parsers.ts` exercises each parser
against 12 header/content mutations and emits
`docs/audits/2026-04-23-csv-format-robustness.md`. A round-trip test in
`tests/csv/parser-robustness.test.ts` runs the audit and asserts the
outcome distribution.

Current status: **55/56** applicable (shape, variant) pairs pass. The one
PARTIAL is AR against the accounting-parens variant — intentional: an AR
invoice amount cannot be negative.
```

### 4. Memory refresh

Two small updates. No new files.

**Update A — `project_lyzr_cfo_demo.md`** (existing):

Replace the body with a current-state summary:

```markdown
Lyzr AI CFO demo project — agent-first AgenticOS shell.

**Live journeys (real data):**
- monthly-close, financial-reconciliation, regulatory-capital.

**Placeholder journeys (static mock):**
- ifrs9-ecl, daily-liquidity, regulatory-returns.

**Agent:** gitclaw SDK (`@/lib/agent`), `buildContext` → journey-context →
`query()`. Journey-context builders live under
`lib/agent/journey-context/` and each feeds a markdown block into the
agent's system-prompt suffix.

**CSV:** 55/56 on robustness audit. Shared utils at `lib/csv/utils.ts`.

**Last major merge:** `b31e8e7` on main (2026-04-24) — regulatory-capital
flow + CSV robustness fixes land together.
```

**Update B — `MEMORY.md` index line:**

Refresh the pointer description:

```
- [Lyzr AI CFO demo project state](project_lyzr_cfo_demo.md) — three
  journeys live (close/recon/capital), three placeholders, gitclaw-based
  agent, CSV 55/56
```

## Files touched or created

**Created:**
- `gitclaw.md` (root) — ~1178 lines restored SDK documentation

**Modified:**
- `CLAUDE.md` — restructured from 2 lines to ~40 lines (directives + map + state)
- `README.md` — three targeted patches (journeys table, capital subsection, robustness note)
- `~/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/project_lyzr_cfo_demo.md` — current-state summary
- `~/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/MEMORY.md` — refreshed index line

**Commits:** three, landed separately for reviewability:
1. `docs: restore gitclaw.md at project root`
2. `docs: restructure CLAUDE.md as hybrid directives + map + state snapshot`
3. `docs(readme): document regulatory-capital flow + CSV robustness`

Memory updates do not go into git (they live in the user's `~/.claude/` directory).

## Risks & open questions

- **State snapshot staleness.** The "Current state" section of CLAUDE.md will drift if not updated when new features ship. Mitigation: this doc itself serves as the reminder; when a major feature ships, update CLAUDE.md's snapshot + the memory project file. No automated enforcement.
- **gitclaw.md version skew.** If the gitclaw SDK updates, this file will fall behind. Acceptable: the SDK's real docs live in its repo; this is a committed snapshot for offline reference. Refresh manually when upgrading.
- **Reading map drift.** If doc folders move (e.g., `docs/superpowers/` → `docs/`), CLAUDE.md's reading map needs an edit. Low cost, but worth noting. No automated enforcement.
