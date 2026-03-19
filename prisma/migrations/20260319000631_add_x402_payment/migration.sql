-- CreateTable
CREATE TABLE "X402Payment" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "amountUsd" TEXT NOT NULL,
    "payerAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "X402Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "X402Payment_createdAt_idx" ON "X402Payment"("createdAt");

-- CreateIndex
CREATE INDEX "X402Payment_endpoint_idx" ON "X402Payment"("endpoint");
