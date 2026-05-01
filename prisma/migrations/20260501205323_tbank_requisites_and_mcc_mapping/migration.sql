-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "correspondentAccount" TEXT,
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "kpp" TEXT,
ADD COLUMN     "paymentDueDay" INTEGER;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "mccCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
