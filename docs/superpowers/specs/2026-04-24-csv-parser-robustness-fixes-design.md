# CSV Parser Robustness Fixes — Design

**Date:** 2026-04-24
**Author:** Shikhar + Claude
**Status:** proposed
**Related:** `docs/audits/2026-04-23-csv-format-robustness.md`

## Context

The audit at `docs/audits/2026-04-23-csv-format-robustness.md` enumerated 40/56 PASS across 5 parsers × 12 CSV variants. Three root-cause clusters account for every failure:

1. **Shape detector brittleness** — `detectFastPath` in `lib/csv/detect-shape.ts` uses three unique-fingerprint regexes (`debit_credit`, `source_module`, `from_currency`+`to_currency`+`rate`). When a synonym rename mutates any of these, the detector returns `"unknown"` and would fall back to LLM in production. Three FAIL_DETECT cells trace to this.
2. **GL, Sub-ledger, FX parsers do exact-match lowercase header lookup.** `headers.findIndex((h) => h.toLowerCase().trim() === name)` rejects any whitespace-normalized variant ("Entry Date" vs "entry_date"). Three FAIL_PARSE cells trace to this.
3. **No parser tolerates real-world amount formatting.** `Number("$1,234.56")` returns NaN. `Number("(500.00)")` returns NaN. Seven PARTIAL cells trace to this. AR's own `parseDate` also misses the named-month variant (one PARTIAL).

This spec specifies fixes for all three clusters, bundled into one pass to avoid scatter-shot cleanup later.

## Goals

- Parser matrix pass rate ≥ 54/56 (up from 40/56), with zero FAIL_DETECT and zero FAIL_PARSE.
- All five parsers share one amount parser, one date parser, one fuzzy header lookup. No per-parser re-implementation of format tolerance.
- The audit script continues to be the authoritative regression oracle. After this pass, re-running it produces a fresh matrix showing the improved pass rate.
- Preserve existing behavior for the 259 tests currently green — with one exception: `__tests__/lib/csv/fx-rates-parser.test.ts` is mechanically updated because FX's return shape changes.

## Non-Goals

