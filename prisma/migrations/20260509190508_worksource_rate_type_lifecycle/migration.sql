-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('HOURLY', 'MONTHLY', 'PER_TASK', 'DAILY', 'COMMISSION_PCT');

-- AlterTable
ALTER TABLE "WorkSource" DROP COLUMN "baseAmount",
DROP COLUMN "hourlyRate",
ADD COLUMN "rateType" "RateType",
ADD COLUMN "rateAmount" numeric(28,10),
ADD COLUMN "premiumAmount" numeric(28,10),
ADD COLUMN "premiumNote" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "endedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkSource_userId_isActive_idx" ON "WorkSource"("userId", "isActive");
