-- AlterTable
ALTER TABLE "IntegrationCredential" ADD COLUMN     "keyVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "IntegrationSyncLog" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "rowsCreated" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorClass" TEXT,

    CONSTRAINT "IntegrationSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_credentialId_startedAt_idx" ON "IntegrationSyncLog"("credentialId", "startedAt");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_startedAt_idx" ON "IntegrationSyncLog"("startedAt");

-- AddForeignKey
ALTER TABLE "IntegrationSyncLog" ADD CONSTRAINT "IntegrationSyncLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "IntegrationCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
