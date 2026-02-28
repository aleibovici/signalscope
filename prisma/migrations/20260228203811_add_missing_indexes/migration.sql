-- CreateIndex
CREATE INDEX "Scan_startedAt_idx" ON "Scan"("startedAt");

-- CreateIndex
CREATE INDEX "Scan_status_idx" ON "Scan"("status");

-- CreateIndex
CREATE INDEX "TickerPerformance_createdAt_idx" ON "TickerPerformance"("createdAt");

-- CreateIndex
CREATE INDEX "ValidatedTicker_createdAt_idx" ON "ValidatedTicker"("createdAt");
