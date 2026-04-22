-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "period" TEXT;

-- CreateIndex
CREATE INDEX "Document_userId_type_period_idx" ON "Document"("userId", "type", "period");
