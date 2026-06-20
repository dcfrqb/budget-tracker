-- CreateTable
CREATE TABLE "SubscriptionDuplicateDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subAId" TEXT NOT NULL,
    "subBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionDuplicateDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionDuplicateDismissal_userId_idx" ON "SubscriptionDuplicateDismissal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionDuplicateDismissal_userId_subAId_subBId_key" ON "SubscriptionDuplicateDismissal"("userId", "subAId", "subBId");

-- AddForeignKey
ALTER TABLE "SubscriptionDuplicateDismissal" ADD CONSTRAINT "SubscriptionDuplicateDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
