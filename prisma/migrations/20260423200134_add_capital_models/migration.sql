-- CreateTable
CREATE TABLE "CapitalPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalComponent" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RwaLine" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "exposureClass" TEXT NOT NULL,
    "exposureAmount" DOUBLE PRECISION NOT NULL,
    "riskWeight" DOUBLE PRECISION NOT NULL,
    "rwa" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RwaLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "cet1Ratio" DOUBLE PRECISION NOT NULL,
    "tier1Ratio" DOUBLE PRECISION NOT NULL,
    "totalRatio" DOUBLE PRECISION NOT NULL,
    "cet1Capital" DOUBLE PRECISION NOT NULL,
    "tier1Capital" DOUBLE PRECISION NOT NULL,
    "totalCapital" DOUBLE PRECISION NOT NULL,
    "totalRwa" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapitalPeriod_userId_createdAt_idx" ON "CapitalPeriod"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalPeriod_userId_periodKey_key" ON "CapitalPeriod"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "CapitalComponent_dataSourceId_periodKey_idx" ON "CapitalComponent"("dataSourceId", "periodKey");

-- CreateIndex
CREATE INDEX "CapitalComponent_periodKey_component_idx" ON "CapitalComponent"("periodKey", "component");

-- CreateIndex
CREATE INDEX "RwaLine_dataSourceId_periodKey_idx" ON "RwaLine"("dataSourceId", "periodKey");

-- CreateIndex
CREATE INDEX "RwaLine_periodKey_riskType_idx" ON "RwaLine"("periodKey", "riskType");

-- CreateIndex
CREATE INDEX "CapitalSnapshot_userId_computedAt_idx" ON "CapitalSnapshot"("userId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalSnapshot_userId_periodKey_key" ON "CapitalSnapshot"("userId", "periodKey");

-- AddForeignKey
ALTER TABLE "CapitalPeriod" ADD CONSTRAINT "CapitalPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalComponent" ADD CONSTRAINT "CapitalComponent_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RwaLine" ADD CONSTRAINT "RwaLine_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalSnapshot" ADD CONSTRAINT "CapitalSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
