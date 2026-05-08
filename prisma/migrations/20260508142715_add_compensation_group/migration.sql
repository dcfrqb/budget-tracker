-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "compensationGroupId" TEXT;

-- CreateTable
CREATE TABLE "CompensationGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mainTxnId" TEXT NOT NULL,
    "nettoBase" DECIMAL(28,10) NOT NULL,
    "nettoSign" INTEGER NOT NULL,
    "baseCcy" TEXT NOT NULL,
    "categoryIdForAggregation" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompensationGroup_mainTxnId_key" ON "CompensationGroup"("mainTxnId");

-- CreateIndex
CREATE INDEX "CompensationGroup_userId_occurredAt_idx" ON "CompensationGroup"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_compensationGroupId_idx" ON "Transaction"("compensationGroupId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_compensationGroupId_fkey" FOREIGN KEY ("compensationGroupId") REFERENCES "CompensationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationGroup" ADD CONSTRAINT "CompensationGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationGroup" ADD CONSTRAINT "CompensationGroup_mainTxnId_fkey" FOREIGN KEY ("mainTxnId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationGroup" ADD CONSTRAINT "CompensationGroup_categoryIdForAggregation_fkey" FOREIGN KEY ("categoryIdForAggregation") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
