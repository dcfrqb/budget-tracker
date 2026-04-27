-- CreateTable
CREATE TABLE "IntegrationAccountLink" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationAccountLink_accountId_idx" ON "IntegrationAccountLink"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccountLink_credentialId_externalAccountId_key" ON "IntegrationAccountLink"("credentialId", "externalAccountId");

-- AddForeignKey
ALTER TABLE "IntegrationAccountLink" ADD CONSTRAINT "IntegrationAccountLink_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "IntegrationCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccountLink" ADD CONSTRAINT "IntegrationAccountLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
