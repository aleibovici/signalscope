-- AlterTable
ALTER TABLE "ValidatedTicker" ADD COLUMN     "firstSeenDaysAgo" INTEGER,
ADD COLUMN     "priorAppearances" INTEGER NOT NULL DEFAULT 0;
