-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "autoMatch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVariablePrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "subscriptionLinkSource" TEXT;
