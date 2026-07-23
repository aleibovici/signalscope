-- AlterTable
ALTER TABLE "Signal" ADD COLUMN "netPremium" DOUBLE PRECISION,
ADD COLUMN "callPremiumRatio" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ValidatedTicker" ADD COLUMN "netPremium" DOUBLE PRECISION,
ADD COLUMN "callPremiumRatio" DOUBLE PRECISION;
