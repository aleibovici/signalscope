-- DropIndex
DROP INDEX "ApiKey_key_idx";

-- DropIndex
DROP INDEX "ApiKey_userId_idx";

-- CreateIndex
CREATE INDEX "ApiKey_userId_revokedAt_idx" ON "ApiKey"("userId", "revokedAt");
