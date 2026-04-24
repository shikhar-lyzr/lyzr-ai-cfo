# Session Context Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CLAUDE.md` an index, restore `gitclaw.md` at project root, patch the README for newly-shipped work, and refresh the auto-memory project snapshot — so Claude gets to productive work each session with minimal tool-calls.

**Architecture:** Four parallel documentation edits, each a small independent commit. No code changes. No tests (docs-only). Files are touched with `Write`/`Edit`, not generated.

**Tech Stack:** Markdown. Git.

**Spec:** [docs/superpowers/specs/2026-04-24-session-context-loading-design.md](../specs/2026-04-24-session-context-loading-design.md)

---

## File structure overview

**Created:**
- `gitclaw.md` (project root) — copied from `node_modules/gitclaw/README.md`

**Modified:**
- `CLAUDE.md` — full rewrite (2 lines → ~40 lines)
- `README.md` — three targeted patches (journeys table, capital subsection, robustness note)
- `C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/project_lyzr_cfo_demo.md` — body replaced with current-state summary
- `C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/MEMORY.md` — one index line refreshed

**Four commits** — one per task (memory updates land as two files in their own commit, outside the repo).

---

## Scope note vs. spec

The spec said "restore `gitclaw.md` verbatim to 1178 lines." In practice the authoritative source for the SDK docs is `node_modules/gitclaw/README.md` (~645 lines). Task 1 uses that as the source of truth. The committed `gitclaw.md` therefore tracks the vendor's docs and can be refreshed with a simple copy after any `npm install` that upgrades gitclaw. This is strictly better than reconstructing from memory (which risks staleness) or maintaining a custom superset.

---

## Task 1: Restore `gitclaw.md` at project root

**Files:**
- Create: `gitclaw.md` (copy of `node_modules/gitclaw/README.md`)

**Rationale:** The canonical SDK reference was present at root earlier but is untracked and got removed. Committing it means `git clone` gets it without requiring `node_modules`.

- [ ] **Step 1: Copy the file**

Run:

```bash
cp node_modules/gitclaw/README.md gitclaw.md
```

Expected: no output, exit code 0. File appears at repo root.

- [ ] **Step 2: Verify the copy**

Run:

```bash
head -5 gitclaw.md && echo "---" && wc -l gitclaw.md
```

Expected output:
- First 5 lines start with `<p align="center">` / logo image reference.
- Line count ~645 lines (check that the file is the full vendor README, not truncated).

- [ ] **Step 3: Commit**

```bash
git add gitclaw.md
git commit -m "$(cat <<'EOF'
docs: restore gitclaw.md at project root from node_modules

The gitclaw SDK reference was untracked at root and removed during
an earlier merge cleanup. Copying the vendor's authoritative README
from node_modules gives us a committed reference that survives clean
checkouts and does not require node_modules to be present. Refresh
by re-running `cp node_modules/gitclaw/README.md gitclaw.md` after
a gitclaw upgrade.
EOF
)"
```

Expected: one commit on current branch, one file changed.

- [ ] **Step 4: Verify**

Run:

```bash
git log --oneline -1 && git show --stat HEAD
```

Expected: top commit message matches; stat shows `gitclaw.md` with ~645 insertions.

---

## Task 2: Restructure `CLAUDE.md` as index + directives + state snapshot

**Files:**
- Modify (full rewrite): `CLAUDE.md`

The existing file is two lines (`@AGENTS.md`). Replace with three regions: directives, reading map, state snapshot. Ordering is deliberate — directives first (override behavior), reading map next (tell Claude where to look), state snapshot last (the most volatile region sits where it can be replaced without touching the stable regions above).

- [ ] **Step 1: Replace the entire contents of `CLAUDE.md`**

Write this exact content:

````markdown
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
````

- [ ] **Step 2: Verify the @AGENTS.md reference resolves**

Run:

```bash
head -5 CLAUDE.md && echo "---" && cat AGENTS.md
```

Expected output:
- CLAUDE.md top region includes `@AGENTS.md`.
- AGENTS.md prints the existing "this is NOT the Next.js you know" warning.
- Confirms the `@`-reference still points at a real file.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: restructure CLAUDE.md as index + directives + state snapshot

