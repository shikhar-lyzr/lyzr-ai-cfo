---
name: monthly-close
description: Guide the user through monthly financial close by reviewing all open items, generating commentary, and preparing reports
---

# Monthly Close

## When to Use
- User says "monthly close", "close the books", or "prepare for close"
- User asks for a report or commentary across all data sources

## Process

1. **Inventory check** — Call `search_records` with no filters to see all available data
2. **Full analysis** — Call `analyze_financial_data` across all sources
3. **Review open actions** — Check existing pending actions for completeness
4. **Generate commentary** — Call `generate_commentary` in "detailed" or "board" format
5. **Flag gaps** — Identify any categories missing data or with zero budget
6. **Prepare action list** — Ensure every critical/warning item has an action
7. **Offer next steps**:
   - Draft follow-up emails for unresolved items
   - Generate executive summary for board deck
   - Highlight items that changed vs prior period

## Output Format
- Start with overall health: "On track" / "Attention needed" / "Off track"
- List critical items first, then warnings
- End with a clear list of open items requiring team input
- Offer to generate specific outputs (email, commentary, board summary)