- European amount formats (`1.234,56`, `1 234,56`)
- Excel serial date numbers (e.g., `45383` → 2024-04-30)
- Tab or semicolon field separators
- Currency-aware amount parsing (currently strips symbols but doesn't USE them for FX conversion)
- UI changes (e.g., date-format picker on upload)
- Anything about file encoding (BOM, UTF-16) — upload path concern, not parser-logic concern

## Decision Log (from brainstorming)

Each Q → A from the brainstorming session, captured here so implementers can cross-reference:

| Q | Decision |
|---|---|
| Shape-detector scope | Both regex synonyms AND LLM fallback (C) |
| Shared utility vs per-parser | Shared utilities in `lib/csv/utils.ts` (B) |
| EU vs US date ambiguity | Per-column detection with US fallback + `console.warn` (A) |
| Amount edge cases | Explicit allowlist: parens, `$`/`€`/`£`/`¥`/`₹`, trailing minus. Reject European decimal/thousands (B) |
| Test strategy | Unit tests for utils + audit round-trip test (C) |
| Backwards compat | Hard throws preserved; no existing-test changes... EXCEPT FX per the B-literal decision |
| B-literal vs B-deferred (FX skipped-rows surfacing) | B-literal: include FX signature change, update its test file |

## Architecture

**New module: `lib/csv/utils.ts`.** Pure helpers, no DB, no network, no external deps. Consumed by all five parsers + the detector tests.

**Migration pattern per parser:** replace the inline header-index lookup with `findHeader(headers, canonical, aliases)`. Replace `Number(r[iAmt])` with `parseAmount(r[iAmt])`. Replace `new Date(r[iDate])` with `parseDate(r[iDate], detectedFormat)` where `detectedFormat` was computed once before the per-row loop. Error paths preserved — parsers still throw on truly-missing required headers, still push unparseable rows to `skipped[]`.

**One breaking signature change:** `parseFxRatesCsv` returns `{rates: FXRateInput[], skipped: Array<...>}` instead of `FXRateInput[]`. This aligns FX with the other four parsers' `{entries|invoices|rates, skipped}` shape. Existing callers (one in `lib/reconciliation/persist.ts` and one test file) are updated in the same commit.

**Audit script:** `scripts/audit-csv-parsers.ts` keeps its orchestration and markdown generation. The `BASELINES` and `ALL_VARIANTS` constants move out to `lib/csv/__fixtures__/audit-fixtures.ts` so the new parser-robustness test can import them without duplication.

## Utility API

### `findHeader(headers, canonical, aliases?) → number`

- Case-insensitive match
- Whitespace and underscore normalization on both sides (so `Entry Date`, `entry_date`, `entry date`, `ENTRY_DATE` all map to the same canonical form `entry date`)
- Tries `canonical` first; then each alias in order; returns index of first match
- Returns `-1` if nothing matches
- Pure function; no side effects

### `parseAmount(value) → number | null`

Input is a trimmed string. Stripping happens inside (callers don't need to pre-strip). Behavior contracts:

| Input | Output |
|---|---|
| `"1234.56"` | `1234.56` |
| `"1,234.56"` | `1234.56` |
| `"$1,234.56"` | `1234.56` |
| `"€1,234.56"` | `1234.56` |
| `"£1234"` | `1234` |
| `"¥100"` | `100` |
| `"₹2500.50"` | `2500.50` |
| `"(500.00)"` | `-500` |
| `"-500.00"` | `-500` |
| `"500.00-"` | `-500` (trailing minus, SAP/legacy) |
| `"1.234,56"` | `null` (European — explicitly not supported) |
| `"1 234,56"` | `null` (space thousands — explicitly not supported) |
| `"N/A"` | `null` |
| `""` or whitespace | `null` |
| `"abc"` | `null` |

Stripped characters allowlist: `$`, `€`, `£`, `¥`, `₹`, `,`, ASCII whitespace. Never strips arbitrary non-digits (so `1M` does not become `1`).

### `parseDate(value, format?) → Date | null`

Input is a trimmed string. Formats recognized:

| Format | Example | Key |
|---|---|---|
| ISO | `2026-04-15` | `iso` |
| US | `04/15/2026` | `us` |
| EU | `15/04/2026` | `eu` |
| Named long | `15 Apr 2026` | `named` |
| Named hyphen | `15-Apr-2026` | `named` |

Logic:
- ISO always recognized regardless of `format` arg (unambiguous).
- Named-month always recognized regardless of `format` arg.
- For `MM/DD/YYYY` vs `DD/MM/YYYY` disambiguation:
  - If `format` arg passed, use it.
  - If omitted, try US first (industry-common), return null if it produces an invalid date.
- Returns `null` on any unrecognized format, any out-of-range value, or invalid Date.

### `detectDateFormat(columnValues) → "iso" | "us" | "eu" | "named"`

- Walks all values in a column.
- If any value has `day > 12` under US parsing, format is US (unambiguous).
- If any value has `month > 12` under US parsing but `day ≤ 12`, format is EU (unambiguous).
- If all values are fully ambiguous (every day ≤ 12), returns `"us"` and emits `console.warn("CSV date column is ambiguous between US and EU format; defaulting to US (MM/DD/YYYY)")`.
- ISO values in a column are ignored for the purpose of disambiguation — they pass through `parseDate` regardless of detected format.

## Detector Synonym Expansion

Changes to `lib/csv/detect-shape.ts`:

```ts
// GL: add dr/cr synonyms
if (/debit[_\s-]?credit|\bdr[_\s/-]?cr\b|\bdr\s*\/\s*cr\b/i.test(joined)) return "gl";

// Sub-ledger: accept bare `module` as a standalone header
if (/source[_\s-]?module|(^|\|)\s*module\s*($|\|)/i.test(joined)) return "sub_ledger";

// FX: accept bare from/to plus explicit base/quote synonyms
if (
  (/from[_\s-]?currency|(^|\|)\s*from\s*($|\|)|\bbase[_\s-]?currency\b/i.test(joined)) &&
  (/to[_\s-]?currency|(^|\|)\s*to\s*($|\|)|\bquote[_\s-]?currency\b/i.test(joined)) &&
  /\brate\b/i.test(joined)
) return "fx";
```

Collision check confirmed safe in brainstorming: no AR / variance / unrelated CSV would have `dr_cr`, standalone `module`, or `from`+`to`+`rate` headers.

## Parser Migrations

Each parser migrates to use the utils. Public surface preserved (except FX signature).

**GL parser (`lib/csv/gl-parser.ts`):**
- Replace `idx(name)` with `findHeader(headers, canonical, aliases)` calls.
- Declared aliases per column: see the Section-4 design in brainstorming for the full list.
- Before per-row loop: `const dateFormat = detectDateFormat(rows.map((r) => r[iDate]).filter(Boolean))`.
- Per row: `parseDate(r[iDate], dateFormat)`, `parseAmount(r[iAmt])`.
- Unparseable rows still go into `skipped[]`. Truly-missing required columns still throw `"GL CSV missing required headers"`.

**Sub-ledger parser:** same migration shape, with sub-ledger-appropriate aliases.

**FX parser:** same migration + return-shape change to `{rates, skipped}`. Updates `lib/reconciliation/persist.ts::ingestFxRates` destructuring in the same commit. Updates `__tests__/lib/csv/fx-rates-parser.test.ts` (~6 assertion sites: `result[0].foo` → `result.rates[0].foo`). Adds one new test covering the `skipped` array.

**AR parser:** deletes its local `parseDate` and `parseAmount`, imports from utils. The current AR tests still pass unchanged because:
- ISO, US-slash, and `DD-MMM-YYYY` formats (the three AR currently supports) all remain supported by the shared `parseDate`.
- `parseAmount` strips the same set AR was stripping (`$`, `,`, whitespace) plus more — so AR inputs that passed before still pass.
- Named-month `15 Apr 2026` becomes newly-supported — this is the B3 fix.

**Variance parser:** no changes. The regex auto-detect + LLM fallback already handles all 10 applicable audit variants (2 are N/A for variance).

## Test Plan

### Unit tests — `tests/csv/utils.test.ts` (~25 assertions)

Four describe blocks:
- `findHeader`: exact / case-insensitive / whitespace-normalized / alias fallback / unknown returns -1 (5 assertions)
- `parseAmount`: one per row in the behavior table above (~12 assertions)
- `parseDate`: ISO / US / EU / named long / named hyphen / invalid / explicit format arg (~7 assertions)
- `detectDateFormat`: US by day>12 / EU by month>12 / ambiguous returns US+warn / ISO-only column / empty column (~5 assertions)

### Audit round-trip — `tests/csv/parser-robustness.test.ts` (~3 assertions)

Imports baselines and variants from `lib/csv/__fixtures__/audit-fixtures.ts`, runs the matrix, asserts:
- `tally.PASS >= 54`
- `tally.FAIL_DETECT === 0`
- `tally.FAIL_PARSE === 0`

Intentionally lenient on the exact pass count (`>=`, not `===`) so legitimate future improvements don't churn the test. Brittle on FAIL counts (`===`) because those are the bugs this pass fixes.

### No integration tests

Existing end-to-end tests (upload route, agent paths) already exercise the parsers indirectly via ingestion. No new end-to-end tests needed for this pass.

## Rollout Plan (commit-by-commit)

Sequential, each commit green:

1. Create `lib/csv/utils.ts` + `tests/csv/utils.test.ts`. No production dependents yet. Commit: "feat(csv): shared utils for header/date/amount parsing".
2. Create `lib/csv/__fixtures__/audit-fixtures.ts` by extracting `BASELINES` + `ALL_VARIANTS` + `runMatrix` from `scripts/audit-csv-parsers.ts`. Update the script to import. Commit: "refactor(audit): extract fixtures for reuse".
3. Expand `detect-shape.ts` synonyms. Re-run audit script, expect FAIL_DETECT → 0 for A2 variants. Commit: "feat(csv): extend detector with synonym regexes".
4. Migrate GL parser. Commit: "feat(csv): GL parser uses shared utils".
5. Migrate sub-ledger parser. Commit: "feat(csv): sub-ledger parser uses shared utils".
6. Migrate FX parser + update `ingestFxRates` consumer + update `fx-rates-parser.test.ts`. All in one commit to keep build green. Commit: "feat(csv): FX parser returns {rates, skipped} and uses shared utils".
7. Migrate AR parser; remove local `parseDate`/`parseAmount`. Commit: "refactor(csv): AR parser reuses shared utils".
8. Add `tests/csv/parser-robustness.test.ts`. Commit: "test(csv): audit-matrix round-trip regression guard".
9. Re-run audit script. This overwrites `docs/audits/2026-04-23-csv-format-robustness.md` in place — the pre-fix matrix remains accessible via `git show b3b6028:docs/audits/2026-04-23-csv-format-robustness.md`. Commit: "docs(audit): refresh robustness matrix after parser fixes". Include a brief note in the commit message of before/after pass counts for git-log visibility.

## Error Handling

- **Truly-missing required columns**: parser throws the same `"<Shape> CSV missing required headers"` error it does today. Existing tests covering this behavior continue to pass.
- **Unparseable individual rows**: pushed into `skipped[]` with a reason string. Same as current behavior.
- **Ambiguous date column with no disambiguating value**: parses as US, emits `console.warn` once per column detection. No throw.
- **Unknown currency symbol in amount** (e.g., `¤1000`): `parseAmount` returns `null`, row goes to `skipped[]`. Not a new failure mode — `Number("¤1000")` was already NaN.

## Risks

| Risk | Mitigation |
|---|---|
| Existing 259 tests break on parser-refactor | Each step in rollout re-runs `npx vitest run` before committing. Fix or revert in the same commit if anything breaks. |
| `detectDateFormat` defaults US when all rows have day ≤ 12; UK user silently mis-parses | `console.warn` at detection time — surfaces in server logs. Not fatal. Documented in spec. |
| FX signature change breaks a caller we haven't found | Explicit grep-sweep before commit 6. Verified callers: `ingestFxRates` (same commit), `fx-rates-parser.test.ts` (same commit). No production consumer of `parseFxRatesCsv` outside these. |
| Shared utils have subtle bugs all parsers now inherit | Unit tests are tight (~25 assertions). Fewer moving parts than per-parser duplicated logic. |
| Audit round-trip test is flaky (pass count hovers at 53-55) | Assert `>= 54`, not `=== 54`. Room for legitimate improvement. |
| Named-month format starts matching legitimate non-date strings | Regex is anchored: requires `DD <Month> YYYY` or `DD-<Month>-YYYY` shape. A string like "15 aprotype" won't match. |

## Files Touched

### Created
- `lib/csv/utils.ts`
- `lib/csv/__fixtures__/audit-fixtures.ts`
- `tests/csv/utils.test.ts`
- `tests/csv/parser-robustness.test.ts`

### Modified
- `lib/csv/detect-shape.ts`
- `lib/csv/gl-parser.ts`
- `lib/csv/sub-ledger-parser.ts`
- `lib/csv/fx-rates-parser.ts` (breaking signature change)
- `lib/csv/ar-parser.ts` (remove local helpers)
- `lib/reconciliation/persist.ts` (FX consumer update)
- `scripts/audit-csv-parsers.ts` (import fixtures)
- `__tests__/lib/csv/fx-rates-parser.test.ts` (mechanical test updates)
- `docs/audits/2026-04-23-csv-format-robustness.md` (regenerated at the end)

### Unchanged
- `lib/csv/variance-parser.ts` (already passes 100%)
- `lib/csv/llm-mapper.ts` (orthogonal to parser robustness)
- All other 259 existing test files

## Success Criteria

- `npx vitest run` shows 259 existing tests pass + new utils tests pass + new parser-robustness test passes. Final count ≈ 283.
- `npx tsx scripts/audit-csv-parsers.ts` writes a fresh report with ≥ 54/56 PASS, zero FAIL_DETECT, zero FAIL_PARSE.
- `npx tsc --noEmit` clean.
- No changes to the 258 tests we're not explicitly touching.
