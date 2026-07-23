-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE', 'APPLE');

-- AlterTable: relax Stripe NOT NULL, add provider + Apple columns
ALTER TABLE "Subscription"
    ADD COLUMN "provider" "SubscriptionProvider" NOT NULL DEFAULT 'STRIPE',
    ADD COLUMN "appleOriginalTransactionId" TEXT,
    ADD COLUMN "appleProductId" TEXT,
    ADD COLUMN "appleEnvironment" TEXT,
    ADD COLUMN "appleAutoRenewStatus" BOOLEAN,
    ADD COLUMN "appleExpirationIntent" INTEGER,
    ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL,
    ALTER COLUMN "stripePriceId" DROP NOT NULL;

-- Multiple NULLs allowed in a unique B-tree index (default Postgres semantics);
-- do not use NULLS NOT DISTINCT here.
CREATE UNIQUE INDEX "Subscription_appleOriginalTransactionId_key"
    ON "Subscription" ("appleOriginalTransactionId");

CREATE INDEX "Subscription_provider_idx" ON "Subscription" ("provider");
