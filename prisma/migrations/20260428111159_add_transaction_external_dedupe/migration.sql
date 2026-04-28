-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_source_externalId_key" ON "Transaction"("accountId", "source", "externalId");
