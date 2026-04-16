/*
  Warnings:

  - Changed the type of `lines` on the `JournalAdjustment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `strategyConfig` on the `MatchRun` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "AdjustmentProposal" DROP CONSTRAINT "AdjustmentProposal_breakId_fkey";

-- DropForeignKey
ALTER TABLE "Break" DROP CONSTRAINT "Break_matchRunId_fkey";

-- DropForeignKey
ALTER TABLE "GLEntry" DROP CONSTRAINT "GLEntry_dataSourceId_fkey";

-- DropForeignKey
ALTER TABLE "MatchLink" DROP CONSTRAINT "MatchLink_glEntryId_fkey";

-- DropForeignKey
ALTER TABLE "MatchLink" DROP CONSTRAINT "MatchLink_matchRunId_fkey";

-- DropForeignKey
ALTER TABLE "MatchLink" DROP CONSTRAINT "MatchLink_subEntryId_fkey";

-- DropForeignKey
ALTER TABLE "SubLedgerEntry" DROP CONSTRAINT "SubLedgerEntry_dataSourceId_fkey";

-- AlterTable
ALTER TABLE "JournalAdjustment" DROP COLUMN "lines",
ADD COLUMN     "lines" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "MatchRun" DROP COLUMN "strategyConfig",
ADD COLUMN     "strategyConfig" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "AdjustmentProposal_breakId_idx" ON "AdjustmentProposal"("breakId");

-- AddForeignKey
ALTER TABLE "GLEntry" ADD CONSTRAINT "GLEntry_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubLedgerEntry" ADD CONSTRAINT "SubLedgerEntry_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLink" ADD CONSTRAINT "MatchLink_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLink" ADD CONSTRAINT "MatchLink_glEntryId_fkey" FOREIGN KEY ("glEntryId") REFERENCES "GLEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLink" ADD CONSTRAINT "MatchLink_subEntryId_fkey" FOREIGN KEY ("subEntryId") REFERENCES "SubLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Break" ADD CONSTRAINT "Break_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentProposal" ADD CONSTRAINT "AdjustmentProposal_breakId_fkey" FOREIGN KEY ("breakId") REFERENCES "Break"("id") ON DELETE CASCADE ON UPDATE CASCADE;
