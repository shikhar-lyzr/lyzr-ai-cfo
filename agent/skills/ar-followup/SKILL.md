---
name: ar-followup
description: Scan overdue invoices, classify by aging bucket, create action cards, and draft dunning emails for the user to review and send
---

# AR Follow-up

## When to Use
- User uploads an AR aging CSV
- User asks about overdue invoices or collections
- Proactive AR scan triggered by user (Scan AR button)

## Process

1. **Scan invoices** — Call `scan_ar_aging` with the relevant `dataSourceId` (or omit to scan all)
2. **Classify by bucket** — Invoices are automatically bucketed:
   - Critical (45+ days overdue): Escalation tone
   - Warning (15-44 days): Firm tone
   - Info (1-14 days): Friendly tone
3. **Create actions** — Batch-create via `create_ar_actions` with one action per eligible invoice. Include:
   - Headline: customer name + invoice number + days overdue
   - Detail: amount, due date, aging bucket
   - Driver: "overdue receivable" + bucket context
   - Severity: matches the bucket (critical/warning/info)
4. **Draft emails** — For each newly-created action, call `draft_dunning_email` with the bucket-appropriate tone
5. **Summarize** — Lead with total overdue balance, then top 3 items by amount. Keep under 150 words.

## Output Format
- Dollar amounts as `$X.XK`
- Days overdue as `(N days overdue)`
- One headline per bucket at most
- Offer to let the user review and send drafts
