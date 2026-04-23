-- CreateEnum
CREATE TYPE "BrokerOrderRole" AS ENUM ('PARENT', 'STOP', 'TARGET', 'EXIT_TIMEOUT');

-- CreateTable
CREATE TABLE "BrokerOrder" (
    "id" TEXT NOT NULL,
    "validatedTickerId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "conid" INTEGER NOT NULL DEFAULT 0,
    "role" "BrokerOrderRole" NOT NULL,
    "parentOrderId" TEXT,
    "orderType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "limitPrice" DOUBLE PRECISION,
    "stopPrice" DOUBLE PRECISION,
    "cOID" TEXT,
    "brokerOrderId" TEXT,
    "ibkrOrderId" INTEGER,
    "ibkrStatus" TEXT NOT NULL DEFAULT 'PendingSubmit',
    "filledQty" INTEGER NOT NULL DEFAULT 0,
    "avgFillPrice" DOUBLE PRECISION,
    "provider" TEXT NOT NULL DEFAULT 'alpaca',
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "BrokerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerPosition" (
    "symbol" TEXT NOT NULL,
    "conid" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "avgCost" DOUBLE PRECISION NOT NULL,
    "marketPrice" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "unrealizedPnl" DOUBLE PRECISION,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'alpaca',

    CONSTRAINT "BrokerPosition_pkey" PRIMARY KEY ("symbol")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerOrder_cOID_key" ON "BrokerOrder"("cOID");

-- CreateIndex
CREATE INDEX "BrokerOrder_validatedTickerId_idx" ON "BrokerOrder"("validatedTickerId");

-- CreateIndex
CREATE INDEX "BrokerOrder_symbol_ibkrStatus_idx" ON "BrokerOrder"("symbol", "ibkrStatus");

-- CreateIndex
CREATE INDEX "BrokerOrder_role_ibkrStatus_idx" ON "BrokerOrder"("role", "ibkrStatus");

-- CreateIndex
CREATE INDEX "BrokerOrder_placedAt_idx" ON "BrokerOrder"("placedAt");

-- CreateIndex
CREATE INDEX "BrokerPosition_closedAt_idx" ON "BrokerPosition"("closedAt");

-- CreateIndex
CREATE INDEX "BrokerPosition_provider_idx" ON "BrokerPosition"("provider");

-- AddForeignKey
ALTER TABLE "BrokerOrder" ADD CONSTRAINT "BrokerOrder_validatedTickerId_fkey" FOREIGN KEY ("validatedTickerId") REFERENCES "ValidatedTicker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
