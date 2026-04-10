-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "customerEmail" TEXT,
    "amount" REAL NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lastDunnedAt" DATETIME,
    "snoozedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceDataSourceId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "draftBody" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Action_sourceDataSourceId_fkey" FOREIGN KEY ("sourceDataSourceId") REFERENCES "DataSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Action_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Action" ("createdAt", "detail", "driver", "headline", "id", "severity", "sourceDataSourceId", "status", "type", "userId") SELECT "createdAt", "detail", "driver", "headline", "id", "severity", "sourceDataSourceId", "status", "type", "userId" FROM "Action";
DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_dataSourceId_invoiceNumber_key" ON "Invoice"("dataSourceId", "invoiceNumber");
