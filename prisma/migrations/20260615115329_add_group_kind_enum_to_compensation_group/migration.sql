-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('COMPENSATION', 'MERGE');

-- AlterTable
ALTER TABLE "CompensationGroup" ADD COLUMN     "kind" "GroupKind" NOT NULL DEFAULT 'COMPENSATION';
