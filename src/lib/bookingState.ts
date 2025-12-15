import { prisma } from "@/lib/db";
import dayjs from "dayjs";

export type BookingState =
  | { type: "FIRST_FREE" }
  | { type: "SECOND_DISCOUNT"; discountCents: number; deadline: Date }
  | { type: "MEMBERSHIP_INCLUDED"; remainingCutsThisPeriod: number; planName: string }
  | { type: "ONE_OFF" };

/**
 * Determines the booking state for a client based on their appointment and subscription history.
 * This is used to decide which pricing/payment flow applies when booking.
 * 
 * Rules:
 * - FIRST_FREE: No non-canceled TRIAL_FREE appointment exists
 * - SECOND_DISCOUNT: Has non-canceled TRIAL_FREE, no non-canceled DISCOUNT_SECOND, within 10-day window
 * - MEMBERSHIP_INCLUDED: Has active subscription (TRIAL or ACTIVE status)
 * - ONE_OFF: None of the above (regular paid booking)
 */
export async function getBookingState(clientId: string): Promise<BookingState> {
  // Fetch all non-canceled appointments for this client
  const appointments = await prisma.appointment.findMany({
    where: {
      clientId,
      status: { not: "CANCELED" },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      kind: true,
      status: true,
      startAt: true,
      priceCents: true,
    },
  });

  // Check for free trial cut (using same logic as client-funnel.ts)
  const hasFreeCut = appointments.some((appt) => {
    if (appt.status === "CANCELED") return false;
    if (appt.kind === "TRIAL_FREE") return true;
    if (appt.priceCents === 0 && appt.kind !== null) return true;
    return false;
  });

  // Check for second-cut promo (non-canceled DISCOUNT_SECOND)
  const hasSecondCut = appointments.some(
    (appt) => appt.kind === "DISCOUNT_SECOND" && appt.status !== "CANCELED"
  );

  // Find the most recent completed free cut to calculate deadline
  // We need a COMPLETED free cut to calculate the 10-day window
  const completedFreeCut = appointments
    .filter((appt) => {
      if (appt.status !== "COMPLETED") return false;
      if (appt.kind === "TRIAL_FREE") return true;
      if (appt.priceCents === 0 && appt.kind !== null) return true;
      return false;
    })
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0];

  // Check for active membership - MUST be checked FIRST (highest priority)
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId: clientId,
      status: { in: ["TRIAL", "ACTIVE"] },
    },
    include: {
      plan: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { renewsAt: "desc" },
  });

  const hasActiveMembership = subscriptions.length > 0;

  // Determine state (priority order: MEMBERSHIP > SECOND_DISCOUNT > FIRST_FREE > ONE_OFF)
  if (hasActiveMembership) {
    // MEMBERSHIP_INCLUDED: Client has active subscription
    // Use the most recent subscription for plan name
    const activeSubscription = subscriptions[0];
    return {
      type: "MEMBERSHIP_INCLUDED",
      remainingCutsThisPeriod: 1, // At least 1 cut available (can be enhanced later with actual usage tracking)
      planName: activeSubscription.plan?.name || "Standard",
    };
  }

  if (hasFreeCut && !hasSecondCut && completedFreeCut) {
    // SECOND_DISCOUNT: Has free cut, no second cut yet, and we have a completed free cut to calculate deadline
    const deadline = dayjs(completedFreeCut.startAt).add(10, "days").toDate();
    const now = new Date();
    
    // Only return SECOND_DISCOUNT if within the 10-day window
    if (now < deadline) {
      return {
        type: "SECOND_DISCOUNT",
        discountCents: 1000, // $10 second cut
        deadline,
      };
    }
  }

  if (!hasFreeCut) {
    // FIRST_FREE: No free cut yet
    return { type: "FIRST_FREE" };
  }

  // ONE_OFF: Default case (has free cut, either used second cut or window expired, no active membership)
  return { type: "ONE_OFF" };
}

