-- CreateIndex
CREATE INDEX "ValidatedTicker_symbol_createdAt_idx" ON "ValidatedTicker"("symbol", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ValidatedTicker_scanId_stage_createdAt_idx" ON "ValidatedTicker"("scanId", "stage", "createdAt");
