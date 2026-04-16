-- CreateTable
CREATE TABLE "GLEntry" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "account" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "memo" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "txnCurrency" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "debitCredit" TEXT NOT NULL,
    "counterparty" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GLEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubLedgerEntry" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "account" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "memo" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "txnCurrency" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "counterparty" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "strategyConfig" TEXT NOT NULL,
    "totalGL" INTEGER NOT NULL,
    "totalSub" INTEGER NOT NULL,
    "matched" INTEGER NOT NULL,
    "partial" INTEGER NOT NULL,
    "unmatched" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLink" (
    "id" TEXT NOT NULL,
    "matchRunId" TEXT NOT NULL,
    "glEntryId" TEXT NOT NULL,
    "subEntryId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "amountDelta" DOUBLE PRECISION NOT NULL,
    "dateDelta" INTEGER NOT NULL,

    CONSTRAINT "MatchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Break" (
    "id" TEXT NOT NULL,
    "matchRunId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "txnCurrency" TEXT NOT NULL,
    "ageDays" INTEGER NOT NULL,
    "ageBucket" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "actionId" TEXT,

    CONSTRAINT "Break_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentProposal" (
    "id" TEXT NOT NULL,
    "breakId" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "journalDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdjustmentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "lines" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FXRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FXRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GLEntry_dataSourceId_matchStatus_idx" ON "GLEntry"("dataSourceId", "matchStatus");

-- CreateIndex
CREATE INDEX "GLEntry_reference_idx" ON "GLEntry"("reference");

-- CreateIndex
CREATE INDEX "SubLedgerEntry_dataSourceId_matchStatus_idx" ON "SubLedgerEntry"("dataSourceId", "matchStatus");

-- CreateIndex
CREATE INDEX "SubLedgerEntry_reference_idx" ON "SubLedgerEntry"("reference");

-- CreateIndex
CREATE INDEX "MatchRun_userId_startedAt_idx" ON "MatchRun"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "MatchLink_matchRunId_idx" ON "MatchLink"("matchRunId");

-- CreateIndex
CREATE INDEX "Break_matchRunId_status_idx" ON "Break"("matchRunId", "status");

-- CreateIndex
CREATE INDEX "Break_ageBucket_severity_idx" ON "Break"("ageBucket", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "JournalAdjustment_proposalId_key" ON "JournalAdjustment"("proposalId");

-- CreateIndex
CREATE INDEX "FXRate_asOf_idx" ON "FXRate"("asOf");

-- CreateIndex
CREATE UNIQUE INDEX "FXRate_fromCurrency_toCurrency_asOf_key" ON "FXRate"("fromCurrency", "toCurrency", "asOf");

-- AddForeignKey
ALTER TABLE "GLEntry" ADD CONSTRAINT "GLEntry_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubLedgerEntry" ADD CONSTRAINT "SubLedgerEntry_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLink" ADD CONSTRAINT "MatchLink_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLink" ADD CONSTRAINT "MatchLink_glEntryId_fkey" FOREIGN KEY ("glEntryId") REFERENCES "GLEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLink" ADD CONSTRAINT "MatchLink_subEntryId_fkey" FOREIGN KEY ("subEntryId") REFERENCES "SubLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Break" ADD CONSTRAINT "Break_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentProposal" ADD CONSTRAINT "AdjustmentProposal_breakId_fkey" FOREIGN KEY ("breakId") REFERENCES "Break"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAdjustment" ADD CONSTRAINT "JournalAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
