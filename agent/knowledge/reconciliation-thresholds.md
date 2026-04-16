# Reconciliation Thresholds

## Age buckets
- 0–30 days: current
- 31–60 days: ageing
- 60+ days: stale (auto-escalates to Actions feed if severity=high)

## Severity
- high: age > 60 days OR |baseAmount| > $10,000
- medium: age > 30 days OR |baseAmount| > $1,000
- low: otherwise

## Default match tolerances
- amount: ±$1.00 (base currency)
- date: ±2 days
- fuzzy memo threshold: 0.85 (Jaro-Winkler)
- amount proximity for fuzzy: within 5%
