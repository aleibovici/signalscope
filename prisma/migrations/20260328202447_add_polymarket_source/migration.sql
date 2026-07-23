-- AlterEnum
ALTER TYPE "SignalSource" ADD VALUE 'POLYMARKET';

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "marketEndDate" TEXT,
ADD COLUMN     "marketLiquidity" DOUBLE PRECISION,
ADD COLUMN     "marketProbability" DOUBLE PRECISION,
ADD COLUMN     "marketVolume24hr" DOUBLE PRECISION;