CLAUDE.md is auto-loaded every turn, so it should be an index, not a
library. Three regions: (1) directives that override default behavior,
preserving @AGENTS.md and adding stack/shell/tests one-liners; (2) a
reading map pointing at README, gitclaw.md, specs/plans/audits, and
memory; (3) a current-state snapshot showing which journeys have real
data vs. static mocks. Update the snapshot when major features ship;
the other regions rarely change.
EOF
)"
```

- [ ] **Step 4: Verify**

Run:

```bash
git log --oneline -1 && git show --stat HEAD
```

Expected: top commit message matches; stat shows `CLAUDE.md` with +~40 lines and -2 lines.

---

## Task 3: README patches — journeys table, capital subsection, robustness note

**Files:**
- Modify: `README.md` (three edits in different sections)

These are three distinct edits in different sections of the same file. All three land in one commit because they're tightly related (the capital subsection references the journeys table; the robustness note references the capital subsection). Each edit is small and targeted — no section rewrites.

- [ ] **Step 1: Read the current README to locate exact edit targets**

Run:

```bash
grep -n "^##\|^###" README.md | head -40
```

This prints the README's section structure. You'll use the section headings to locate where each patch goes:
- **Patch A** goes into the "What Is It?" section (line ~27), at the bottom of that section before the closing `---`.
- **Patch B** goes into the "CSV Ingestion" section. Locate it with `grep -n "^## CSV Ingestion\|^### " README.md`. Patch B is a new subsection added after the existing variance/AR/GL/sub-ledger/FX parser subsections.
- **Patch C** goes at the very end of the "CSV Ingestion" section (after Patch B lands).

- [ ] **Step 2: Apply Patch A — Data-driven column on journeys table**

In the "What Is It?" section, there's an existing `Surface` / `Purpose` / `Routes` table where the Run row lists the six journeys flat. Append this new table AFTER the existing surfaces table and BEFORE the closing `---` that ends the "What Is It?" section.

Use the Edit tool to insert the new content. Find the existing line (likely around line 37) that closes the section:

```markdown
Domain journeys (e.g. `/monthly-close`) are fully sample-data driven shells with a docked chat panel that seeds a journey-scoped prompt. They demonstrate the target UX without requiring every workflow to be wired into real data yet.
```

Replace the PARAGRAPH above with an updated version that links to the new table, then add the table:

```markdown
Domain journeys (e.g. `/monthly-close`) are either sample-data shells or real data-driven pages. The table below shows which is which today; the rest use a docked chat panel with seeded journey-scoped prompts to demonstrate the target UX.

| Journey | Route | Has real data? |
|---|---|---|
| Monthly Close | `/monthly-close` | ✓ |
| Financial Reconciliation | `/financial-reconciliation` | ✓ |
| Regulatory Capital | `/regulatory-capital` | ✓ |
| IFRS 9 ECL | `/ifrs9-ecl` | — (placeholder) |
| Daily Liquidity | `/daily-liquidity` | — (placeholder) |
| Regulatory Returns | `/regulatory-returns` | — (placeholder) |
```

- [ ] **Step 3: Apply Patch B — Regulatory Capital subsection under "CSV Ingestion"**

Find the end of the last existing parser subsection in the "CSV Ingestion" section (likely an FX-rates parser subsection). After it (and before the section ends — look for the next `## ` heading), insert this new subsection:

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

Full spec: `docs/superpowers/specs/2026-04-23-regulatory-capital-flow-design.md`.
Full plan: `docs/superpowers/plans/2026-04-23-regulatory-capital-flow.md`.
```

- [ ] **Step 4: Apply Patch C — CSV robustness note**

Still in the "CSV Ingestion" section, after the Patch B subsection you just added and before the next `## ` top-level heading, append this subsection:

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

- [ ] **Step 5: Verify all three patches landed**

Run:

```bash
grep -n "Has real data?\|Regulatory Capital parsers\|CSV robustness" README.md
```

Expected output: each of the three strings appears exactly once. If any returns zero matches, the corresponding patch did not land — re-apply it. If any returns more than one match, you inserted duplicates — resolve before committing.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): document regulatory-capital flow + CSV robustness

Three targeted edits:
- Add "Has real data?" column to the journeys table so readers see
  immediately which journeys are live vs. placeholder.
- Add "Regulatory Capital parsers" subsection under CSV Ingestion,
  documenting the two new shapes and pointing at the full spec/plan.
- Add "CSV robustness" note explaining the 55/56 audit status and
  the shared lib/csv/utils.ts helpers.
EOF
)"
```

- [ ] **Step 7: Verify**

Run:

```bash
git log --oneline -1 && git show --stat HEAD
```

Expected: top commit message matches; stat shows `README.md` modified (the diff should be additive — insertions only, no deletions beyond the single paragraph replaced in Patch A).

---

## Task 4: Memory refresh — project state snapshot

**Files:**
- Modify: `C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/project_lyzr_cfo_demo.md`
- Modify: `C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/MEMORY.md`

Memory lives outside the repo (in `~/.claude/projects/...`). These edits don't go through git. Use the Write/Edit tools directly.

- [ ] **Step 1: Read the current `project_lyzr_cfo_demo.md` to see the existing frontmatter**

Run:

```bash
cat "C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/project_lyzr_cfo_demo.md"
```

Note the YAML frontmatter at the top (the block bounded by `---` lines). You must preserve the frontmatter; only the body (everything after the closing `---`) is being replaced.

- [ ] **Step 2: Rewrite the body of `project_lyzr_cfo_demo.md`**

Use the Write tool to overwrite the file. Preserve the existing frontmatter exactly; replace the body with this content. The frontmatter's `name` and `description` fields should also be updated to reflect the new state.

Full file content to write:

```markdown
---
name: Lyzr AI CFO demo project state
description: Three journeys live (close, recon, capital), three placeholders; gitclaw-based agent; CSV 55/56 on robustness audit; last major merge b31e8e7 on 2026-04-24
type: project
---

