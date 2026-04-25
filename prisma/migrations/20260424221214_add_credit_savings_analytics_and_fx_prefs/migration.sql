-- CreateEnum
CREATE TYPE "SavingsCapitalization" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "AccountKind" ADD VALUE 'CREDIT';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "creditLimit" DECIMAL(28,10),
ADD COLUMN     "creditRatePct" DECIMAL(6,3),
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "includeInAnalytics" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minPaymentFixed" DECIMAL(28,10),
ADD COLUMN     "minPaymentPercent" DECIMAL(5,2),
ADD COLUMN     "savingsCapitalization" "SavingsCapitalization",
ADD COLUMN     "statementDay" INTEGER,
ADD COLUMN     "withdrawalLimit" DECIMAL(28,10);

-- AlterTable
ALTER TABLE "BudgetSettings" ADD COLUMN     "shownFxPairs" TEXT[] DEFAULT ARRAY[]::TEXT[];
