-- AlterTable: drop unused IBKR conid columns (Alpaca uses symbol strings, not contract IDs)
ALTER TABLE "BrokerOrder" DROP COLUMN "conid";

-- AlterTable
ALTER TABLE "BrokerPosition" DROP COLUMN "conid";