Lyzr AI CFO demo project — agent-first AgenticOS shell.

**Live journeys (real data):**
- `monthly-close`, `financial-reconciliation`, `regulatory-capital`.

**Placeholder journeys (static mock):**
- `ifrs9-ecl`, `daily-liquidity`, `regulatory-returns`.

**Agent:** gitclaw SDK (`@/lib/agent`), `buildContext` → journey-context → `query()`. Journey-context builders live under `lib/agent/journey-context/` and each feeds a markdown block into the agent's system-prompt suffix.

**CSV:** 55/56 on robustness audit. Shared utils at `lib/csv/utils.ts`. Seven shapes: variance, ar, gl, sub_ledger, fx, capital_components, rwa_breakdown.

**Capital flow (shipped 2026-04-24):** `lib/capital/` module with minimums + period + stats + persist; four Prisma models (`CapitalPeriod`, `CapitalComponent`, `RwaLine`, `CapitalSnapshot`); Basel III Pillar 1 ratios (CET1, Tier 1, Total). Spec at `docs/superpowers/specs/2026-04-23-regulatory-capital-flow-design.md`.

**Last major merge:** `b31e8e7` on main (2026-04-24) — regulatory-capital flow + CSV robustness fixes land together.
```

- [ ] **Step 3: Verify the file**

Run:

```bash
cat "C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/project_lyzr_cfo_demo.md"
```

Expected: the frontmatter is intact, the body reflects the current-state summary, and the `description` field in the frontmatter has been updated.

- [ ] **Step 4: Update the `MEMORY.md` index**

Use the Edit tool on `C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/MEMORY.md`. Find the existing line that looks approximately like:

```
- [Lyzr AI CFO demo project state](project_lyzr_cfo_demo.md) — Gemini working, Path A agent-first reshape in progress, chat + upload commentary + LLM column mapper all landed
```

Replace it with:

```
- [Lyzr AI CFO demo project state](project_lyzr_cfo_demo.md) — three journeys live (close/recon/capital), three placeholders, gitclaw-based agent, CSV 55/56
```

- [ ] **Step 5: Verify the MEMORY.md index**

Run:

```bash
cat "C:/Users/shikh/.claude/projects/c--Users-shikh-lyzr-ai-cfo/memory/MEMORY.md"
```

Expected: the line for `project_lyzr_cfo_demo.md` reflects the new one-liner; all other lines are unchanged.

- [ ] **Step 6: No git commit**

Memory lives outside the repo — nothing to commit. Task 4 is complete after Step 5.

---

## Final verification — one step after all four tasks

- [ ] **Verify the four commits from Tasks 1-3 landed**

Run:

```bash
git log --oneline -4
```

Expected top three commits (any order does not matter; they're independent):
- `docs(readme): document regulatory-capital flow + CSV robustness`
- `docs: restructure CLAUDE.md as index + directives + state snapshot`
- `docs: restore gitclaw.md at project root from node_modules`

The fourth commit in the log is whatever preceded this work (likely the current `main` HEAD).

- [ ] **Verify no other files got staged inadvertently**

Run:

```bash
git status --short
```

Expected: clean working tree (no unstaged or untracked changes besides whatever was already there at session start).

---

## Spec-coverage summary

Cross-checking the plan against the spec:

- **Deliverable 1 (CLAUDE.md restructured)** — Task 2 ✓
- **Deliverable 2 (gitclaw.md restored at root)** — Task 1 ✓
- **Deliverable 3a (README journeys table)** — Task 3 Step 2 ✓
- **Deliverable 3b (README capital subsection)** — Task 3 Step 3 ✓
- **Deliverable 3c (README CSV robustness note)** — Task 3 Step 4 ✓
- **Deliverable 4a (memory: project_lyzr_cfo_demo.md body)** — Task 4 Steps 1-3 ✓
- **Deliverable 4b (memory: MEMORY.md index line)** — Task 4 Steps 4-5 ✓

**Scope deviation flagged:** the spec said "restore `gitclaw.md` verbatim to 1178 lines." In practice we copy from `node_modules/gitclaw/README.md` (~645 lines authoritative vendor docs) rather than reconstruct. This is strictly better — see "Scope note vs. spec" above. The spec's intent (have the SDK docs committed at root) is satisfied.

**No spec requirement left uncovered.**
