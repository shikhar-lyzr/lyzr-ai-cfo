# DESTRUCTIVE MIGRATION — PILOT / DEMO ENVIRONMENTS ONLY

Truncates all reconciliation ledger + match tables so that newly-added
NOT NULL `periodKey` columns can be populated by re-ingesting CSVs.
`DataSource` rows are preserved; users re-upload GL/sub-ledger to repopulate.

DO NOT RUN against an environment whose reconciliation data must be retained.
Back up the listed tables first if there is any doubt.

## FXRate truncation footnote

The original `TRUNCATE` list in `migration.sql` includes `"FXRate"`, which was
unnecessary — `FXRate` has no `periodKey` column in this migration and did not
need to be cleared for the cutover. A fresh environment running this migration
can safely skip the `FXRate` entry in the truncate list.
