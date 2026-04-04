-- CreateTable: XApiLog (tracks X/Twitter API usage)
CREATE TABLE IF NOT EXISTS "XApiLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "statusCode" INTEGER,
    CONSTRAINT "XApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XApiLog_createdAt_idx" ON "XApiLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XApiLog_action_createdAt_idx" ON "XApiLog"("action", "createdAt");

-- DropIndex: redundant — covered by @unique constraint on ApiKey.key
DROP INDEX IF EXISTS "ApiKey_key_idx";

-- DropIndex: redundant — covered by @unique constraint on RefreshToken.token
DROP INDEX IF EXISTS "RefreshToken_token_idx";

-- DropIndex: redundant — covered by @unique constraint on PasswordResetToken.token
DROP INDEX IF EXISTS "PasswordResetToken_token_idx";
