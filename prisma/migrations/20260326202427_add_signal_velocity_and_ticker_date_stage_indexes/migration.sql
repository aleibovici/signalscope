-- CreateIndex
CREATE INDEX "Signal_scanId_velocityScore_idx" ON "Signal"("scanId", "velocityScore" DESC);

-- CreateIndex
CREATE INDEX "ValidatedTicker_createdAt_stage_idx" ON "ValidatedTicker"("createdAt" DESC, "stage");
