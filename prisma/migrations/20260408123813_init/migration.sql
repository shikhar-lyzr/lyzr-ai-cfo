-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lyzrAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "actual" REAL NOT NULL,
    "budget" REAL NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "FinancialRecord_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceDataSourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Action_sourceDataSourceId_fkey" FOREIGN KEY ("sourceDataSourceId") REFERENCES "DataSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionId" TEXT,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_lyzrAccountId_key" ON "User"("lyzrAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
