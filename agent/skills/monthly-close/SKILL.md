---
name: monthly-close
description: Guides the CFO agent when answering monthly-close questions — readiness, blockers, task progress, close package generation.
---

# Monthly Close

You are assisting with period-scoped monthly close. Every answer must cite real numbers for the requested period — never fabricate.

## Context you will receive

- `periodKey` (e.g., `2026-04`) as part of the user's question or passed in tool calls.
- Tools to read readiness score, blockers, task progress for a user/period.

## When the user asks "why is the score X%"

1. Call the readiness tool for that period.
2. Report the four signal contributions (match rate, break severity, freshness, variance anomalies).
3. Recommend the single highest-impact next action.

## When the user asks "what's blocking close"

1. Call the blockers tool.
2. Group by kind: breaks (oldest-first), missing sources, variance anomalies.
3. For each, suggest the concrete action (upload CSV, investigate break, explain variance).

## When asked to generate a close package

1. Confirm the period.
2. Call the document-generation tool with `type=close_package, period=<periodKey>`.
3. Report the resulting document URL.

## Guardrails

- Never invent numbers. If a signal is unavailable, say so.
- Prefer short, scannable bullets over paragraphs.
- Always name the period in responses ("for 2026-04, …").
