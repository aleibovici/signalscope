-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "followerCount" INTEGER,
ADD COLUMN     "insiderTitle" TEXT,
ADD COLUMN     "likeCount" INTEGER,
ADD COLUMN     "postAge" DOUBLE PRECISION,
ADD COLUMN     "purchaseValue" DOUBLE PRECISION,
ADD COLUMN     "retweetCount" INTEGER,
ADD COLUMN     "sortType" TEXT,
ADD COLUMN     "subreddit" TEXT,
ADD COLUMN     "tweetType" TEXT,
ADD COLUMN     "volumeRatio" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ValidatedTicker" ADD COLUMN     "aiReasoning" TEXT,
ADD COLUMN     "avgVelocity" DOUBLE PRECISION,
ADD COLUMN     "commentDerivedCount" INTEGER,
ADD COLUMN     "floatShares" DOUBLE PRECISION,
ADD COLUMN     "freshCount" INTEGER,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "recentCount" INTEGER,
ADD COLUMN     "risingCount" INTEGER,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "staleCount" INTEGER,
ADD COLUMN     "subredditCount" INTEGER,
ADD COLUMN     "totalComments" INTEGER,
ADD COLUMN     "totalUpvotes" INTEGER,
ADD COLUMN     "weightedSourceScore" DOUBLE PRECISION;
