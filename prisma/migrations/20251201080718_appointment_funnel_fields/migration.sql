-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('TRIAL_FREE', 'DISCOUNT_SECOND', 'MEMBERSHIP_INCLUDED', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "AppointmentPaymentMethod" AS ENUM ('STRIPE', 'CASH_APP', 'OTHER');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "kind" "AppointmentKind" DEFAULT 'ONE_OFF',
ADD COLUMN     "paidVia" "AppointmentPaymentMethod",
ADD COLUMN     "priceCents" INTEGER;
