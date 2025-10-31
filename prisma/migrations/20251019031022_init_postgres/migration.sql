-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CLIENT', 'BARBER', 'OWNER');

-- CreateEnum
CREATE TYPE "public"."SubStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ApptType" AS ENUM ('SHOP', 'HOME');

-- CreateEnum
CREATE TYPE "public"."ApptStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PaymentKind" AS ENUM ('SUBSCRIPTION', 'ONEOFF', 'REFUND');

-- CreateEnum
CREATE TYPE "public"."PromoKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CLIENT',
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "clerkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "cutsPerMonth" INTEGER NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "stripePriceId" TEXT NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "public"."SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMP(3) NOT NULL,
    "stripeSubId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "type" "public"."ApptType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ApptStatus" NOT NULL DEFAULT 'BOOKED',
    "address" TEXT,
    "notes" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payout" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "deluxeBonusAmount" INTEGER NOT NULL,
    "tips" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" "public"."PaymentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "public"."PromoKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "maxRedemptions" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Availability" (
    "id" SERIAL NOT NULL,
    "barberName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "public"."User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripePriceId_key" ON "public"."Plan"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubId_key" ON "public"."Subscription"("stripeSubId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_idempotencyKey_key" ON "public"."Appointment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Appointment_barberId_startAt_idx" ON "public"."Appointment"("barberId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_barberId_startAt_key" ON "public"."Appointment"("barberId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_clientId_startAt_key" ON "public"."Appointment"("clientId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON "public"."Payment"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "public"."PromoCode"("code");

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payout" ADD CONSTRAINT "Payout_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
