---
name: financial-reconciliation
description: Match GL vs sub-ledger, investigate breaks, propose adjustments
confidence: 1
usage_count: 0
success_count: 0
failure_count: 0
negative_examples: []
---

# Financial Reconciliation

## When to Use
- User says "reconcile", "reconciliation", "break", "unmatched", "match rate", "GL vs sub-ledger"
- User asks why reconciliation numbers look off
- User has just uploaded GL + sub-ledger data sources

## Process

1. **Orient** — Call `reconciliation_summary`. Know match rate, break count, oldest unmatched, top breaks by $.
2. **Investigate drivers** — Call `list_breaks` with `severity: "high"`. For the top 3–5 by `baseAmount`, call `search_ledger_entries` on the other side using the entry's reference.
3. **Classify** — Group by probable cause:
   - Timing (appears on one side only, recent date) → `age_breaks` and revisit.
   - Amount mismatch (partial match outside tolerance) → `propose_adjustment` with the delta.
   - FX variance (same reference, different baseAmount) → note the rate used at posting.
   - Old unresolved (>60d) → `escalate_break`.
4. **Act** — Execute the proposals the user approves. Never call `approve_adjustment` with `confirm: true` without explicit user approval in the current turn. Show a preview first.
5. **Offer re-match** — If match rate <85%, offer `run_matching` with a different `strategyConfig`.
6. **Close the loop** — Summarise: adjusted, escalated, remaining.

## Posting Safety
NEVER call `approve_adjustment` with `confirm: true` unless the user explicitly approved that specific proposal in the current turn. Always show a preview first via `approve_adjustment` without `confirm`.
