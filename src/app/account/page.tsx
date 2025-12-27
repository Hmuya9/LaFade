import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { unstable_noStore } from "next/cache";
import { SecuritySection } from "./_components/SecuritySection";
import { AppointmentsSkeleton } from "./_components/AppointmentsSkeleton";
import { UpcomingAppointmentsClient } from "./_components/UpcomingAppointmentsClient";
import { NextAppointmentCard } from "./_components/NextAppointmentCard";
import { LogoutButton } from "./_components/LogoutButton";
import { AccountRefreshHandler } from "./_components/AccountRefreshHandler";
import { ViewportDebugOverlay } from "./_components/ViewportDebugOverlay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentList } from "@/components/ui/appointment-list";
import type { AppointmentCardData } from "@/components/ui/appointment-card";
import { DismissibleBanner } from "@/components/ui/dismissible-banner";
import { getClientFunnelForUser, type ClientFunnelInfo } from "@/lib/client-funnel";
import {
  syncSubscriptionFromCheckoutSession,
  devGrantMembershipForSession,
} from "@/lib/subscriptions";
import { formatAppointmentDate, formatAppointmentTime, formatAppointmentDateTime, formatInBusinessTimeZone } from "@/lib/time-utils";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  searchParams: { 
    justBooked?: string; 
    rescheduled?: string;
    session_id?: string;
    [key: string]: string | string[] | undefined;
  };
};

/**
 * Account Dashboard Page
 * 
 * Database assumptions:
 * - Single SQLite file at web/prisma/dev.db
 * - DATABASE_URL="file:./prisma/dev.db"
 * 
 * User lookup:
 * - Resolves user by email from session (same as booking API)
 * - Queries appointments by clientId (user.id)
 * 
 * Appointment filtering:
 * - Upcoming: status is BOOKED or CONFIRMED (status-based, no timezone issues)
 * - Past: status is CANCELED, COMPLETED, or NO_SHOW
 */
