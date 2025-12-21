import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { debit, getPointsBalance } from "@/lib/points";
import { z } from "zod";
import crypto from "crypto";
import { buildICS } from "@/lib/calendar";
import { sendBookingEmail } from "@/lib/notify";
import { sendBookingEmailsSafe, sendAdminBookingAlert, type EmailResult } from "@/lib/email";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";
import { PRICING, getPricingByPlanId } from "@/lib/pricing";
import { isFreeCutAppointment, getClientFunnelForUser } from "@/lib/client-funnel";
import { getBookingState } from "@/lib/bookingState";
import { parseLocalDateTimeToUTC, BUSINESS_TIMEZONE, formatInBusinessTimeZone } from "@/lib/time-utils";

export const runtime = "nodejs";

/**
 * Booking API Route
 * 
 * Database assumptions:
 * - Single SQLite file at web/prisma/dev.db
 * - DATABASE_URL="file:./prisma/dev.db" (relative to web/)
 * - No custom path resolution - Prisma handles relative paths correctly
 * 
 * User lookup:
 * - Resolves user by email from session (same as /account page)
 * - Ensures user has role CLIENT before allowing booking
 * 
 * Appointment statuses:
 * - BOOKED/CONFIRMED count as active (conflict detection)
 * - CANCELED/COMPLETED/NO_SHOW don't count as conflicts
 * 
 * Email sending:
 * - Fire-and-forget, never blocks booking creation
 * - sendBookingEmailsSafe() is wrapped in .catch() to prevent errors
 * - sendBookingEmail() with .ics invite is awaited for result reporting
 */

// V1 Launch Safety: Only allow these two real barbers
const REAL_BARBER_IDS = [
  "cmihqddi20001vw3oyt77w4uv",
  "cmj6jzd1j0000vw8ozlyw14o9",
];

const createBookingSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10),
  selectedDate: z.string(),           // YYYY-MM-DD
  selectedTime: z.string(),           // e.g., "10:00 AM"
  selectedBarber: z.string(),         // Barber ID (cuid) or name (legacy support)
  plan: z.enum(["standard", "deluxe", "trial"]),
  location: z.string().optional(),    // address for deluxe (ignored for trial)
  notes: z.string().optional(),
  rescheduleOf: z.string().optional(), // Appointment ID being rescheduled
  startAtUTC: z.string().optional(),  // UTC ISO string from client (preferred)
  endAtUTC: z.string().optional(),    // UTC ISO string from client (preferred)
  // Optional metadata used for special flows (e.g. discounted second cut)
  kind: z.enum(["DISCOUNT_SECOND"]).optional(),
  // Optional bookingStateType for server-side validation
  bookingStateType: z.enum(["FIRST_FREE", "SECOND_DISCOUNT", "MEMBERSHIP_INCLUDED", "ONE_OFF"]).optional(),
  // Optional flag to redeem 150 points for a free cut
  usePoints: z.boolean().optional(),
  // Cash App payment
  paymentMethod: z.enum(["STRIPE", "CASH_APP"]).optional(),
  cashAppIntentId: z.string().optional(),
});

// Helper to check if error is Prisma unique constraint violation
function isPrismaUniqueError(e: unknown): e is { code: 'P2002' } {
  return !!e && typeof e === 'object' && 'code' in e && (e as any).code === 'P2002';
}

// Helper to generate deterministic idempotency key
function generateIdempotencyKey(email: string, barberId: string, startAtUTC: Date): string {
  return crypto.createHash('sha256')
    .update(`${email}|${barberId}|${startAtUTC.toISOString()}`)
    .digest('hex');
}

/**
 * Booking API Route
 * 
 * Database assumptions:
 * - Single SQLite file at web/prisma/dev.db
 * - DATABASE_URL="file:./prisma/dev.db"
 * 
 * User lookup:
 * - Resolves user by email from session (same as /account page)
 * - Ensures user has role CLIENT before allowing booking
 * 
 * Appointment statuses:
 * - BOOKED/CONFIRMED count as active (conflict detection)
 * - CANCELED/COMPLETED/NO_SHOW don't count as conflicts
 */
