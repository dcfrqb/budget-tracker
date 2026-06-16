/*
  Warnings:

  - Added the required column `title` to the `FreelanceOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FreelanceOrderStageStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable: Add columns (title nullable first, then backfill, then set NOT NULL)
ALTER TABLE "FreelanceOrder" ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT;

-- Backfill title with COALESCE(client, 'Заказ')
UPDATE "FreelanceOrder" SET "title" = COALESCE("client", 'Заказ');

-- Set title to NOT NULL
ALTER TABLE "FreelanceOrder" ALTER COLUMN "title" SET NOT NULL;

-- CreateTable
CREATE TABLE "FreelanceOrderStage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freelanceOrderId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expectedAmount" DECIMAL(28,10) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "FreelanceOrderStageStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(28,10),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelanceOrderStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreelanceOrderStage_transactionId_key" ON "FreelanceOrderStage"("transactionId");

-- CreateIndex
CREATE INDEX "FreelanceOrderStage_userId_idx" ON "FreelanceOrderStage"("userId");

-- CreateIndex
CREATE INDEX "FreelanceOrderStage_freelanceOrderId_idx" ON "FreelanceOrderStage"("freelanceOrderId");

-- AddForeignKey
ALTER TABLE "FreelanceOrderStage" ADD CONSTRAINT "FreelanceOrderStage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceOrderStage" ADD CONSTRAINT "FreelanceOrderStage_freelanceOrderId_fkey" FOREIGN KEY ("freelanceOrderId") REFERENCES "FreelanceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceOrderStage" ADD CONSTRAINT "FreelanceOrderStage_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceOrderStage" ADD CONSTRAINT "FreelanceOrderStage_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
