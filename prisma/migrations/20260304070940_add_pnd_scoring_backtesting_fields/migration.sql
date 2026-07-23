-- AlterTable
ALTER TABLE "ValidatedTicker" ADD COLUMN     "pndAiConfidence" INTEGER,
ADD COLUMN     "pndAiReasoning" TEXT,
ADD COLUMN     "pndFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pndFlags" TEXT[],
ADD COLUMN     "pndScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rawAiScore" INTEGER;
