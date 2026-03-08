-- DropIndex
DROP INDEX "ApiKey_userId_revokedAt_idx";

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "Signal_symbol_source_idx" ON "Signal"("symbol", "source");
