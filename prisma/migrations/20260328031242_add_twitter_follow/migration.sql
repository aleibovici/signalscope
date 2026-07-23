-- CreateTable
CREATE TABLE "TwitterFollow" (
    "id" TEXT NOT NULL,
    "twitterId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "followedAt" TIMESTAMP(3),
    "unfollowedAt" TIMESTAMP(3),
    "followBack" BOOLEAN NOT NULL DEFAULT false,
    "keep" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitterFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitterFollow_twitterId_key" ON "TwitterFollow"("twitterId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitterFollow_username_key" ON "TwitterFollow"("username");

-- CreateIndex
CREATE INDEX "TwitterFollow_followedAt_idx" ON "TwitterFollow"("followedAt");

-- CreateIndex
CREATE INDEX "TwitterFollow_source_idx" ON "TwitterFollow"("source");

-- CreateIndex
CREATE INDEX "TwitterFollow_priority_idx" ON "TwitterFollow"("priority" DESC);
