-- CreateTable
CREATE TABLE "TickerPerformance" (
    "id" TEXT NOT NULL,
    "validatedTickerId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "detectionPrice" DOUBLE PRECISION NOT NULL,
    "price1d" DOUBLE PRECISION,
    "price3d" DOUBLE PRECISION,
    "price7d" DOUBLE PRECISION,
    "price30d" DOUBLE PRECISION,
    "return1d" DOUBLE PRECISION,
    "return3d" DOUBLE PRECISION,
    "return7d" DOUBLE PRECISION,
    "return30d" DOUBLE PRECISION,
    "snapped1dAt" TIMESTAMP(3),
    "snapped3dAt" TIMESTAMP(3),
    "snapped7dAt" TIMESTAMP(3),
    "snapped30dAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TickerPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TickerPerformance_validatedTickerId_key" ON "TickerPerformance"("validatedTickerId");

-- CreateIndex
CREATE INDEX "TickerPerformance_symbol_idx" ON "TickerPerformance"("symbol");

-- AddForeignKey
ALTER TABLE "TickerPerformance" ADD CONSTRAINT "TickerPerformance_validatedTickerId_fkey" FOREIGN KEY ("validatedTickerId") REFERENCES "ValidatedTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
