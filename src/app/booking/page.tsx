import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { BookingForm } from "./_components/BookingForm";
import { laf } from "@/components/ui/lafadeStyles";
// Business rules source of truth
import { COPY, ONE_FREE_CUT_PER_USER, SECOND_CUT_PRICE_CENTS, MEMBERSHIP_STANDARD_PRICE_CENTS } from "@/lib/lafadeBusiness";

// V1 Launch Safety: Only allow these two real barbers
const REAL_BARBER_IDS = [
  "cmihqddi20001vw3oyt77w4uv",
  "cmj6jzd1j0000vw8ozlyw14o9",
];

async function getDefaultBarberId(): Promise<string | undefined> {
  const barberEmail = env.BARBER_EMAIL?.toLowerCase() ?? null;

  let defaultBarberId: string | null = null;

  if (barberEmail) {
    const barberByEmail = await prisma.user.findFirst({
      where: {
        email: barberEmail,
        role: "BARBER",
        id: { in: REAL_BARBER_IDS },
      },
      select: { id: true },
    });

    if (barberByEmail) {
      defaultBarberId = barberByEmail.id;
    }
  }

  // Fallback: first BARBER user if BARBER_EMAIL not set or lookup fails (exclude OWNER)
  if (!defaultBarberId) {
    const barberByRole = await prisma.user.findFirst({
      where: { 
        role: "BARBER",
        NOT: { role: "OWNER" },
        id: { in: REAL_BARBER_IDS },
      },
      select: { id: true },
    });

    if (barberByRole) {
      defaultBarberId = barberByRole.id;
    }
  }

  return defaultBarberId ?? undefined;
}

export const dynamic = 'force-dynamic';

export default async function BookingPage() {
  // Booking page is public - no server-side redirects
  // Auth checks happen client-side in BookingForm component
  // This prevents Safari redirect loops
  const session = await auth();
  const user = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          role: true,
        },
      })
    : null;

  // Query DB for funnel truth (only if user is logged in)
  const hasFreeCutBookedOrCompleted = user
    ? await prisma.appointment.findFirst({
        where: {
          clientId: user.id,
          kind: "TRIAL_FREE",
          status: { not: "CANCELED" },
        },
      }).then(appt => !!appt)
    : false;

  const hasSecondCutBookedOrCompleted = user
    ? await prisma.appointment.findFirst({
        where: {
          clientId: user.id,
          kind: "DISCOUNT_SECOND",
          status: { not: "CANCELED" },
        },
      }).then(appt => !!appt)
    : false;

  // Check for active membership (Subscription with ACTIVE or TRIAL status)
  const activeSubscription = user
    ? await prisma.subscription.findFirst({
        where: {
          userId: user.id,
          status: { in: ["ACTIVE", "TRIAL"] },
        },
        include: {
          plan: true,
        },
        orderBy: {
          startDate: "desc",
        },
      })
    : null;

  const hasActiveMembership = !!activeSubscription;

  // Calculate membership usage (reuse logic from /account)
  let membershipUsage: { cutsAllowed: number; cutsUsed: number; cutsRemaining: number } | null = null;

  if (activeSubscription && activeSubscription.plan?.cutsPerMonth && activeSubscription.plan.cutsPerMonth > 0) {
    const cutsAllowed = activeSubscription.plan.cutsPerMonth;
    const periodStart = activeSubscription.startDate;
    const periodEnd = activeSubscription.renewsAt ?? (() => {
      const end = new Date(periodStart);
      end.setMonth(end.getMonth() + 1);
      return end;
    })();

    const cutsUsed = await prisma.appointment.count({
      where: {
        clientId: user!.id,
        kind: "MEMBERSHIP_INCLUDED",
        status: { in: ["BOOKED", "COMPLETED", "CONFIRMED"] },
        startAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    });

    const cutsRemaining = Math.max(cutsAllowed - cutsUsed, 0);
    membershipUsage = { cutsAllowed, cutsUsed, cutsRemaining };
  }

  // Compute bookingState based on DB truth
  let bookingState: 
    | { type: "FIRST_FREE" }
    | { type: "MEMBERSHIP_INCLUDED"; remainingCutsThisPeriod: number; planName?: string }
    | { type: "ONE_OFF" };

  if (hasActiveMembership && membershipUsage) {
    bookingState = {
      type: "MEMBERSHIP_INCLUDED",
      remainingCutsThisPeriod: membershipUsage.cutsRemaining,
      planName: activeSubscription?.plan?.name || undefined,
    };
  } else if (!hasFreeCutBookedOrCompleted) {
    bookingState = { type: "FIRST_FREE" };
  } else {
    bookingState = { type: "ONE_OFF" };
  }

  const defaultBarberId = await getDefaultBarberId();

  return (
    <div className={`${laf.page} ${laf.texture}`}>
      <div className={laf.container}>
        <BookingForm
          defaultBarberId={defaultBarberId}
          bookingState={bookingState}
          hasFreeCutBookedOrCompleted={hasFreeCutBookedOrCompleted}
          hasActiveMembership={hasActiveMembership}
          membershipUsage={membershipUsage}
        />
      </div>
    </div>
  );
}
