-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "reimbursementCurrency" TEXT,
ADD COLUMN     "reimbursementExpected" DECIMAL(28,10),
ADD COLUMN     "reimbursementFrom" TEXT;
