import type { Appointment, Subscription, SubStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Helper to determine if an appointment represents a free trial cut.
 * This handles both current appointments (kind === "TRIAL_FREE") and legacy
 * appointments that may have been created before the kind field existed.
 * 
 * A free cut is detected if:
 * - status !== "CANCELED" AND
 * - (kind === "TRIAL_FREE" OR (priceCents === 0 AND kind IS NOT NULL))
 * 
 * Note: The "kind IS NOT NULL" check ensures we only catch legacy appointments
 * that have been assigned a kind (even if it's not TRIAL_FREE), avoiding
 * false positives from appointments with null kind that aren't free cuts.
 */
export function isFreeCutAppointment(appt: Appointment): boolean {
  if (appt.status === "CANCELED") {
    return false;
  }
  
  // Current logic: explicit TRIAL_FREE kind
  if (appt.kind === "TRIAL_FREE") {
    return true;
  }
  
  // Legacy logic: free appointments (priceCents === 0) that have a kind assigned
  // This catches old appointments that were free but may have kind = "ONE_OFF" or similar
  if (appt.priceCents === 0 && appt.kind !== null) {
    return true;
  }
  
  return false;
}

export type ClientFunnelStage =
  | "NEW"
  | "FREE_USED"
  | "SECOND_WINDOW"
  | "SECOND_USED"
  | "MEMBER";

export interface ClientFunnelInfo {
  stage: ClientFunnelStage;
  freeFirstAppointment?: Appointment | null;
  secondDiscountAppointment?: Appointment | null;
  secondWindowExpiresAt?: Date | null;
  hasSubscriptionTrial: boolean;
  hasActiveMembership: boolean;
  /**
   * Active subscription (if any) with plan details for displaying membership info.
   * This is the most recent subscription with status ACTIVE or TRIAL.
   */
  activeSubscription?: (Subscription & { plan: { name: string } | null }) | null;
  /**
   * True if the client has any non-canceled TRIAL_FREE appointment (past or future).
   * This is used to gate booking another free trial cut.
   *
   * Rules:
   * - Any appointment with kind === "TRIAL_FREE" and status !== "CANCELED" sets this to true.
   * - If *all* TRIAL_FREE appointments are canceled, this becomes false and the client
   *   may rebook another free cut.
   *
   * Note: This is intentionally separate from funnel stages, which are based on COMPLETED
   * TRIAL_FREE appointments only.
   */
  hasFreeCutBookedOrCompleted: boolean;
  /**
   * True if the client has any non-canceled DISCOUNT_SECOND appointment (past or future).
   * This is used to gate showing the "$10 second cut" promo card.
   *
   * Rules:
   * - Any appointment with kind === "DISCOUNT_SECOND" and status !== "CANCELED" sets this to true.
   * - If *all* DISCOUNT_SECOND appointments are canceled, this becomes false and the promo
   *   card may be shown again (if still in SECOND_WINDOW stage).
   *
   * Note: This is intentionally separate from funnel stages, which are based on COMPLETED
   * DISCOUNT_SECOND appointments only.
   */
  hasSecondCutBookedOrCompleted: boolean;
}

export function computeClientFunnel(
  appointments: Appointment[],
  subscriptions: (Subscription & { plan?: { name: string } | null })[]
): ClientFunnelInfo {
  // 1) Filter for active subscriptions (ACTIVE or TRIAL status)
  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "ACTIVE" || sub.status === "TRIAL"
  );
  
  // 2) Determine membership flags
  const hasActiveMembership = activeSubscriptions.length > 0;
  const hasSubscriptionTrial = activeSubscriptions.some(
    (sub) => sub.status === "TRIAL"
  );
  
  // 3) Get the most recent active subscription (for displaying plan name and renewal date)
  const activeSubscriptionRaw = activeSubscriptions.length > 0
    ? activeSubscriptions.sort((a, b) => b.renewsAt.getTime() - a.renewsAt.getTime())[0]
    : null;

  // Normalize activeSubscription to ensure plan is never undefined (must be { name: string } | null)
  const normalizedActiveSubscription = activeSubscriptionRaw
    ? { ...activeSubscriptionRaw, plan: activeSubscriptionRaw.plan ?? null }
    : undefined;

  // 2) Compute free-cut gating flag based on any non-canceled free cut appointment
  // Uses isFreeCutAppointment() helper to handle both current and legacy appointments
  const hasFreeCutBookedOrCompleted = appointments.some(isFreeCutAppointment);

  // 2b) Compute second-cut gating flag based on any non-canceled DISCOUNT_SECOND appointment
  const hasSecondCutBookedOrCompleted = appointments.some(
    (appt) => appt.kind === "DISCOUNT_SECOND" && appt.status !== "CANCELED"
  );

  // 3) Filter for completed appointments
  // Only completed appointments count toward funnel progression
  // (getClientFunnelForUser already filters out CANCELED appointments)
  const completedAppointments = appointments.filter(
    (appt) => appt.status === "COMPLETED"
  );

  // 4) Find the most recent completed free cut appointment
  // This represents when the client actually received their free cut
  // Uses isFreeCutAppointment() to handle both current and legacy appointments
  const freeFirstAppointment =
    completedAppointments
      .filter(isFreeCutAppointment)
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0] ?? null;

  // 5) Find the most recent completed DISCOUNT_SECOND appointment
  // This represents when the client used their $10 second-cut promo
  const secondDiscountAppointment =
    completedAppointments
      .filter((appt) => appt.kind === "DISCOUNT_SECOND")
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0] ?? null;

  // 6) Compute secondWindowExpiresAt from the completed free cut
  // The 10-day window starts from when the free cut was completed (startAt approximates completion time)
  let secondWindowExpiresAt: Date | null = null;
  if (freeFirstAppointment) {
    secondWindowExpiresAt = new Date(
      freeFirstAppointment.startAt.getTime() + 10 * 24 * 60 * 60 * 1000
    );
  }

  // 7) Determine stage based on completed appointments and membership status
  // Priority order: MEMBER > SECOND_USED > SECOND_WINDOW > FREE_USED > NEW
  let stage: ClientFunnelStage;
  const now = new Date();

  if (hasActiveMembership) {
    // MEMBER: Client has an active subscription, regardless of appointment history
    stage = "MEMBER";
  } else if (!freeFirstAppointment) {
    // NEW: Client has never completed a free trial cut
    // They may have other appointments, but without a completed TRIAL_FREE, they're still eligible
    stage = "NEW";
  } else if (secondDiscountAppointment) {
    // SECOND_USED: Client has completed both their free cut and their discounted second cut
    // The promo window is no longer available
    stage = "SECOND_USED";
  } else if (secondWindowExpiresAt && now < secondWindowExpiresAt) {
    // SECOND_WINDOW: Client completed their free cut and is within the 10-day window
    // They are eligible for the $10 discounted second cut
    stage = "SECOND_WINDOW";
  } else {
    // FREE_USED: Client completed their free cut but the 10-day window has expired
    // They are no longer eligible for the discounted second cut
    stage = "FREE_USED";
  }

  return {
    stage,
    freeFirstAppointment,
    secondDiscountAppointment,
    secondWindowExpiresAt,
    hasSubscriptionTrial,
    hasActiveMembership,
    activeSubscription: normalizedActiveSubscription,
    hasFreeCutBookedOrCompleted,
    hasSecondCutBookedOrCompleted,
  };
}

/**
 * Helper to fetch funnel info for a user by userId.
 * This does the database queries and calls computeClientFunnel.
 * Use this in both API routes and server components.
 */
export async function getClientFunnelForUser(
  userId: string
): Promise<ClientFunnelInfo> {
  const [appointments, subscriptions] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clientId: userId,
        NOT: { status: "CANCELED" },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.subscription.findMany({
      where: {
        userId: userId,
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      include: {
        plan: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return computeClientFunnel(appointments, subscriptions);
}