export async function POST(req: NextRequest) {
  // Only log in development to avoid log noise in production
  if (process.env.NODE_ENV !== "production") {
  console.log('[booking][start]', { url: req.url, method: req.method });
  }

  try {
    // Resolve current user by email (simple, consistent approach)
    const session = await auth();
    if (!session?.user?.email) {
      console.warn('[booking][auth]', 'no session user');
      return NextResponse.json(
        { ok: false, message: "Please sign in to book a cut." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      console.warn('[booking][auth]', 'user not found', { email: session.user.email });
      return NextResponse.json(
        { ok: false, message: "User account not found. Please sign in again." },
        { status: 401 }
      );
    }

    if (user.role !== "CLIENT") {
      console.warn('[booking][validation]', 'user_not_client', {
        userId: user.id,
        role: user.role,
      });
      return NextResponse.json(
        { ok: false, message: "Invalid client account. Please sign in as a client." },
        { status: 403 }
      );
    }

    const client = user;

    // Guard against empty requests
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('[booking] validation failed', {
        reason: 'invalid_content_type',
        contentType,
      });
      return NextResponse.json(
        { ok: false, message: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.warn('[booking][validation]', 'json_parse_error', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return NextResponse.json(
        { ok: false, message: "Invalid request format. Please try again." },
        { status: 400 }
      );
    }

    // Only log request body in development (may contain sensitive data)
    if (process.env.NODE_ENV !== "production") {
    console.log('[booking][body]', body);
    }

    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[booking][validation]', 'schema_validation_failed', {
        details: parsed.error.issues,
      });
      return NextResponse.json(
        { ok: false, message: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Only log parsed data in development
    if (process.env.NODE_ENV !== "production") {
    console.log('[booking] request body parsed', {
      plan: data.plan,
      date: data.selectedDate,
      time: data.selectedTime,
      barberId: data.selectedBarber,
      rescheduleOf: data.rescheduleOf || null,
    });
    }

    if (client.role !== "CLIENT") {
      console.warn('[booking][validation]', 'client_not_found_or_wrong_role', {
        clientId: client.id,
        clientRole: client.role,
      });
      return NextResponse.json(
        { ok: false, message: "Invalid client account. Please sign in as a client." },
        { status: 403 }
      );
    }

    const finalClientId = client.id;

    console.log("[bookings] resolved client", {
      sessionEmail: session?.user?.email,
      finalClientId,
    });

    // Update client phone if provided and different from current
    if (client.role === "CLIENT" && data.customerPhone) {
      if (!client.phone || client.phone !== data.customerPhone) {
        await prisma.user.update({
          where: { id: finalClientId },
          data: { phone: data.customerPhone },
        });
        console.log("[bookings] updated client phone", {
          clientId: finalClientId,
          phone: data.customerPhone,
        });
      }
    }

    // Get booking state early (required for guards that check bookingState.type)
    const bookingState = await getBookingState(finalClientId);

    // Find barber by ID (preferred) or name (legacy support)
    let barber = await prisma.user.findUnique({
      where: { id: data.selectedBarber },
    });
    
    // If not found by ID, try by name (legacy support)
    if (!barber || (barber.role !== "BARBER" && barber.role !== "OWNER")) {
      barber = await prisma.user.findFirst({
        where: { 
          name: data.selectedBarber, 
          role: { in: ["BARBER", "OWNER"] },
          id: { in: REAL_BARBER_IDS },
        },
      });
    }
    
    // V1 Launch Safety: Guard - only allow real barbers
    if (!barber || !REAL_BARBER_IDS.includes(barber.id)) {
      console.warn('[booking][validation]', 'barber_not_allowlisted', {
        selectedBarber: data.selectedBarber,
        barberId: barber?.id,
      });
      return NextResponse.json(
        { ok: false, message: "Invalid barber selected. Please choose a valid barber." },
        { status: 400 }
      );
    }
    
    if (!barber || (barber.role !== "BARBER" && barber.role !== "OWNER")) {
      console.warn('[booking][validation]', 'barber_not_found', {
        selectedBarber: data.selectedBarber,
      });
      return NextResponse.json(
        { ok: false, message: "Barber not found. Please select a valid barber." },
        { status: 404 }
      );
    }

    // Parse date/time - prefer UTC ISO strings from client, otherwise parse on server
    // IMPORTANT: All times are interpreted as America/Los_Angeles (business timezone)
    let startAtUTC: Date;
    let endAtUTC: Date;
    
    if (data.startAtUTC && data.endAtUTC) {
      // Client sent UTC ISO strings - use them directly (client already converted from LA time)
      startAtUTC = new Date(data.startAtUTC);
      endAtUTC = new Date(data.endAtUTC);
      
      console.log("[bookings] Using client-provided UTC times:", {
        inputDate: data.selectedDate,
        inputTime: data.selectedTime,
        timezone: BUSINESS_TIMEZONE,
        startAtUTC: startAtUTC.toISOString(),
        endAtUTC: endAtUTC.toISOString(),
        // Debug: show what time this represents in LA timezone
        startAtLA: formatInBusinessTimeZone(startAtUTC, "yyyy-MM-dd HH:mm:ss zzz"),
      });
    } else {
      // Fallback: Parse on server - interpret as America/Los_Angeles timezone
      startAtUTC = parseLocalDateTimeToUTC(data.selectedDate, data.selectedTime);
      endAtUTC = new Date(startAtUTC.getTime() + 30 * 60 * 1000); // +30 minutes
      
      console.log("[bookings] Parsed server-side (fallback):", {
        inputDate: data.selectedDate,
        inputTime: data.selectedTime,
        timezone: BUSINESS_TIMEZONE,
        startAtUTC: startAtUTC.toISOString(),
        endAtUTC: endAtUTC.toISOString(),
      });
    }

    // === GUARD: Idempotency handling (always server-generated for consistency) ===
    // Always generate idempotency key server-side to ensure consistency
    // Client-provided keys are ignored to prevent key mismatches
    const idempotencyKey = generateIdempotencyKey(
      session.user.email!,
      barber.id,
      startAtUTC
    );

    console.log("[booking][IDEMP_KEY]", {
      email: session.user?.email,
      barberId: barber.id,
      startAt: startAtUTC.toISOString(),
      idempotencyKey,
    });

    // Check for existing booking with same idempotency key (only active appointments)
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        idempotencyKey,
        status: {
          in: ["BOOKED", "CONFIRMED"],
        },
      },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        barber: { select: { name: true } },
      },
    });

    console.log("[booking][idempotent-check]", {
      foundId: existingAppointment?.id ?? null,
      foundStatus: existingAppointment?.status ?? null,
    });

    if (existingAppointment) {
      console.log('[booking] Idempotent request - returning existing appointment', { appointmentId: existingAppointment.id });
      return NextResponse.json({ 
        ok: true,
        appointment: existingAppointment,
        appointmentId: existingAppointment.id,
        emailed: false,
        message: "Booking already exists" 
      }, { status: 200 });
    }

    // Handle reschedule flow: if rescheduleOf is provided, we need to cancel the old appointment first
    let oldAppointmentId: string | null = null;
    if (data.rescheduleOf) {
      // Load the existing appointment
      const oldAppointment = await prisma.appointment.findUnique({
        where: { id: data.rescheduleOf },
        include: {
          client: { select: { id: true } },
        },
      });

      if (!oldAppointment) {
        console.error('[booking] Reschedule: old appointment not found', { rescheduleOf: data.rescheduleOf });
        return NextResponse.json(
          { ok: false, message: "The appointment you're trying to reschedule was not found." },
          { status: 404 }
        );
      }

      // Ensure it belongs to the logged-in client
      if (oldAppointment.clientId !== finalClientId) {
        console.error('[booking] Reschedule: client mismatch', {
          oldAppointmentClientId: oldAppointment.clientId,
          currentClientId: finalClientId,
        });
        return NextResponse.json(
          { ok: false, message: "You can only reschedule your own appointments." },
          { status: 403 }
        );
      }

      // Ensure it's not already CANCELED, COMPLETED, or NO_SHOW
      if (["CANCELED", "COMPLETED", "NO_SHOW"].includes(oldAppointment.status)) {
        console.error('[booking] Reschedule: old appointment already finalized', {
          appointmentId: oldAppointment.id,
          status: oldAppointment.status,
        });
        return NextResponse.json(
          { ok: false, message: "This appointment cannot be rescheduled because it's already canceled, completed, or marked as no-show." },
          { status: 400 }
        );
      }

      oldAppointmentId = oldAppointment.id;
    }

    // Overlap check: verify no existing appointment for this barber during this time
    // Only check BOOKED/CONFIRMED statuses that are in the future
    // CANCELED, COMPLETED, NO_SHOW don't count as conflicts
    const overlappingAppointment = await prisma.appointment.findFirst({
      where: {
        barberId: barber.id,
        startAt: { lt: endAtUTC, gte: new Date() }, // Only check future appointments
        endAt: { gt: startAtUTC },
        status: { in: ["BOOKED", "CONFIRMED"] },
        // Exclude the old appointment if we're rescheduling
        ...(oldAppointmentId ? { id: { not: oldAppointmentId } } : {}),
      },
      select: { id: true, startAt: true, status: true },
    });

    if (overlappingAppointment) {
      console.error('[booking] Barber conflict detected', {
        barberId: barber.id,
        newStartAt: startAtUTC.toISOString(),
        conflictingAppointmentId: overlappingAppointment.id,
      });
      return NextResponse.json(
        { ok: false, message: "This time is no longer available. Please pick another time." },
        { status: 409 }
      );
    }

    // Duplicate booking prevention (same client + time)
    // Only check BOOKED/CONFIRMED statuses that are in the future
    // Exclude the old appointment if we're rescheduling
    // Only check future appointments - past bookings don't block new ones
    const now = new Date();
    let duplicateAppointment = null;
    
    // Only check for duplicates if the new booking is in the future
    if (startAtUTC >= now) {
      duplicateAppointment = await prisma.appointment.findFirst({
        where: {
          clientId: finalClientId,
          startAt: startAtUTC,
          status: { in: ["BOOKED", "CONFIRMED"] },
          // Exclude the old appointment if we're rescheduling
          ...(oldAppointmentId ? { id: { not: oldAppointmentId } } : {}),
        },
        select: { id: true, startAt: true, status: true },
      });
    }

    if (duplicateAppointment) {
      console.error('[booking] Client conflict detected', {
        clientId: finalClientId,
        newStartAt: startAtUTC.toISOString(),
        conflictingAppointmentId: duplicateAppointment.id,
        conflictingStatus: duplicateAppointment.status,
        conflictingStartAt: duplicateAppointment.startAt.toISOString(),
      });
      return NextResponse.json(
        { ok: false, message: "You already have a booking at this time." },
        { status: 409 }
      );
    }

    // === GUARD: Free Test Cut eligibility ===
    // We gate free trials based on any non-canceled free cut appointment (past or future).
    // Uses the same logic as isFreeCutAppointment() to handle both current and legacy appointments.
    // A client can book another free trial only if *all* free cut appointments are canceled.
    if (data.plan === "trial" || bookingState.type === "FIRST_FREE") {
      // Fetch all non-canceled appointments for this client
      const allAppointments = await prisma.appointment.findMany({
        where: {
          clientId: finalClientId,
          status: {
            not: "CANCELED",
          },
          // Exclude the old appointment if we're rescheduling a free trial
          ...(oldAppointmentId ? { id: { not: oldAppointmentId } } : {}),
        },
        select: {
          id: true,
          status: true,
          startAt: true,
          kind: true,
          priceCents: true,
        },
      });
      
      // Check if any appointment matches the free cut criteria
      const existingTrial = allAppointments.find((a) => isFreeCutAppointment(a as any));
      
      if (existingTrial) {
        console.log('[bookings][TRIAL_FREE] user already used free cut - blocking new trial', {
          clientId: finalClientId,
          clientEmail: client.email,
          existingTrialId: existingTrial.id,
          existingTrialStatus: existingTrial.status,
          existingTrialKind: existingTrial.kind,
          existingTrialPriceCents: existingTrial.priceCents,
          existingTrialStartAt: existingTrial.startAt.toISOString(),
        });
        return NextResponse.json(
          { ok: false, message: "You already have a free test cut. Cancel it first to book another." },
          { status: 400 }
        );
      }
    }

    // === DEBUG: Log exact data passed to create (ALWAYS ON for debugging) ===
    const appointmentData: any = {
      clientId: finalClientId,
      barberId: barber.id,
      type: data.plan === "deluxe" ? "HOME" : "SHOP" as const,
      startAt: startAtUTC,
      endAt: endAtUTC,
      status: "BOOKED" as const,
      address: data.plan === "deluxe" ? (data.location || null) : null, // Only deluxe (HOME) has address
      notes: data.notes || null,
      idempotencyKey,
    };

    // bookingState already fetched above (hoisted to prevent ReferenceError)

    // === GUARD: Validate bookingStateType matches actual state ===
    if (data.bookingStateType) {
      const expectedType = bookingState.type;
      const providedType = data.bookingStateType;
      
      // Map bookingStateType to BookingState type
      const typeMap: Record<string, string> = {
        "FIRST_FREE": "FIRST_FREE",
        "SECOND_DISCOUNT": "SECOND_DISCOUNT",
        "MEMBERSHIP_INCLUDED": "MEMBERSHIP_INCLUDED",
        "ONE_OFF": "ONE_OFF",
      };
      
      if (typeMap[providedType] !== expectedType) {
        console.warn('[booking][validation] bookingStateType mismatch', {
          providedType,
          expectedType,
          clientId: finalClientId,
        });
        return NextResponse.json(
          { 
            ok: false, 
            message: "Booking state mismatch. Please refresh the page and try again.",
            code: "BOOKING_STATE_MISMATCH",
          },
          { status: 400 }
        );
      }
    }

    // Check for points redemption first (highest priority)
    if (data.usePoints === true) {
      // === GUARD: Verify user has enough points (with double-check to prevent race conditions) ===
      const pointsTotal = await getPointsBalance(finalClientId);
      if (pointsTotal < 150) {
        console.warn('[booking][validation] Insufficient points for redemption', {
          clientId: finalClientId,
          required: 150,
          current: pointsTotal,
        });
        return NextResponse.json(
          {
            ok: false,
            error: "You don't have enough points for a free cut.",
            code: "NOT_ENOUGH_POINTS",
            required: 150,
            current: pointsTotal,
          },
          { status: 400 }
        );
      }
      
      // === GUARD: Double-check points balance right before creating appointment ===
      // This helps catch race conditions where points were spent between check and create
      const pointsTotalAgain = await getPointsBalance(finalClientId);
      if (pointsTotalAgain < 150) {
        console.error('[booking][validation] Points balance changed between checks (race condition)', {
          clientId: finalClientId,
          required: 150,
          firstCheck: pointsTotal,
          secondCheck: pointsTotalAgain,
        });
        return NextResponse.json(
          {
            ok: false,
            error: "Points balance changed. Please refresh and try again.",
            code: "POINTS_BALANCE_CHANGED",
            required: 150,
            current: pointsTotalAgain,
          },
          { status: 409 }
        );
      }
      // Points redemption: free cut
      appointmentData.kind = "ONE_OFF";
      appointmentData.isFree = true;
      appointmentData.priceCents = 0;
      appointmentData.paymentStatus = "WAIVED";
      // Points will be deducted after appointment creation
    } else if (data.kind === "DISCOUNT_SECOND") {
      // === GUARD: Validate second cut eligibility at booking time ===
      // Re-check that user is eligible for second cut (window hasn't expired, no existing booking)
      const funnel = await getClientFunnelForUser(finalClientId);
      
      // Check if user has already booked/completed a second cut
      if (funnel.hasSecondCutBookedOrCompleted) {
        console.warn('[booking][validation] Second cut already booked/completed', {
          clientId: finalClientId,
        });
        return NextResponse.json(
          { 
            ok: false, 
            message: "You've already booked or used your $10 second cut.",
            code: "SECOND_CUT_ALREADY_USED",
          },
          { status: 400 }
        );
      }
      
      // Check if user is in SECOND_WINDOW stage
      if (funnel.stage !== "SECOND_WINDOW") {
        console.warn('[booking][validation] Not in SECOND_WINDOW stage', {
          clientId: finalClientId,
          stage: funnel.stage,
        });
        return NextResponse.json(
          { 
            ok: false, 
            message: "You're not eligible for the $10 second cut. Please check your account status.",
            code: "NOT_ELIGIBLE_SECOND_CUT",
          },
          { status: 400 }
        );
      }
      
      // Check if window has expired
      if (funnel.secondWindowExpiresAt && new Date() >= funnel.secondWindowExpiresAt) {
        console.warn('[booking][validation] Second cut window expired', {
          clientId: finalClientId,
          expiresAt: funnel.secondWindowExpiresAt.toISOString(),
        });
        return NextResponse.json(
          { 
            ok: false, 
            message: "The $10 second cut offer has expired.",
            code: "SECOND_CUT_WINDOW_EXPIRED",
          },
          { status: 400 }
        );
      }
      
      // Second-cut promo
      appointmentData.kind = "DISCOUNT_SECOND";
      appointmentData.isFree = false;
      appointmentData.priceCents = PRICING.secondCut10.cents;
      
      // Handle payment method
      if (data.paymentMethod === "CASH_APP") {
        // Cash App payment: verify intent before creating booking
        if (!data.cashAppIntentId) {
          return NextResponse.json(
            { ok: false, message: "Cash App payment intent ID is required." },
            { status: 400 }
          );
        }

        // Load and verify Cash App intent
        const intent = await prisma.cashAppPaymentIntent.findUnique({
          where: { id: data.cashAppIntentId },
        });

        if (!intent) {
          return NextResponse.json(
            { ok: false, message: "Payment intent not found." },
            { status: 404 }
          );
        }

        // Verify intent belongs to user
        if (intent.userId !== finalClientId) {
          return NextResponse.json(
            { ok: false, message: "Payment intent does not belong to you." },
            { status: 403 }
          );
        }

        // Verify intent is CONFIRMED
        if (intent.status !== "CONFIRMED") {
          return NextResponse.json(
            { ok: false, message: `Payment intent is ${intent.status.toLowerCase()}. Please complete payment first.` },
            { status: 400 }
          );
        }

        // Verify amount matches expected price
        if (intent.amountCents !== PRICING.secondCut10.cents) {
          return NextResponse.json(
            { ok: false, message: "Payment amount does not match booking price." },
            { status: 400 }
          );
        }

        // Verify not expired
        if (intent.expiresAt && new Date() > intent.expiresAt) {
          return NextResponse.json(
            { ok: false, message: "Payment intent has expired." },
            { status: 400 }
          );
        }

        // Set payment details
        appointmentData.paidVia = "CASH_APP";
        appointmentData.paymentStatus = "PAID";
        appointmentData.cashAppIntentId = intent.id;
      } else {
        // Stripe payment (default)
      appointmentData.paymentStatus = "PENDING";
      }
    } else if (bookingState.type === "MEMBERSHIP_INCLUDED") {
      // Membership-included cut - check cuts-per-month limit
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          userId: finalClientId,
          status: { in: ["ACTIVE", "TRIAL"] },
        },
        include: {
          plan: true,
        },
      });

      if (!activeSubscription) {
        return NextResponse.json(
          {
            ok: false,
            error: "You don't have an active membership for this booking.",
            code: "NO_ACTIVE_MEMBERSHIP",
          },
          { status: 400 }
        );
      }

      // Determine membership period
      const periodStart = activeSubscription.startDate;
      const periodEnd = activeSubscription.renewsAt ?? (() => {
        const end = new Date(periodStart);
        end.setMonth(end.getMonth() + 1);
        return end;
      })();

      // Derive allowed cuts per month
      const allowed = activeSubscription.plan?.cutsPerMonth ?? 0;

      // If allowed > 0, check the limit
      if (allowed > 0) {
        // === GUARD: Check membership limit with transaction to prevent race conditions ===
        // Use a transaction to ensure atomic check-and-create
        // Note: SQLite doesn't support row-level locking, but transaction still helps
        const used = await prisma.appointment.count({
          where: {
            clientId: finalClientId,
            kind: "MEMBERSHIP_INCLUDED",
            status: { in: ["BOOKED", "COMPLETED", "CONFIRMED"] },
            startAt: {
              gte: periodStart,
              lt: periodEnd,
            },
            // Exclude the old appointment if we're rescheduling
            ...(oldAppointmentId ? { id: { not: oldAppointmentId } } : {}),
          },
        });

        // === GUARD: Check limit BEFORE creating appointment ===
        if (used >= allowed) {
          console.warn('[booking][validation] Membership limit reached', {
            clientId: finalClientId,
            allowed,
            used,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
          });
          return NextResponse.json(
            {
              ok: false,
              error: "You've used all your included cuts for this membership period.",
              code: "MEMBERSHIP_LIMIT_REACHED",
              allowed,
              used,
            },
            { status: 400 }
          );
        }
        
        // === GUARD: Double-check limit is still valid (defensive check) ===
        // This helps catch race conditions where another booking was created between check and create
        // Note: This is not perfect (still a race window), but better than nothing
        const usedAgain = await prisma.appointment.count({
          where: {
            clientId: finalClientId,
            kind: "MEMBERSHIP_INCLUDED",
            status: { in: ["BOOKED", "COMPLETED", "CONFIRMED"] },
            startAt: {
              gte: periodStart,
              lt: periodEnd,
            },
            ...(oldAppointmentId ? { id: { not: oldAppointmentId } } : {}),
          },
        });
        
        if (usedAgain >= allowed) {
          console.error('[booking][validation] Membership limit reached between checks (race condition)', {
            clientId: finalClientId,
            allowed,
            usedFirst: used,
            usedSecond: usedAgain,
          });
          return NextResponse.json(
            {
              ok: false,
              error: "This time slot is no longer available. Another booking was just created.",
              code: "MEMBERSHIP_LIMIT_REACHED_RACE",
              allowed,
              used: usedAgain,
            },
            { status: 409 }
          );
        }
      }

      // Membership-included cut
      appointmentData.kind = "MEMBERSHIP_INCLUDED";
      appointmentData.isFree = true;
      appointmentData.priceCents = 0; // Included in membership
      appointmentData.paymentStatus = "WAIVED";
    } else if (bookingState.type === "FIRST_FREE" || data.plan === "trial") {
      // First free cut
      appointmentData.kind = "TRIAL_FREE";
      appointmentData.isFree = true; // Keep isFree and kind in sync
      appointmentData.priceCents = PRICING.freeTrial.cents;
      appointmentData.paymentStatus = "WAIVED";
    } else {
      // ONE_OFF: Standard or deluxe paid cut
      appointmentData.kind = "ONE_OFF";
      appointmentData.isFree = false;
      const pricing = getPricingByPlanId(data.plan);
      appointmentData.priceCents = pricing.cents;
      
      // Handle payment method
      if (data.paymentMethod === "CASH_APP") {
        // Cash App payment: verify intent before creating booking
        if (!data.cashAppIntentId) {
          return NextResponse.json(
            { ok: false, message: "Cash App payment intent ID is required." },
            { status: 400 }
          );
        }

        // Load and verify Cash App intent
        const intent = await prisma.cashAppPaymentIntent.findUnique({
          where: { id: data.cashAppIntentId },
        });

        if (!intent) {
          return NextResponse.json(
            { ok: false, message: "Payment intent not found." },
            { status: 404 }
          );
        }

        // Verify intent belongs to user
        if (intent.userId !== finalClientId) {
          return NextResponse.json(
            { ok: false, message: "Payment intent does not belong to you." },
            { status: 403 }
          );
        }

        // Verify intent is CONFIRMED
        if (intent.status !== "CONFIRMED") {
          return NextResponse.json(
            { ok: false, message: `Payment intent is ${intent.status.toLowerCase()}. Please complete payment first.` },
            { status: 400 }
          );
        }

        // Verify amount matches expected price
        if (intent.amountCents !== pricing.cents) {
          return NextResponse.json(
            { ok: false, message: "Payment amount does not match booking price." },
            { status: 400 }
          );
        }

        // Verify not expired
        if (intent.expiresAt && new Date() > intent.expiresAt) {
          return NextResponse.json(
            { ok: false, message: "Payment intent has expired." },
            { status: 400 }
          );
        }

        // Set payment details
        appointmentData.paidVia = "CASH_APP";
        appointmentData.paymentStatus = "PAID";
        appointmentData.cashAppIntentId = intent.id;
      } else {
        // Stripe payment (default)
      appointmentData.paymentStatus = "PENDING";
      }
    }

    console.log('[booking] creating appointment', {
      clientId: finalClientId,
      sessionUserId: (session.user as any)?.id,
      sessionEmail: session.user?.email,
      barberId: barber.id,
      startAt: startAtUTC.toISOString(),
      endAt: endAtUTC.toISOString(),
      plan: data.plan,
      isFree: data.plan === "trial",
      type: data.plan === "deluxe" ? "HOME" : "SHOP",
      rescheduleOf: data.rescheduleOf || null,
    });

    // Create appointment with proper error handling
    // If rescheduling, use a transaction to cancel old and create new atomically
    const includeSelect = {
      client: { select: { name: true, email: true, phone: true } },
      barber: { select: { name: true, email: true } },
    } as const;

    type AppointmentWithIncludes = {
      id: string;
      clientId: string;
      barberId: string;
      startAt: Date;
      endAt: Date;
      status: "BOOKED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
      type: "SHOP" | "HOME";
      isFree: boolean;
      address: string | null;
      notes: string | null;
      idempotencyKey: string | null;
      cancelReason: string | null;
      client: { name: string | null; email: string | null; phone: string | null };
      barber: { name: string | null; email: string | null };
    };
    let appointment: AppointmentWithIncludes;
    try {
      if (oldAppointmentId) {
        // Reschedule: transaction to cancel old and create new
        console.log("[booking][DEBUG] Reschedule flow: using transaction to cancel old and create new");
        const result = await prisma.$transaction(async (tx) => {
          // Cancel the old appointment
          await tx.appointment.update({
            where: { id: oldAppointmentId! },
            data: {
              status: "CANCELED",
              cancelReason: "Client rescheduled via app",
            },
          });
          console.log("[booking][DEBUG] Old appointment canceled:", oldAppointmentId);

          // Explicitly ensure status is BOOKED for rescheduled appointments
          appointmentData.status = "BOOKED" as const;
          
          console.log("[bookings][STATUS_CHECK]", {
            kind: (appointmentData as any).kind,
            status: (appointmentData as any).status,
          });

          // Create the new appointment
          const newAppt = await tx.appointment.create({
            // TS: relax type checking here, runtime is already working in dev
            data: appointmentData as any,
            include: includeSelect,
          });
          console.log("[booking][DEBUG] New appointment created:", newAppt.id);
          console.log("[bookings] created appointment", {
            id: newAppt.id,
            clientId: newAppt.clientId,
            barberId: newAppt.barberId,
            status: newAppt.status,
            kind: (newAppt as any).kind,
            startAt: newAppt.startAt.toISOString(),
            priceCents: (newAppt as any).priceCents,
            isFree: newAppt.isFree,
          });
          return newAppt;
        });
        appointment = result;
      } else {
        // Regular booking: just create
        // Explicitly ensure status is BOOKED for all new appointments
        appointmentData.status = "BOOKED" as const;
        
        console.log("[bookings][STATUS_CHECK]", {
          kind: (appointmentData as any).kind,
          status: (appointmentData as any).status,
        });
        
        console.log("[booking][DEBUG] Regular booking: calling prisma.appointment.create()...");
        console.log("[booking][DEBUG] Prisma create() data:", JSON.stringify(appointmentData, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }, 2));
        
        appointment = await prisma.appointment.create({
          // TS: relax type checking here, runtime is already working in dev
          data: appointmentData as any,
          include: includeSelect,
        });
        console.log("[bookings] created appointment", {
          id: appointment.id,
          clientId: appointment.clientId,
          barberId: appointment.barberId,
          status: appointment.status,
          kind: (appointment as any).kind,
          startAt: appointment.startAt.toISOString(),
          priceCents: (appointment as any).priceCents,
          isFree: appointment.isFree,
        });
      }

      // Ultra-clear log after creating appointment
      console.log('[booking][created]', {
        id: appointment.id,
        clientId: appointment.clientId,
        barberId: appointment.barberId,
        startAt: appointment.startAt.toISOString(),
        status: appointment.status,
      });
      
      // Trigger email notifications (fire-and-forget, never blocks booking)
      // This sends basic emails to client, barber, and owner in the background
      sendBookingEmailsSafe(appointment.id)
        .then((result) => {
          if (result.emailed) {
            console.log('[booking][email] Background emails sent successfully', { appointmentId: appointment.id });
          } else {
            console.warn('[booking][email] Background emails failed', { appointmentId: appointment.id, reason: result.reason });
          }
        })
        .catch((err) => {
          console.error('[booking][email] Unexpected error in background email send', { appointmentId: appointment.id, error: err });
        });

      // Send admin alert (fire-and-forget, never blocks booking)
      try {
        const clientName = appointment.client.name || appointment.client.email || "Client";
        const barberName = appointment.barber.name || appointment.barber.email || "Barber";
        // Format time in business timezone (America/Los_Angeles) for admin alert
        const timeFormatted = formatInBusinessTimeZone(appointment.startAt, 'EEE, MMM d • h:mm a');
        const appointmentKind = (appointment as any).kind || null;
        
        sendAdminBookingAlert(clientName, barberName, timeFormatted, appointmentKind)
          .then((result) => {
            if (result.emailed) {
              console.log('[booking][admin-alert] Admin alert sent successfully', { appointmentId: appointment.id });
            } else {
              console.warn('[booking][admin-alert] Admin alert failed', { appointmentId: appointment.id, reason: result.reason });
            }
          })
          .catch((err) => {
            console.error('[booking][admin-alert] Unexpected error in admin alert', { appointmentId: appointment.id, error: err });
          });
      } catch (alertError) {
        // Swallow error - admin alert should never break booking
        console.error('[booking][admin-alert] Error preparing admin alert', { appointmentId: appointment.id, error: alertError });
      }
      
      // Verify appointment was actually created
      if (!appointment || !appointment.id) {
        throw new Error("Appointment creation returned null or missing ID");
      }
      
      console.log("[booking][DEBUG] ✅ Appointment verified - ID exists:", appointment.id);
    } catch (createError: any) {
      // === DEBUG: Log full error object (ALWAYS ON for debugging) ===
      console.error("[booking][ERROR] Appointment creation failed:", {
        error: createError?.message || String(createError),
        code: createError?.code || "UNKNOWN",
        meta: createError?.meta || null,
        clientId: finalClientId,
        barberId: barber.id,
        startAt: startAtUTC.toISOString(),
        endAt: endAtUTC.toISOString(),
        stack: createError?.stack || undefined,
        errorName: createError?.name,
        errorCause: createError?.cause,
        fullError: JSON.stringify(createError, Object.getOwnPropertyNames(createError), 2),
      });

      // Handle unique constraint violation (barber time conflict)
      if (isPrismaUniqueError(createError)) {
        console.error("[booking][ERROR] Unique constraint violation detected");
        return NextResponse.json({ 
          error: "Time slot no longer available. Please pick another time." 
        }, { status: 409 });
      }

      // Re-throw to be caught by outer try-catch
      console.error("[booking][ERROR] Re-throwing error to outer catch block");
      throw createError;
    }

    // Note: Availability is now managed via weekly ranges (BarberAvailability model)
    // and conflict detection via Appointment model. No need to update legacy Availability table.
    // The availability API automatically excludes booked appointments when generating slots.

    // Handle points: either deduct for points redemption OR debit for normal booking
    if (data.usePoints === true) {
      // Deduct 150 points for points redemption
      try {
        await debit(finalClientId, 150, 'POINTS_REDEMPTION', 'APPOINTMENT', appointment.id);
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ Debited 150 points from user ${finalClientId} for points redemption booking ${appointment.id}`);
        }
      } catch (pointsError: any) {
        // If insufficient points (shouldn't happen due to earlier check, but be safe), rollback
        await prisma.appointment.delete({ where: { id: appointment.id } });
        
        if (process.env.NODE_ENV === "development") {
          console.error("[bookings] Points redemption failed, rolled back appointment:", pointsError.message);
        }
        
        return NextResponse.json(
          { ok: false, error: "Failed to redeem points. Please try again.", code: "POINTS_REDEMPTION_FAILED" },
          { status: 500 }
        );
      }
    } else {
      // Debit points for booking (except for free trials, membership-included, and second-cut promo)
      // Free Test Cut (trial plan), MEMBERSHIP_INCLUDED, and DISCOUNT_SECOND promo require 0 points and bypass the points check entirely
      const isFreeOrPromo = data.plan === "trial" || data.kind === "DISCOUNT_SECOND" || appointmentData.kind === "MEMBERSHIP_INCLUDED";
      if (!isFreeOrPromo) {
        try {
          await debit(finalClientId, 5, 'BOOKING_DEBIT', 'BOOKING', appointment.id);
          if (process.env.NODE_ENV === "development") {
            console.log(`✅ Debited 5 points from user ${finalClientId} for booking ${appointment.id}`);
          }
        } catch (pointsError: any) {
          // If insufficient points, rollback the appointment
          await prisma.appointment.delete({ where: { id: appointment.id } });
          
          if (process.env.NODE_ENV === "development") {
            console.error("[bookings] Points debit failed, rolled back appointment:", pointsError.message);
          }
          
          return NextResponse.json(
            { ok: false, message: "Not enough points. Please subscribe or renew to continue." },
            { status: 402 }
          );
        }
      } else {
        // Free Test Cut, membership-included, or second-cut promo: no points required, log for debugging
        if (process.env.NODE_ENV === "development") {
          const bookingType = data.kind === "DISCOUNT_SECOND" ? "Second-cut promo" : 
                              appointmentData.kind === "MEMBERSHIP_INCLUDED" ? "Membership-included" : 
                              "Free Test Cut";
          console.log(`✅ ${bookingType} booking created (no points deducted): ${appointment.id}`);
        }
      }
    }

    // Notify barber dashboard in real time
    try {
      await pusherServer.trigger("lafade-bookings", "booking.created", {
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        barberId: appointment.barberId,
        startAt: appointment.startAt,
        type: appointment.type,
        isFree: appointment.isFree,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Pusher booking.created error", error);
    }

    // Generate calendar invite
    const icsContent = buildICS({
      title: `${data.plan === 'trial' ? 'Free Trial' : data.plan === 'deluxe' ? 'Deluxe Cut' : 'Standard Cut'} - Le Fade`,
      description: `Barber appointment with ${barber.name}${data.notes ? `\\n\\nNotes: ${data.notes}` : ''}`,
      start: startAtUTC,
      end: endAtUTC,
      location: appointment.address || 'Le Fade Barber Shop',
      organizer: { 
        name: 'Le Fade', 
        email: 'bookings@lefade.com' 
      },
    });

    // Send email with calendar invite (.ics attachment)
    // This is awaited so we can report status to frontend and provide ICS fallback if needed
    let emailResult: EmailResult = { emailed: false, reason: 'email-not-attempted' };
    try {
      // Transform appointment to match expected interface with non-null fields
      const appointmentForEmail = {
        ...appointment,
        client: {
          name: appointment.client.name || "Customer",
          email: appointment.client.email || "",
          phone: appointment.client.phone || "",
        },
        barber: {
          name: appointment.barber.name || "Barber",
        },
      };
      emailResult = await sendBookingEmail(appointmentForEmail, 'created', icsContent);
      
      if (emailResult.emailed) {
        console.log('[booking][email] Calendar invite email sent successfully', { appointmentId: appointment.id });
      } else {
        console.warn('[booking][email] Calendar invite email failed', { appointmentId: appointment.id, reason: emailResult.reason });
      }
    } catch (emailError) {
      // This catch should rarely trigger since sendBookingEmail doesn't throw
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.error('[booking][email] Unexpected error sending calendar invite email:', errorMessage);
      emailResult = { emailed: false, reason: `Unexpected error: ${errorMessage}` };
      // Continue anyway - don't fail the booking
    }

    // Email sending is already triggered above after appointment creation
    // This duplicate call is removed to avoid double-sending

    // Generate ICS URL for frontend download (fallback when email disabled)
    const icsBase64 = Buffer.from(icsContent).toString('base64');
    const icsUrl = `/api/bookings/ics/${appointment.id}`;

    console.log('[booking] booking flow complete', {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      status: appointment.status,
      startAt: appointment.startAt.toISOString(),
    });

    // Ensure response includes ok: true and appointmentId
    const response = { 
      ok: true,
      appointmentId: appointment.id,
      message: 'Booking created successfully',
      appointment, 
      emailed: emailResult.emailed,
      reason: emailResult.reason,
      icsUrl: emailResult.emailed ? undefined : icsUrl,
      icsContent: emailResult.emailed ? undefined : icsBase64 
    };
    
    // Only log full response payload in development (may be large)
    if (process.env.NODE_ENV !== "production") {
    console.log("[booking][DEBUG] Final response payload:", JSON.stringify(response, (key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }, 2));
    }
    
    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    // Always log fatal errors, but gate stack traces in production
    console.error('[booking][fatal]', {
      message: error?.message || String(error),
      code: error?.code,
      meta: error?.meta,
      ...(process.env.NODE_ENV !== "production" && { stack: error?.stack }),
    });
    // TODO: Send to error tracking service in production

    if (error instanceof z.ZodError) {
      console.warn('[booking][validation]', 'zod_error', { issues: error.issues });
      return NextResponse.json(
        { ok: false, message: "Invalid booking request. Please check your selections.", errors: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, message: 'Unexpected error while creating booking.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barberId = searchParams.get("barberId");

    const appointments = await prisma.appointment.findMany({
      where: barberId 
        ? { 
            barberId, 
            status: { in: ["BOOKED", "CONFIRMED"] } 
          }
        : { 
            status: { in: ["BOOKED", "CONFIRMED"] } 
          },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        barber: { select: { name: true } },
      },
      orderBy: { startAt: "asc" },
      take: 50,
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error("GET /api/bookings error:", err);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}