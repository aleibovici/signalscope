-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('REDDIT', 'STOCKTWITS', 'SEC_INSIDER', 'OPTIONS_FLOW');

-- CreateEnum
CREATE TYPE "TickerStage" AS ENUM ('EARLY', 'FORMING', 'CONFIRMED', 'FILTERED');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "validatedCount" INTEGER NOT NULL DEFAULT 0,
    "filteredCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "source" "SignalSource" NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "url" TEXT,
    "author" TEXT,
    "authorAge" INTEGER,
    "authorKarma" INTEGER,
    "upvotes" INTEGER,
    "commentCount" INTEGER,
    "velocityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentiment" TEXT,
    "pndFlagged" BOOLEAN NOT NULL DEFAULT false,
    "pndFlags" TEXT[],
    "pndScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidatedTicker" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "marketCap" DOUBLE PRECISION,
    "shortFloat" DOUBLE PRECISION,
    "catalyst" TEXT,
    "risks" TEXT,
    "recommendation" TEXT,
    "report" TEXT,
    "aiScore" INTEGER NOT NULL DEFAULT 0,
    "stage" "TickerStage" NOT NULL DEFAULT 'EARLY',
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "avgSentiment" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidatedTicker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Signal_scanId_symbol_idx" ON "Signal"("scanId", "symbol");

-- CreateIndex
CREATE INDEX "Signal_symbol_idx" ON "Signal"("symbol");

-- CreateIndex
CREATE INDEX "ValidatedTicker_symbol_idx" ON "ValidatedTicker"("symbol");

-- CreateIndex
CREATE INDEX "ValidatedTicker_stage_idx" ON "ValidatedTicker"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "ValidatedTicker_scanId_symbol_key" ON "ValidatedTicker"("scanId", "symbol");

-- CreateIndex
CREATE INDEX "UserPosition_userId_status_idx" ON "UserPosition"("userId", "status");

-- CreateIndex
CREATE INDEX "UserPosition_symbol_idx" ON "UserPosition"("symbol");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidatedTicker" ADD CONSTRAINT "ValidatedTicker_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPosition" ADD CONSTRAINT "UserPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
