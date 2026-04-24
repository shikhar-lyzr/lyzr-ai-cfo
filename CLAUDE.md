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
