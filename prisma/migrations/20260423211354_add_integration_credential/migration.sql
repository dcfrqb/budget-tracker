-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'NEEDS_OTP', 'ERROR');

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "displayLabel" TEXT,
    "encryptedPayload" TEXT NOT NULL,
    "encryptionIv" TEXT NOT NULL,
    "encryptionTag" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationCredential_userId_adapterId_idx" ON "IntegrationCredential"("userId", "adapterId");

-- CreateIndex
CREATE INDEX "IntegrationCredential_userId_status_idx" ON "IntegrationCredential"("userId", "status");

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
