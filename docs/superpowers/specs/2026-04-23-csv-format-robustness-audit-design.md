# CSV Format Robustness Audit — Design

**Date:** 2026-04-23
**Author:** Shikhar + Claude
**Status:** proposed

## Context

The Lyzr AI CFO app ingests CSVs through `POST /api/upload`. That route calls `detectCsvShape` (regex-first with LLM fallback in `lib/csv/detect-shape.ts` + `lib/csv/llm-mapper.ts`) and then hands off to one of five shape-specific parsers:

- `lib/csv/variance-parser.ts` — regex auto-detect + LLM mapper fallback
- `lib/csv/ar-parser.ts` — fuzzy regex + LLM fallback + multi-format date parser
- `lib/csv/gl-parser.ts` — exact-match lowercase headers, no fallback
- `lib/csv/sub-ledger-parser.ts` — exact-match lowercase headers, no fallback
- `lib/csv/fx-rates-parser.ts` — exact-match lowercase headers, no fallback, silently drops bad rows

A quick read of the parsers reveals a large maturity spread: AR and Variance were built to tolerate real-world CSV drift; GL, Sub-ledger, and FX were built to parse one specific sample shape. This spec is an investigation to produce hard evidence of where each parser actually falls over, without changing production code.

## Goals

- Produce a single markdown report (`docs/audits/2026-04-23-csv-format-robustness.md`) with a matrix of 12 CSV variants × 5 shapes → 60 pass/fail datapoints.
- Identify, per-parser, the exact source line that rejects each failing variant, so a future fix pass has concrete targets.
- Produce a prioritised punch-list of improvements, ordered by which real-world variations each fix would unblock.

## Non-Goals

- No changes to production code. Zero edits under `lib/`, `app/`, or `prisma/`.
- No LLM calls. The audit measures regex-path robustness only. Both AR and Variance have LLM fallbacks that the upload route would use in production; this audit explicitly reports what happens WITHOUT that fallback, to expose the parser's own tolerance.
- No database writes. Parsers are invoked as pure functions.
- No integration with the vitest suite. The audit is a one-shot throwaway script, not a regression test.
- No file-encoding variations (BOM, UTF-16, tab separators, non-UTF-8 encodings). These are upload-path concerns, not parser-logic concerns.
- No fixes to any parser discovered to be brittle. Per user decision D in brainstorming: audit only, defer fix decisions until the matrix is visible.

## Architecture

One throwaway script: `scripts/audit-csv-parsers.ts`. Invoked via `npx tsx scripts/audit-csv-parsers.ts`. Writes the report to `docs/audits/2026-04-23-csv-format-robustness.md`. No CLI args. Re-running overwrites the report.

Baseline CSVs are inlined as string constants in the script itself, not loaded from `public/samples/`. Decouples the audit from the shipped samples — the samples can drift without breaking the audit, and anyone reading the script sees the exact input directly.

For each shape, the script:
1. Defines one baseline CSV (headers + ~3 data rows, deliberately small so outcome comparison is tractable).
2. Runs the baseline through the detector and matching parser; records the baseline output.
3. Applies each variant mutation to produce a modified `(headers, rows)` pair.
4. For header-variation variants (Category A): runs `detectFastPath(mutatedHeaders)`. If the detector returns the wrong shape or `"unknown"`, records `FAIL_DETECT` and moves on.
5. Runs the matching parser on the mutated rows, records outcome.
6. Compares parser output to baseline's output: same row count + first row's key field (account/reference/invoiceNumber/etc) matches → `PASS`. Different row count or key field → `PARTIAL`. Thrown error → `FAIL_PARSE`.

Finally assembles the matrix + per-shape findings + punch-list into the markdown report.

## Variation Catalog

Twelve variants total, six per category. Applied uniformly across all five shapes (variants that don't apply to a given shape — e.g., "Payment Due" synonym doesn't make sense for FX — are recorded as `N/A` in that cell).

### Category A — Header variations

| Id | Mutation | Why |
|----|----------|-----|
| A1 | Swap column order (reverse the header array) | Tests whether the parser finds columns by name vs by position |
| A2 | Rename with synonym (per-shape list below) | Tests fuzzy / synonym matching |
| A3 | Uppercase all headers (`ENTRY_DATE`) | Tests case sensitivity |
| A4 | Whitespace variation (`entry_date` → `Entry Date` with space + title-case) | Tests `.trim()` + case handling combined |
| A5 | Add irrelevant extra column (`Notes` at the end, with dummy values) | Tests resilience to unknown columns |
| A6 | Drop one optional column (shape-specific: `memo` for GL/Sub, `customerEmail` for AR, etc.) | Tests optional-column handling |

**Per-shape synonym map for A2:**

