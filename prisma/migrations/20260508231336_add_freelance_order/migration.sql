-- CreateEnum
CREATE TYPE "FreelanceOrderStatus" AS ENUM ('ACTIVE', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FreelanceOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workSourceId" TEXT NOT NULL,
    "client" TEXT,
    "amount" DECIMAL(28,10) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "hours" DECIMAL(10,2),
    "hourlyRate" DECIMAL(28,10),
    "tipsAmount" DECIMAL(28,10),
    "status" "FreelanceOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "performedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelanceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreelanceOrder_userId_idx" ON "FreelanceOrder"("userId");

-- CreateIndex
CREATE INDEX "FreelanceOrder_workSourceId_idx" ON "FreelanceOrder"("workSourceId");

-- AddForeignKey
ALTER TABLE "FreelanceOrder" ADD CONSTRAINT "FreelanceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceOrder" ADD CONSTRAINT "FreelanceOrder_workSourceId_fkey" FOREIGN KEY ("workSourceId") REFERENCES "WorkSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceOrder" ADD CONSTRAINT "FreelanceOrder_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