export default async function AccountPage({ searchParams }: AccountPageProps) {
  // Disable all caching to ensure fresh data on every request
  unstable_noStore();
  
  // Only log searchParams in development (may contain sensitive data)
  if (process.env.NODE_ENV !== "production") {
  console.log("[account] props.searchParams =", JSON.stringify(searchParams, null, 2));
  }

  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      hasAnsweredFreeCutQuestion: true,
      passwordHash: true,
      email: true,
      name: true,
      phone: true,
    },
  });

  if (!user) {
    // User exists in session but not in database - redirect to login to re-authenticate
    console.error('[account] User not found in database', { email: session.user.email });
    redirect('/login');
  }

  // Role guard: BARBER and OWNER should not access client dashboard
  // Use centralized helper for consistent redirects
  if (user.role !== "CLIENT") {
    const { getDashboardRouteForRole } = await import("@/lib/auth");
    redirect(getDashboardRouteForRole(user.role));
  }

  // DEBUG: Log current user
  console.log("[account] current user =", { id: user.id, email: user.email, role: user.role });

  // Sync subscription from Stripe checkout session if session_id is present
  const sessionId = typeof searchParams?.session_id === "string" ? searchParams.session_id : undefined;
  if (sessionId) {
    console.log("[account] session_id detected", { sessionId, userId: user.id });

    // 1) Real sync from Stripe checkout session
    try {
      await syncSubscriptionFromCheckoutSession({
        sessionId,
        currentUserId: user.id,
      });
    } catch (err) {
      console.error("[account] syncSubscriptionFromCheckoutSession failed", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }

    // 2) DEV fallback: only runs in development AND only for subscription checkouts.
    // devGrantMembershipForSession itself:
    //   - immediately returns when NODE_ENV !== "development"
    //   - retrieves the Stripe Checkout session
    //   - returns early if session.mode !== "subscription" or session.status !== "complete"
    //
    // This means it will NOT grant membership for the $10 second cut
    // (that checkout uses mode = "payment"), but WILL help in dev if the
    // normal sync misses a valid subscription checkout.
    try {
      await devGrantMembershipForSession({
        sessionId,
        userId: user.id,
      });
      console.log("[account] devGrantMembershipForSession completed successfully");
    } catch (err) {
      console.error("[account] devGrantMembershipForSession failed", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }

    // 3) Verify subscription was created after sync attempts
    const verifySubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      include: { plan: { select: { name: true } } },
    });

    console.log("[account] subscription verification after sync", {
      userId: user.id,
      subscriptionExists: !!verifySubscription,
      subscriptionId: verifySubscription?.id,
      subscriptionStatus: verifySubscription?.status,
      planName: verifySubscription?.plan?.name,
      stripeSubId: verifySubscription?.stripeSubId,
    });

    if (!verifySubscription && process.env.NODE_ENV === "development") {
      console.error("[account][CRITICAL] No active subscription found after sync attempts! This should not happen in dev.");
    }

    console.log("[account] subscription sync block completed");
  } else {
    console.log("[account] No session_id in searchParams", {
      searchParamsKeys: Object.keys(searchParams || {}),
      session_id: searchParams?.session_id,
    });
  }

  const justBooked = searchParams?.justBooked === "1";
  const rescheduled = searchParams?.rescheduled === "1";
  
  // Redirect non-CLIENT users
  if (user.role !== "CLIENT") {
    if (user.role === "BARBER") {
      redirect("/barber");
    }
    redirect("/admin/appointments");
  }

  // Gate onboarding: if not answered and not a member, redirect to onboarding
  if (!user.hasAnsweredFreeCutQuestion) {
    const funnel = await getClientFunnelForUser(user.id);
    if (funnel.stage !== "MEMBER") {
      redirect("/onboarding/free-cut");
    }
  }
  
  const agg = user ? await prisma.pointsLedger.aggregate({ 
    where: { userId: user.id }, 
    _sum: { delta: true }
  }) : { _sum: { delta: 0 }};
  
  const points = agg._sum.delta ?? 0;
  const hasPassword = Boolean(user?.passwordHash);

  // Get funnel status directly (no HTTP fetch needed)
  // This now includes activeSubscription with plan details
  console.log("[account] fetching funnel for userId=", user.id);
  const funnel = await getClientFunnelForUser(user.id);
  console.log("[account] funnel result =", JSON.stringify({
    stage: funnel.stage,
    hasActiveMembership: funnel.hasActiveMembership,
    hasSubscriptionTrial: funnel.hasSubscriptionTrial,
    activeSubscription: funnel.activeSubscription ? {
      id: funnel.activeSubscription.id,
      userId: funnel.activeSubscription.userId,
      planId: funnel.activeSubscription.planId,
      status: funnel.activeSubscription.status,
      plan: funnel.activeSubscription.plan,
      renewsAt: funnel.activeSubscription.renewsAt?.toISOString(),
    } : null,
    hasFreeCutBookedOrCompleted: funnel.hasFreeCutBookedOrCompleted,
    hasSecondCutBookedOrCompleted: funnel.hasSecondCutBookedOrCompleted,
  }, null, 2));

  // Use activeSubscription from funnel for status content / UI logic
  const activeSubscription = funnel.activeSubscription;

  // Calculate membership usage (cutsAllowed, cutsUsed, cutsRemaining)
  // NOTE: we intentionally query Prisma directly here instead of relying on funnel.activeSubscription,
  // because the funnel object does not include plan.cutsPerMonth.
  let membershipUsage: { cutsAllowed: number; cutsUsed: number; cutsRemaining: number } | null = null;

  try {
    const activeSubRecord = await prisma.subscription.findFirst({
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
    });

    if (activeSubRecord && activeSubRecord.plan?.cutsPerMonth && activeSubRecord.plan.cutsPerMonth > 0) {
      const cutsAllowed = activeSubRecord.plan.cutsPerMonth;
      const periodStart = activeSubRecord.startDate;
      const periodEnd = activeSubRecord.renewsAt ?? (() => {
        const end = new Date(periodStart);
        end.setMonth(end.getMonth() + 1);
        return end;
      })();

      const cutsUsed = await prisma.appointment.count({
        where: {
          clientId: user.id,
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

      console.log("[account][USAGE]", {
        userId: user.id,
        cutsAllowed,
        cutsUsed,
        cutsRemaining,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
    }
  } catch (error) {
    console.error("[account] membershipUsage calculation failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // DEBUG: Log raw subscriptions for this user (including ALL statuses)
  const rawSubscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: { plan: { select: { name: true } } },
  });
  console.log("[account] ALL subscriptions for user", user.id, JSON.stringify(rawSubscriptions.map(s => ({
    id: s.id,
    userId: s.userId,
    planId: s.planId,
    planName: s.plan?.name,
    status: s.status,
    stripeSubId: s.stripeSubId,
    startDate: s.startDate?.toISOString(),
    renewsAt: s.renewsAt?.toISOString(),
  })), null, 2));

  // Also check specifically for ACTIVE/TRIAL subscriptions (what funnel uses)
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      userId: user.id,
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    include: { plan: { select: { name: true } } },
  });
  console.log("[account] ACTIVE/TRIAL subscriptions for user", user.id, JSON.stringify(activeSubscriptions.map(s => ({
    id: s.id,
    userId: s.userId,
    planId: s.planId,
    planName: s.plan?.name,
    status: s.status,
    stripeSubId: s.stripeSubId,
  })), null, 2));

  // Fetch appointments by clientId (simple, direct query)
  const allAppointments = await prisma.appointment.findMany({
    where: { clientId: user.id },
    include: {
      barber: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          city: true,
          photos: {
            where: { isApproved: true },
            select: { url: true },
            take: 1,
            orderBy: { createdAt: "desc" }
          }
        }
      }
    },
    orderBy: { startAt: 'asc' },
  });

  console.log("[account][DEBUG_RAW]", {
    userId: user.id,
    userEmail: user.email,
    totalFound: allAppointments.length,
    appointments: allAppointments.map(a => ({
      id: a.id,
      clientId: a.clientId,
      status: a.status,
      kind: (a as any).kind,
      startAt: a.startAt.toISOString(),
    })),
  });

  // SIMPLE DEBUG - log what we actually got
  console.log('[account][SIMPLE]', {
    userId: user.id,
    totalFound: allAppointments.length,
    appointments: allAppointments.map(a => ({
      id: a.id.substring(0, 8),
      status: a.status,
      clientId: a.clientId.substring(0, 8),
    })),
  });

  // Status + time-based filtering for upcoming appointments.
  // We only consider appointments in the future (or later today) as "upcoming".
  // Any past appointment, even if still BOOKED/CONFIRMED, is treated as past so
  // the dashboard doesn't show stale "next cut" dates from previous months.
  // Use a grace window to ensure newly booked appointments always appear immediately.
  const GRACE_MS = 5 * 60 * 1000; // 5 minutes grace window
  const now = new Date();
  const nowTime = now.getTime();
  const upcomingRaw = allAppointments.filter((a) => {
    if (a.status !== "BOOKED" && a.status !== "CONFIRMED") {
      return false;
    }
    if (!a.startAt) return false;
    // Ensure startAt is a Date object and compare using getTime() for reliable numeric comparison
    const startAtDate = a.startAt instanceof Date ? a.startAt : new Date(a.startAt);
    const startAtTime = startAtDate.getTime();
    // Include if appointment start time is in the future OR within grace window (resilient to timing issues)
    return startAtTime >= (nowTime - GRACE_MS);
  });
  
  // Past: everything else (complete partition - no appointments dropped)
  const upcomingIds = new Set(upcomingRaw.map((a) => a.id));
  const pastRaw = allAppointments.filter((a) => !upcomingIds.has(a.id));

  console.log("[account][DEBUG_PARTITION]", {
    userId: user.id,
    totalAppointments: allAppointments.length,
    upcomingRawCount: upcomingRaw.length,
    pastRawCount: pastRaw.length,
    upcomingIds: upcomingRaw.map(a => a.id),
    pastIds: pastRaw.map(a => a.id),
  });

  // Format appointments
  const formatAppointment = (apt: typeof allAppointments[0]): AppointmentCardData => {
    // Defensive null checks
    if (!apt || !apt.startAt || !apt.endAt) {
      console.error("[account] Invalid appointment data:", apt);
      throw new Error("Invalid appointment data: missing required fields");
    }

    let planName = "Standard";
    if (apt.kind === "MEMBERSHIP_INCLUDED") {
      planName = "Membership Cut";
    } else if (apt.isFree) {
      planName = "Free Test Cut";
    } else if (apt.type === "HOME") {
      planName = "Deluxe";
    }

    const barberPhoto = apt.barber?.photos?.[0]?.url || apt.barber?.image || null;

    return {
      id: apt.id,
      barber: {
        id: apt.barber?.id || "",
        name: apt.barber?.name || apt.barber?.email || "Barber",
        photo: barberPhoto,
        city: apt.barber?.city || null,
        email: apt.barber?.email || "",
        phone: apt.barber?.phone || null,
      },
      client: {
        email: user.email || "",
        phone: user.phone || null,
      },
      plan: planName,
      startAt: apt.startAt.toISOString(),
      endAt: apt.endAt.toISOString(),
      status: apt.status as AppointmentCardData["status"],
      type: apt.type,
      address: apt.address,
      notes: apt.notes
    };
  };

  // Format appointments with error handling
  const formatAppointmentsSafely = (appointments: typeof allAppointments) => {
    return appointments
      .map((apt) => {
        try {
          return formatAppointment(apt);
        } catch (error) {
          console.error("[account] Failed to format appointment:", apt?.id, error);
          return null;
        }
      })
      .filter((apt): apt is AppointmentCardData => apt !== null);
  };

  const upcoming = formatAppointmentsSafely(upcomingRaw);
  const past = formatAppointmentsSafely(pastRaw).reverse();

  // Dev log: check phone fields
  if (process.env.NODE_ENV !== "production") {
    const sampleUpcoming = upcoming[0];
    if (sampleUpcoming) {
      console.log("[account] sample upcoming appointment contact data", {
        barberEmail: sampleUpcoming.barber.email || "missing",
        barberPhone: sampleUpcoming.barber.phone || "missing",
        clientEmail: sampleUpcoming.client?.email || "missing",
        clientPhone: sampleUpcoming.client?.phone || "missing",
        userPhone: user.phone || "missing",
      });
    }
  }

  // Partition upcoming appointments: earliest is "next", rest go to "My Appointments"
  // Sort by startAt to ensure earliest is first (already sorted from query, but be explicit)
  const upcomingSorted = [...upcoming].sort((a, b) => {
    try {
      const dateA = new Date(a.startAt).getTime();
      const dateB = new Date(b.startAt).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0; // Invalid dates - maintain order
      return dateA - dateB;
    } catch (error) {
      console.error("[account] Error sorting appointments:", error);
      return 0;
    }
  });
  const [nextUpcoming, ...otherUpcoming] = upcomingSorted;

  // Find the DISCOUNT_SECOND appointment (if any) for status card messaging
  const discountSecondAppointment = allAppointments.find(
    (apt) => apt?.kind === "DISCOUNT_SECOND" && apt?.status !== "CANCELED" && apt?.startAt
  );

  // Debug logging to see what's actually happening
  console.log('[account][DEBUG]', {
    userId: user.id,
    userEmail: user.email,
    totalAppointments: allAppointments.length,
    upcomingCount: upcoming.length,
    pastCount: past.length,
    nextUpcomingId: nextUpcoming?.id ?? null,
    otherUpcomingIds: otherUpcoming.map(a => a.id),
    partitionOK: allAppointments.length === upcoming.length + past.length,
    allAppointmentIds: allAppointments.map(a => ({ id: a.id, clientId: a.clientId, status: a.status, startAt: a.startAt.toISOString() })),
  });

  const userName = session.user?.name || session.user?.email?.split("@")[0] || "there";
  
  // Helper to calculate days until expiration
  const getDaysUntilExpiry = (expiryDate: Date | null): number | null => {
    if (!expiryDate) return null;
    try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
      if (isNaN(expiry.getTime())) return null; // Invalid date
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    // Return null if expired (today or past)
    return diffDays >= 0 ? diffDays : null;
    } catch (error) {
      console.error("[account] Error calculating days until expiry:", error);
      return null;
    }
  };
  
  // Determine the $10 second cut status message based on state machine
  // Returns null if no $10-related message should be shown (e.g., for NEW/FREE_USED stages)
  const getSecondCutStatusMessage = () => {
    // State 3: HAS any non-canceled DISCOUNT_SECOND appointment
    // This takes priority - if they've booked, show booking info regardless of stage
    if (funnel.hasSecondCutBookedOrCompleted && discountSecondAppointment && discountSecondAppointment.startAt) {
      // Check if the appointment is completed
      if (discountSecondAppointment.status === "COMPLETED") {
        const barberName = discountSecondAppointment.barber?.name || discountSecondAppointment.barber?.email || "your barber";
        const appointmentDate = formatInBusinessTimeZone(discountSecondAppointment.startAt, "MMMM d, yyyy");
        return `Your $10 second cut with ${barberName} on ${appointmentDate} was completed. Thanks for visiting!`;
      }
      
      // Appointment is booked but not yet completed
      const barberName = discountSecondAppointment.barber?.name || discountSecondAppointment.barber?.email || "your barber";
      const appointmentDate = formatInBusinessTimeZone(discountSecondAppointment.startAt, "MMMM d, yyyy");
      return `Your $10 second cut is booked with ${barberName} on ${appointmentDate}.`;
    }
    
    // State 3 fallback: has booking but appointment not found in query (shouldn't happen, but safe)
    if (funnel.hasSecondCutBookedOrCompleted) {
      return "Your $10 second cut is booked. We'll see you soon.";
    }
    
    // State 4: SECOND_WINDOW EXPIRED without booking
    const now = new Date();
    if (funnel.stage === "SECOND_WINDOW" && 
        funnel.secondWindowExpiresAt && 
        now >= funnel.secondWindowExpiresAt) {
      return "Your $10 second cut offer has expired, but you can still book your next cut anytime.";
    }
    
    // State 2: IN SECOND_WINDOW and NO non-canceled DISCOUNT_SECOND appointment
    if (funnel.stage === "SECOND_WINDOW" && !funnel.hasSecondCutBookedOrCompleted) {
      const expiryDate = funnel.secondWindowExpiresAt
        ? funnel.secondWindowExpiresAt.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;
      return expiryDate
        ? `You've unlocked a $10 second cut. Your offer expires on ${expiryDate}.`
        : "You've unlocked a $10 second cut.";
    }
    
    // State 1: BEFORE SECOND_WINDOW
    // Show the "Stay consistent..." message only for NEW or FREE_USED stages
    // (MEMBER and SECOND_USED have their own messages)
    if (funnel.stage === "NEW" || funnel.stage === "FREE_USED") {
      return "Stay consistent and you'll unlock a special $10 second cut after your first visit.";
    }
    
    // Default: no $10-related message for other stages (MEMBER, SECOND_USED)
    return null;
  };
  
  const secondCutStatusMessage = getSecondCutStatusMessage();

  // Helper to get status card content based on funnel stage
  function getStatusContent(
    funnel: ClientFunnelInfo,
    activeSubscription: ClientFunnelInfo['activeSubscription'],
    allAppointments: any[]
  ): {
    title: string;
    description: string;
    ctaLabel?: string;
    ctaHref?: string;
  } {
    // PRIORITY 1: MEMBER stage - Show membership card (highest priority)
    if (funnel.stage === "MEMBER" && funnel.hasActiveMembership && activeSubscription) {
      const planName = activeSubscription.plan?.name || "Standard";
      const renewsAt = activeSubscription.renewsAt;
      const formattedRenewalDate = renewsAt
        ? renewsAt.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;
      
      return {
        title: `You're on the ${planName} membership`,
        description: formattedRenewalDate
          ? `Your membership renews on ${formattedRenewalDate}. Book your included cuts anytime from the booking page.`
          : "Your membership is active. Book your included cuts anytime from the booking page.",
        ctaLabel: "Book a cut",
        ctaHref: "/booking",
      };
    }

    // Handle SECOND_WINDOW stage - check if appointment is already booked
    if (funnel.stage === "SECOND_WINDOW") {
      // Check if there's a future DISCOUNT_SECOND appointment that's booked/confirmed
      const nowForComparison = new Date().getTime();
      const appointmentTime = discountSecondAppointment?.startAt 
        ? (discountSecondAppointment.startAt instanceof Date 
            ? discountSecondAppointment.startAt 
            : new Date(discountSecondAppointment.startAt)).getTime()
        : 0;
      const futureDiscountAppointment = discountSecondAppointment && 
        discountSecondAppointment.startAt &&
        appointmentTime > nowForComparison &&
        (discountSecondAppointment.status === "BOOKED" || discountSecondAppointment.status === "CONFIRMED");

      if (futureDiscountAppointment && discountSecondAppointment.startAt) {
        // Appointment is booked - show booking confirmation
        const barberName = discountSecondAppointment.barber?.name || 
          discountSecondAppointment.barber?.email || 
          "your barber";
        const appointmentDate = formatInBusinessTimeZone(discountSecondAppointment.startAt, "MMMM d, yyyy");
        const appointmentTime = formatAppointmentTime(discountSecondAppointment.startAt);
        return {
          title: "Your $10 second cut is booked",
          description: `You're all set for your $10 second cut with ${barberName} on ${appointmentDate} at ${appointmentTime}. If you need to change the time, you can manage your appointment below.`,
          ctaLabel: "View my appointment",
          ctaHref: "#appointments", // Anchor to appointments section
        };
      }

      // No appointment booked yet - show availability message
      if (funnel.secondWindowExpiresAt) {
        const formattedDeadline = funnel.secondWindowExpiresAt.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        return {
          title: "Holiday Special: Your $10 second cut!",
          description: `Limited time holiday offer: get your second cut for just $10 before January first. Perfect way to keep your fresh look going into the new year!`,
          ctaLabel: "Book $10 second cut",
          ctaHref: "/booking/second-cut",
        };
      }

      // Fallback if no expiry date
      return {
        title: "Holiday Special: Your $10 second cut!",
        description: "Limited time holiday offer: get your second cut for just $10. Perfect way to keep your fresh look going into the new year!",
        ctaLabel: "Book $10 second cut",
        ctaHref: "/booking/second-cut",
      };
    }

    // Handle other stages
    switch (funnel.stage) {
      case "NEW":
        return {
          title: "New Year Special: Your free first cut!",
          description: "Start the year fresh with a free cut. No card required, no hidden fees — just pick a time and show up.",
          ctaLabel: "Book my free cut",
          ctaHref: "/booking",
        };

      case "SECOND_USED":
        // Only show "You've tried LaFade twice" if NOT a member
        // If they're a member, the MEMBER case above should have caught it
        if (funnel.hasActiveMembership) {
          // This shouldn't happen (MEMBER should take priority), but handle gracefully
          const planName = activeSubscription?.plan?.name || "Standard";
          return {
            title: `You're on the ${planName} membership`,
            description: "Your membership is active. Book your included cuts anytime from the booking page.",
            ctaLabel: "Book a cut",
            ctaHref: "/booking",
          };
        }
        
        // Find last appointment info if available
        const lastAppointment = allAppointments
          .filter((a) => a?.status === "COMPLETED" && a?.startAt)
          .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];
        const lastBarberName = lastAppointment?.barber?.name || lastAppointment?.barber?.email || "your barber";
        const lastDate = lastAppointment?.startAt ? formatInBusinessTimeZone(lastAppointment.startAt, "MMMM d, yyyy") : null;
        const lastAppointmentText = lastAppointment && lastDate
          ? ` Your last cut was with ${lastBarberName} on ${lastDate}.`
          : "";
        return {
          title: "You've tried LaFade twice",
          description: `You used your free cut and your $10 second cut. If you want to stay fresh every month without chasing a barber, you can lock in a membership from $45/month.${lastAppointmentText}`,
          ctaLabel: "View membership plans",
          ctaHref: "/plans",
        };

      case "FREE_USED":
        // Only show "You've tried LaFade twice" if NOT a member
        if (funnel.hasActiveMembership) {
          const planName = activeSubscription?.plan?.name || "Standard";
          return {
            title: `You're on the ${planName} membership`,
            description: "Your membership is active. Book your included cuts anytime from the booking page.",
            ctaLabel: "Book a cut",
            ctaHref: "/booking",
          };
        }
        return {
          title: "You've tried LaFade twice",
          description: "You used your free cut and your $10 second cut. If you want to stay fresh every month without chasing a barber, you can lock in a membership from $45/month.",
          ctaLabel: "View membership plans",
          ctaHref: "/plans",
        };

      case "MEMBER":
        const planName = activeSubscription?.plan?.name || "LaFade";
        const renewsAt = activeSubscription?.renewsAt;
        const formattedRenewDate = renewsAt
          ? renewsAt.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : null;
        return {
          title: `You're on the ${planName} membership`,
          description: formattedRenewDate
            ? `Your membership is active and renews on ${formattedRenewDate}. You can book your included cuts anytime from your dashboard.`
            : "Your membership is active. You can book your included cuts anytime from your dashboard.",
          ctaLabel: "Book a cut",
          ctaHref: "/booking",
        };

      default:
        return {
          title: "Your LaFade status",
          description: "Something changed with your account. You can still book a one-time cut, or check your plans if you need to update billing.",
          ctaLabel: "View plans",
          ctaHref: "/plans",
        };
    }
  }

  const statusContent = getStatusContent(funnel, activeSubscription, allAppointments);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Format renewal date
  const formatRenewalDate = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const planName = activeSubscription?.plan?.name || "Standard";
  const renewalDate = activeSubscription?.renewsAt 
    ? formatRenewalDate(activeSubscription.renewsAt)
    : null;

  // Get first name for greeting
  const firstName = user.name?.split(" ")[0] || user.email?.split("@")[0] || "there";
  
  // Format period end date
  const formatPeriodEnd = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };
  
  const periodEndFormatted = activeSubscription?.renewsAt 
    ? formatPeriodEnd(activeSubscription.renewsAt)
    : null;

  // DEBUG PANEL (dev only)
  return (
    <main className="min-h-[100dvh] w-full" data-debug="account-v2">
      <AccountRefreshHandler />
      <ViewportDebugOverlay />
      <div className="mx-auto max-w-6xl w-full px-4 md:px-6 py-12 md:py-16 space-y-8">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 min-w-0">

          {/* Booking Success Banner */}
          {justBooked && (
            <div className="col-span-12 min-w-0">
              <DismissibleBanner variant="success" autoDismiss duration={4500}>
                <span className="font-semibold">Your cut is booked ✂️</span> — you&apos;ll find it below in Your Upcoming Appointments.
              </DismissibleBanner>
            </div>
          )}

          {/* Hero Card - Span 8 */}
          {user.role === "CLIENT" && funnel && (
            <section className="md:col-span-8 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all duration-300 opacity-0 animate-[fadeInUp_0.6s_ease-out_0.1s_forwards] p-8 md:p-10 min-w-0">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900 leading-tight break-words">
                {getGreeting()}, {firstName}
              </h1>
              {funnel.hasActiveMembership ? (
                <div className="mt-4 space-y-1">
                  <p className="text-zinc-600 text-base leading-relaxed">
                    Your {planName} membership is active.
                  </p>
                  {periodEndFormatted && (
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      Renews <span className="font-mono text-zinc-900 tabular-nums">{periodEndFormatted}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-zinc-600 text-base mt-4 leading-relaxed">
                  {statusContent.description}
                </p>
              )}
            </section>
          )}

          {/* Usage Stats - Span 4 */}
          {user.role === "CLIENT" && membershipUsage && (
            <section className="md:col-span-4 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6 md:p-8 flex flex-col justify-between transition-all duration-300 opacity-0 animate-[fadeInUp_0.6s_ease-out_0.2s_forwards] min-w-0">
              <div>
                <p className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 leading-tight">
                  <span className="font-mono text-zinc-900 tabular-nums">{membershipUsage.cutsUsed}/{membershipUsage.cutsAllowed}</span> cuts used
                </p>
              </div>
              <p className="text-sm text-zinc-500 mt-4 leading-relaxed">
                <span className="font-mono text-zinc-900 tabular-nums">{membershipUsage.cutsRemaining}</span> left
                {periodEndFormatted && (
                  <> · Resets <span className="font-mono text-zinc-900 tabular-nums">{periodEndFormatted}</span></>
                )}
              </p>
            </section>
          )}

          {/* Second-cut unlock card - visible when client is in SECOND_WINDOW */}
          {user.role === "CLIENT" && 
           funnel?.stage === "SECOND_WINDOW" && 
           !funnel.hasSecondCutBookedOrCompleted &&
           funnel.secondWindowExpiresAt &&
           getDaysUntilExpiry(funnel.secondWindowExpiresAt) !== null && (
            <div className="col-span-12 min-w-0">
            <Card className="rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-300">
              <CardHeader className="bg-white rounded-t-3xl border-b border-dashed border-zinc-200 relative">
                  {/* Limited time badge */}
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200/60">
                      Limited time
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pr-20">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200/60">
                      <Sparkles className="h-4 w-4 text-zinc-500 stroke-[1.5]" />
                    </div>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900 min-w-0 break-words">
                      Holiday Special: Your <span className="font-mono tabular-nums">$10</span> second cut!
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4 text-zinc-600 text-sm">
                  {/* Subtext */}
                  <p className="leading-relaxed">
                    Limited time holiday offer: get your second cut for just <span className="font-mono text-zinc-900 tabular-nums">$10</span> before January first. Perfect way to keep your fresh look going into the new year!
                  </p>
                  
                  {/* Countdown line */}
                  {getDaysUntilExpiry(funnel.secondWindowExpiresAt) !== null && (
                    <p className="text-zinc-600 leading-relaxed">
                      Expires in <span className="font-mono text-zinc-900 tabular-nums">{getDaysUntilExpiry(funnel.secondWindowExpiresAt)}</span> {getDaysUntilExpiry(funnel.secondWindowExpiresAt) === 1 ? "day" : "days"}
                    </p>
                  )}
                  
                  {/* Primary button */}
                  <div className="pt-1">
                    <Link
                      href="/booking/second-cut"
                      className="inline-flex items-center px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Book now for <span className="font-mono tabular-nums ml-1">$10</span>
                    </Link>
                  </div>
                  
                  {/* Reassurance line */}
                  <p className="text-xs text-zinc-500 pt-1 leading-relaxed">
                    You&apos;ll only be charged when you confirm your appointment.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

        {/* Reschedule Success Banner */}
        {rescheduled && (
          <div className="col-span-12 min-w-0">
            <DismissibleBanner variant="success" autoDismiss duration={4500}>
              <span className="font-semibold">Appointment rescheduled successfully ✂️</span> — your new appointment is below.
            </DismissibleBanner>
          </div>
        )}

          {/* Your Next Cut - Span 8 */}
          <section className="md:col-span-8 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6 md:p-8 transition-all duration-300 min-w-0" id="appointments">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 mb-5">Your next cut</h2>
            {nextUpcoming && nextUpcoming.startAt ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Date/Time + Barber */}
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 text-center min-w-[60px]">
                    <div className="text-2xl font-semibold text-zinc-900 font-mono tabular-nums leading-tight">
                      {formatInBusinessTimeZone(nextUpcoming.startAt, "d")}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mt-1 font-mono tabular-nums">
                      {formatInBusinessTimeZone(nextUpcoming.startAt, "MMM")}
                    </div>
                    <div className="text-sm text-zinc-500 mt-2 font-mono tabular-nums">
                      {formatAppointmentTime(nextUpcoming.startAt)}
                    </div>
                  </div>
                  <div className="border-l border-dashed border-zinc-200 pl-5 flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-zinc-900 leading-tight break-words">{nextUpcoming.barber?.name || "Barber"}</h3>
                    <p className="text-sm text-zinc-600 mt-1 leading-relaxed break-words">{nextUpcoming.plan}</p>
                    {nextUpcoming.type === "HOME" && nextUpcoming.address && (
                      <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed break-words">{nextUpcoming.address}</p>
                    )}
                    {/* Barber Contact Info */}
                    {(nextUpcoming.barber?.email || nextUpcoming.barber?.phone) && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 text-xs text-zinc-600 space-y-1">
                        <p className="font-medium text-zinc-700">Barber Contact:</p>
                        {nextUpcoming.barber?.email && <p>📧 {nextUpcoming.barber.email}</p>}
                        {nextUpcoming.barber?.phone ? (
                          <p>
                            📞 <a href={`tel:${nextUpcoming.barber.phone}`} className="text-rose-600 hover:text-rose-700 underline">{nextUpcoming.barber.phone}</a>
                          </p>
                        ) : (
                          <p className="text-zinc-400">📞 Phone not set (ask admin)</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Right: Status + Actions */}
                <div className="flex items-center gap-3 border-t border-dashed border-zinc-200 pt-5 md:border-t-0 md:border-l md:border-dashed md:pl-6 md:pt-0">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/60 font-mono tabular-nums">
                    {nextUpcoming.status}
                  </span>
                  <Button asChild size="sm" variant="outline" className="bg-white border-zinc-200/70 text-zinc-900 hover:bg-zinc-50 transition-colors">
                    <Link href="/account#appointments">
                      Manage
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-5 py-4">
                <p className="text-zinc-900 text-lg font-semibold leading-tight">
                  No upcoming cut – book one now
                </p>
                <p className="text-zinc-600 text-sm max-w-md mx-auto leading-relaxed">
                  {funnel?.hasActiveMembership ? (
                    <>Use your membership to lock in your next slot. Most members stay on a 2–3 week rhythm.</>
                  ) : (
                    <>Book your next cut whenever it works for you.</>
                  )}
                </p>
                <Button className="mt-2 h-11 px-8 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition-colors" asChild>
                  <Link href="/booking">Book a cut</Link>
                </Button>
              </div>
            )}
          </section>

          {/* Upcoming / History Summary - Span 4 */}
          <section className="md:col-span-4 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6 md:p-7 space-y-4 transition-all duration-300 min-w-0">
            {otherUpcoming.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900 mb-1">Other upcoming</h3>
                <div className="space-y-3">
                  {otherUpcoming.slice(0, 3).map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between text-sm py-2.5 border-b border-dashed border-zinc-200 last:border-0">
                      <div>
                        <p className="font-semibold text-zinc-900 font-mono tabular-nums leading-tight">
                          {apt.startAt ? formatAppointmentDate(apt.startAt) : "—"}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{apt.barber?.name || "Barber"}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-700 border border-zinc-200/60 font-mono tabular-nums">
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900 mb-1">Quick actions</h3>
                <div className="space-y-2.5">
                  <Button variant="outline" className="w-full justify-start bg-white border-zinc-200/70 text-zinc-900 hover:bg-zinc-50 transition-colors" size="sm" asChild>
                    <Link href="/account#appointments">View history</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-white border-zinc-200/70 text-zinc-900 hover:bg-zinc-50 transition-colors" size="sm" asChild>
                    <Link href="/account">Update profile</Link>
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* Points Card - Span 4 */}
          {user.role === "CLIENT" && (
            <section className="md:col-span-4 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6 md:p-7 transition-all duration-300 min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 mb-3">Points</h3>
              <div className="text-3xl font-semibold tracking-tight text-zinc-900 font-mono tabular-nums leading-tight">
                {points}
              </div>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">Available for booking</p>
            </section>
          )}
        </div>

        {/* Past Appointments Section */}
        {past.length > 0 && (
          <div>
            <Card className="rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all duration-300">
              <CardHeader className="bg-white rounded-t-3xl border-b border-dashed border-zinc-200">
                <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900">Past Appointments</CardTitle>
                <CardDescription className="text-zinc-500">Your booking history</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <AppointmentList appointments={past} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Subscription Section */}
        {user.role === "CLIENT" && !funnel?.hasActiveMembership && (
          <div>
            <Card className="rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all duration-300">
              <CardHeader className="bg-white rounded-t-3xl border-b border-dashed border-zinc-200">
                <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900">Membership</CardTitle>
                <CardDescription className="text-zinc-500">Join a membership plan</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <p className="text-sm text-zinc-600">
                    Lock in monthly cuts with a membership plan starting at <span className="font-mono text-zinc-900 tabular-nums">$45</span>/month.
                  </p>
                  <Button asChild className="w-full h-11 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">
                    <Link href="/plans">
                      View Plans
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Security Section */}
        <section className="mt-10 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-[0_0_0_1px_rgba(0,0,0,0.03)_inset] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6 md:p-8 transition-all duration-300">
          <h2 className="text-lg font-semibold tracking-tight mb-1 text-zinc-900">Security</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Manage your account security settings.
          </p>
          <SecuritySection hasPassword={hasPassword} />
        </section>

        {/* Logout Section */}
        <div className="pt-4">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
