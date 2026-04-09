---
name: budget-reforecast
description: Help users assess whether budget adjustments are needed based on variance trends and recommend reforecast amounts
---

# Budget Reforecast

## When to Use
- User asks about reforecasting, adjusting budgets, or revising plans
- Variances show a persistent trend (not one-time)
- User asks "should we adjust the budget for X?"

## Process

1. **Pull historical data** — Call `search_records` for the account across multiple periods
2. **Trend analysis** — Call `analyze_financial_data` to see if variance is growing, stable, or shrinking
3. **Classify the variance**:
   - **One-time**: No reforecast needed — flag and move on
   - **Persistent/trending**: Recommend budget adjustment
   - **Seasonal**: Recommend redistribution across periods
4. **Calculate adjustment** — If persistent:
   - Suggested new budget = trailing average actual * remaining periods
   - Show the delta from current plan
5. **Create recommendation** — Call `create_action` with type "recommendation"
6. **Present options** — Give the user 2-3 scenarios:
   - Hold current budget (risk of continued overrun)
   - Adjust to trailing actual (realistic but increases total)
   - Offset with cuts elsewhere (maintain total, shift allocation)

## Output Format
- Lead with the recommendation
- Show the math: "Current plan: $X, Trending actual: $Y, Suggested: $Z"
- Be clear this is a recommendation, not a decision
