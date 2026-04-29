-- AlterTable
ALTER TABLE "IntegrationCredential" ADD COLUMN     "autosyncEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastScheduledRunAt" TIMESTAMP(3),
ADD COLUMN     "leaseUntil" TIMESTAMP(3),
ADD COLUMN     "nextScheduledAt" TIMESTAMP(3),
ADD COLUMN     "scheduleIntervalMs" INTEGER;

-- CreateIndex
CREATE INDEX "IntegrationCredential_nextScheduledAt_idx" ON "IntegrationCredential"("nextScheduledAt");
