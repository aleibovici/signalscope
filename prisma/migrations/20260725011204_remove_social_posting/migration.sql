/*
  Warnings:

  - You are about to drop the column `performanceTweetedAt` on the `TickerPerformance` table. All the data in the column will be lost.
  - You are about to drop the column `shareRewardClaimedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `TwitterFollow` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "TickerPerformance" DROP COLUMN "performanceTweetedAt";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "shareRewardClaimedAt";

-- DropTable
DROP TABLE "TwitterFollow";
