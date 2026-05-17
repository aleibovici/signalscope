-- AlterTable
ALTER TABLE "TickerPerformance" ADD COLUMN     "price14d" DOUBLE PRECISION,
ADD COLUMN     "return14d" DOUBLE PRECISION,
ADD COLUMN     "snapped14dAt" TIMESTAMP(3);
