-- DropForeignKey
ALTER TABLE "FinancialRecord" DROP CONSTRAINT "FinancialRecord_dataSourceId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_dataSourceId_fkey";

-- AlterTable
ALTER TABLE "DataSource" ADD COLUMN     "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "DataSource_userId_contentHash_idx" ON "DataSource"("userId", "contentHash");

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
