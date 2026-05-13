-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "freelanceOrderId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_freelanceOrderId_idx" ON "Transaction"("freelanceOrderId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_freelanceOrderId_fkey" FOREIGN KEY ("freelanceOrderId") REFERENCES "FreelanceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
