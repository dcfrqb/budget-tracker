-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "cardLast4" TEXT[] DEFAULT ARRAY[]::TEXT[];
