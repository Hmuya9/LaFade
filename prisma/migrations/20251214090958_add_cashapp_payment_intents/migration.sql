-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cashAppIntentId" TEXT;

-- CreateTable
CREATE TABLE "CashAppPaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "noteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CashAppPaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashAppPaymentIntent_userId_status_idx" ON "CashAppPaymentIntent"("userId", "status");

-- AddForeignKey
ALTER TABLE "CashAppPaymentIntent" ADD CONSTRAINT "CashAppPaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
