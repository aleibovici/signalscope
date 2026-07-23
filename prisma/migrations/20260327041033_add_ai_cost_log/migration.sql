-- CreateTable
CREATE TABLE "AiCostLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callPoint" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "scanId" TEXT,
    "symbol" TEXT,
    "userId" TEXT,

    CONSTRAINT "AiCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCostLog_createdAt_idx" ON "AiCostLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiCostLog_scanId_idx" ON "AiCostLog"("scanId");

-- CreateIndex
CREATE INDEX "AiCostLog_trigger_createdAt_idx" ON "AiCostLog"("trigger", "createdAt");

-- CreateIndex
CREATE INDEX "AiCostLog_callPoint_createdAt_idx" ON "AiCostLog"("callPoint", "createdAt");
