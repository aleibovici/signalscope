-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "validatedTickerId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_validatedTickerId_createdAt_idx" ON "PriceSnapshot"("validatedTickerId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceSnapshot_symbol_createdAt_idx" ON "PriceSnapshot"("symbol", "createdAt");

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_validatedTickerId_fkey" FOREIGN KEY ("validatedTickerId") REFERENCES "ValidatedTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
