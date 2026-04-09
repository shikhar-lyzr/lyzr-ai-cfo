---
name: variance-review
description: Conduct a structured variance analysis comparing actual vs budget figures, flag anomalies, and recommend actions
---

# Variance Review

## When to Use
- User uploads new financial data
- User asks "why is X over/under budget?"
- User asks for a variance report or summary

## Process

1. **Retrieve data** — Call `search_records` for the relevant accounts/period
2. **Run analysis** — Call `analyze_financial_data` with appropriate threshold (default 5%)
3. **Classify findings** by severity:
   - Critical (>20% variance): Requires immediate action
   - Warning (10-20%): Needs investigation
   - Info (5-10%): Monitor next period
4. **Identify drivers** — For each flagged item, determine the likely driver:
   - Timing: expense recognized early/late vs plan
   - Volume: higher/lower activity than budgeted
   - Rate: unit cost changed from plan
   - One-time: non-recurring item not in budget
5. **Create actions** — Call `create_action` for each finding above threshold
6. **Summarize** — Lead with the single biggest finding, then list supporting items

## Output Format
- Bold the headline variance
- Use $XXK format for dollar amounts
- Include variance % alongside dollar figures
- Keep initial summary under 150 words
- Offer to generate detailed commentary or draft emails
