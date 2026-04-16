-- DropForeignKey
ALTER TABLE "Action" DROP CONSTRAINT "Action_sourceDataSourceId_fkey";

-- AlterTable
ALTER TABLE "Action" ALTER COLUMN "sourceDataSourceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_sourceDataSourceId_fkey" FOREIGN KEY ("sourceDataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
