-- =============================================================================
-- DESTRUCTIVE MIGRATION — PILOT / DEMO ENVIRONMENTS ONLY
-- =============================================================================
-- Truncates all reconciliation ledger + match tables so that newly-added
-- NOT NULL "periodKey" columns can be populated by re-ingesting CSVs.
-- DataSource rows are preserved; users re-upload GL/sub-ledger to repopulate.
--
-- DO NOT RUN against an environment whose reconciliation data must be retained.
-- Back up the listed tables first if there is any doubt.
-- =============================================================================

TRUNCATE TABLE "MatchLink", "Break", "MatchRun", "GLEntry", "SubLedgerEntry", "AdjustmentProposal", "JournalAdjustment" RESTART IDENTITY CASCADE;

-- Add columns
ALTER TABLE "GLEntry" ADD COLUMN "periodKey" TEXT NOT NULL;
ALTER TABLE "SubLedgerEntry" ADD COLUMN "periodKey" TEXT NOT NULL;
ALTER TABLE "MatchRun" ADD COLUMN "periodKey" TEXT NOT NULL;

CREATE INDEX "GLEntry_periodKey_idx" ON "GLEntry"("periodKey");
CREATE INDEX "SubLedgerEntry_periodKey_idx" ON "SubLedgerEntry"("periodKey");
CREATE INDEX "MatchRun_userId_periodKey_startedAt_idx" ON "MatchRun"("userId", "periodKey", "startedAt");

-- ReconPeriod table
CREATE TABLE "ReconPeriod" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconPeriod_userId_periodKey_key" ON "ReconPeriod"("userId", "periodKey");
CREATE INDEX "ReconPeriod_userId_createdAt_idx" ON "ReconPeriod"("userId", "createdAt");

ALTER TABLE "ReconPeriod"
  ADD CONSTRAINT "ReconPeriod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
