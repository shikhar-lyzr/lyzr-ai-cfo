---
name: Lyzr AI CFO demo project state
description: Three journeys live (close, recon, capital), three placeholders; gitclaw-based agent; CSV 55/56 on robustness audit; last major merge b31e8e7 on 2026-04-24
type: project
originSessionId: e209bef9-69e4-47b9-ab55-f3f2b2d4b4f6
---
Lyzr AI CFO demo project — agent-first AgenticOS shell.

**Live journeys (real data):**
- `monthly-close`, `financial-reconciliation`, `regulatory-capital`.

**Placeholder journeys (static mock):**
- `ifrs9-ecl`, `daily-liquidity`, `regulatory-returns`.

**Agent:** gitclaw SDK (`@/lib/agent`), `buildContext` → journey-context → `query()`. Journey-context builders live under `lib/agent/journey-context/` and each feeds a markdown block into the agent's system-prompt suffix.

**CSV:** 55/56 on robustness audit. Shared utils at `lib/csv/utils.ts`. Seven shapes: variance, ar, gl, sub_ledger, fx, capital_components, rwa_breakdown.

**Capital flow (shipped 2026-04-24):** `lib/capital/` module with minimums + period + stats + persist; four Prisma models (`CapitalPeriod`, `CapitalComponent`, `RwaLine`, `CapitalSnapshot`); Basel III Pillar 1 ratios (CET1, Tier 1, Total). Spec at `docs/superpowers/specs/2026-04-23-regulatory-capital-flow-design.md`.

**Last major merge:** `041ce17` on main (2026-04-27) — Phase 1 "Make Observe Honest" (Decision Inbox + Audit Trail wired to real data). Prior merge: `b31e8e7` (2026-04-24) regulatory-capital flow + CSV robustness.

**Observe surface (post Phase 1):**
- `/decision-inbox` — real `Decision` rows; approve/reject persists.
- `/audit-trail` — real five-source merged timeline + CSV export.
- `/agent-runs`, `/compliance` — still SampleDataBadge'd (deferred).
