---
name: Always use systematic-debugging on bug reports in this repo
description: Any time the user reports a bug, error, or unexpected behavior, invoke superpowers:systematic-debugging FIRST — before reading code, proposing fixes, or dispatching investigations
type: feedback
originSessionId: 6aab874a-ddf5-4636-bf69-e5915c68e6c7
---
Any bug report, production log snippet, unexpected UI behavior, test failure, or
"why did X happen" question in this repo MUST start with the
`superpowers:systematic-debugging` skill. No exceptions.

**Why:** The user explicitly reminded me to use it on 2026-04-24 after I started
investigating a chat-tool failure (the `create_actions` "missing data source ID"
bug) by reading `lib/agent/tools.ts` directly instead of invoking the skill
first. Even though the investigation I did was structurally correct — trace data
flow, identify root cause, check for working patterns, hypothesise minimally —
skipping the formal invocation means: (a) I didn't announce the skill's Four
Phases to the user, (b) I wasn't bound by the Iron Law "no fixes without Phase 1
complete," (c) pattern drift. Previous sessions have shown that skipping the
formal invocation correlates with scatter-shot fixes.

**How to apply:** On ANY message containing a bug symptom — production logs,
"this isn't working," screenshots of error UIs, test-output failures, "why did X
happen" questions — the first action MUST be invoking
`superpowers:systematic-debugging` via the Skill tool. Then follow the four
phases (root cause → pattern → hypothesis → TDD fix) exactly as the skill
prescribes. Only after Phase 1 is complete may I read code with intent to fix,
propose fixes, or dispatch investigation subagents.

Bug indicators in this repo specifically: Vercel runtime log snippets, UI
screenshots showing error states, "Action item creation failed," "why is the
close readiness score what it is," "this returns 400/500," "the chat panel says
X but should say Y," any mention of a test failing, `/monthly-close` or
`/financial-reconciliation` behaving unexpectedly.
