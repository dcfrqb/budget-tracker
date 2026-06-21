-- CreateTable
CREATE TABLE "DismissedSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalKey" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissUntil" TIMESTAMP(3),

    CONSTRAINT "DismissedSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DismissedSignal_userId_idx" ON "DismissedSignal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DismissedSignal_userId_signalKey_key" ON "DismissedSignal"("userId", "signalKey");

-- AddForeignKey
ALTER TABLE "DismissedSignal" ADD CONSTRAINT "DismissedSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
