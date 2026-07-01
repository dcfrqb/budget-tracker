-- AlterEnum
ALTER TYPE "BusinessEntryType" ADD VALUE 'EXPENSE';

-- CreateTable
CREATE TABLE "BusinessAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DECIMAL(28,10) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "entryType" "BusinessEntryType" NOT NULL,
    "streamKey" TEXT,
    "tariff" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessAllocation_businessId_idx" ON "BusinessAllocation"("businessId");

-- CreateIndex
CREATE INDEX "BusinessAllocation_businessId_occurredAt_idx" ON "BusinessAllocation"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "BusinessAllocation_transactionId_idx" ON "BusinessAllocation"("transactionId");

-- AddForeignKey
ALTER TABLE "BusinessAllocation" ADD CONSTRAINT "BusinessAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAllocation" ADD CONSTRAINT "BusinessAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAllocation" ADD CONSTRAINT "BusinessAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAllocation" ADD CONSTRAINT "BusinessAllocation_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
