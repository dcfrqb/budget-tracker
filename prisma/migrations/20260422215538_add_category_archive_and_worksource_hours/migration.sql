-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkSource" ADD COLUMN     "hoursPerMonth" INTEGER;

-- CreateIndex
CREATE INDEX "Category_userId_archivedAt_idx" ON "Category"("userId", "archivedAt");
