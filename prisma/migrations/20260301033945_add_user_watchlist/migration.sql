-- CreateTable
CREATE TABLE "UserWatchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWatchlist_userId_idx" ON "UserWatchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWatchlist_userId_symbol_key" ON "UserWatchlist"("userId", "symbol");

-- AddForeignKey
ALTER TABLE "UserWatchlist" ADD CONSTRAINT "UserWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