- variance: `account` → `line_item`, `actual` → `spent`, `budget` → `plan`
- ar: `invoice_number` → `inv_no`, `customer` → `client`, `due_date` → `payment_due`
- gl: `entry_date` → `date`, `amount` → `amt`, `debit_credit` → `dr_cr`
- sub_ledger: `entry_date` → `date`, `amount` → `amt`, `source_module` → `module`
- fx: `from_currency` → `from`, `to_currency` → `to`, `as_of` → `date`

### Category B — Content variations (headers unchanged from baseline)

| Id | Mutation | Why |
|----|----------|-----|
| B1 | Date format: ISO → US (`04/15/2026`) | Tests date format tolerance |
| B2 | Date format: ISO → EU (`15/04/2026`) | Tests ambiguous-format handling |
| B3 | Date format: named month (`15 Apr 2026`) | Tests non-numeric dates |
| B4 | Amount with thousands separator (`1,234.56`) | Tests number formatting |
| B5 | Amount with accounting parens for negatives (`(500.00)`) | Tests negative convention |
| B6 | Amount with currency-symbol prefix (`$1234.56`) | Tests currency-symbol tolerance |

For shapes that don't carry dates or amounts (e.g., FX has `rate` and `as_of` but no "amount"), the variant is either adapted sensibly or marked `N/A`.

**Row-level failures manifest differently per shape** and the report will preserve that nuance:
- GL, Sub-ledger, AR, Variance: push failed rows into a `skipped` array; the parser returns normally with a shorter entries list → outcome is PARTIAL.
- FX: `fx-rates-parser.ts:16` silently `continue`s on bad rows; the parser also returns a shorter list → also PARTIAL.
- All five: if a row-level mutation somehow causes the parser to throw before iteration (e.g., headers missing), outcome is FAIL_PARSE.

## Outcome Semantics

Each matrix cell is ONE of:

- **PASS** — Shape detected correctly (for Category A), parser completed without throwing, output row count equals baseline's, first row's key field matches baseline's first row.
- **PARTIAL** — Shape detected correctly, parser completed, but row count differs from baseline OR key-field value differs. For FX, "silently dropped rows" manifests here.
- **FAIL_DETECT** — `detectFastPath` returned `"unknown"` or a different shape than expected (Category A only).
- **FAIL_PARSE** — Parser threw an error.
- **N/A** — Variant does not apply to this shape.

Each non-PASS cell is annotated in the per-shape findings section with:
- The variant ID
- The thrown error or the semantic difference
- The parser source line responsible (when identifiable)

## Report Layout

File: `docs/audits/2026-04-23-csv-format-robustness.md`

1. **Summary** — one paragraph. "N/60 pass, M fail. Most brittle parser is X. Most tolerant parser is Y."
2. **Matrix** — one row per variant, columns `variance | ar | gl | sub_ledger | fx`.
3. **Per-shape findings** — for each shape: baseline outcome, list of variant failures, one-paragraph root cause with source line reference.
4. **Punch-list** — prioritised gaps for a future fix pass. Each item names the parser, the variant(s) it would unlock, and a one-line suggested fix.

## Testing the Audit

The audit is itself untested (it's a one-shot script). Confidence comes from:
- Baseline outcome MUST be `PASS` for every shape. If a baseline fails, the script bug is in the comparator or the baseline definition, not the parser.
- Script prints the generated markdown table to stdout as well as writing to the file, for a quick sanity check.

## Risks

- **False-negative PARTIAL assignments.** If the comparator is too strict, it will flag legitimate equivalent outputs (e.g., a date parsed from `04/15/2026` is the same semantic value as the baseline's `2026-04-15` even though the JS Date objects differ in source). Mitigated by comparing only structural shape (row count + key field value).
- **Variants that happen to match multiple shapes' signals.** A CSV with both "budget" and "invoice_number" columns would be ambiguous. Variants here are designed to preserve the primary shape signal, but variant A2 "Payment Due" vs "Due Date" could theoretically shift AR detection. Mitigated by using synonym lists that preserve at least one strong per-shape signal.
- **FX silently dropping rows.** `fx-rates-parser.ts:16` skips unparseable rows without a `skipped` array. Category B variants that break amount/date will show as PARTIAL rather than FAIL_PARSE. The report will call this out.

## Files Created

- `scripts/audit-csv-parsers.ts` (throwaway audit harness)
- `docs/audits/2026-04-23-csv-format-robustness.md` (the report itself)
- `docs/superpowers/plans/2026-04-23-csv-format-audit.md` (implementation plan, produced by writing-plans next)

## Success Criteria

- All five baselines produce PASS (confidence check on the script).
- Every non-PASS cell has an annotated explanation in the report.
- Punch-list is concrete enough that a future fix pass can start work without re-investigating.
- No production code touched; no DB rows created; no `tests/` files added or modified.
