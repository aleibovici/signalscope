-- AlterTable
ALTER TABLE "ValidatedTicker" ADD COLUMN     "tradeSetupConfidence" TEXT,
ADD COLUMN     "tradeSetupEntryHi" DOUBLE PRECISION,
ADD COLUMN     "tradeSetupEntryLo" DOUBLE PRECISION,
ADD COLUMN     "tradeSetupRiskReward" TEXT,
ADD COLUMN     "tradeSetupStopLoss" DOUBLE PRECISION,
ADD COLUMN     "tradeSetupTarget1" DOUBLE PRECISION,
ADD COLUMN     "tradeSetupTarget2" DOUBLE PRECISION,
ADD COLUMN     "tradeSetupTimeframe" TEXT;
