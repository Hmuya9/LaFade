import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { debit } from "@/lib/points";
import { z } from "zod";
import crypto from "crypto";
import { buildICS } from "@/lib/calendar";
import { sendBookingEmail } from "@/lib/notify";
import { sendBookingEmailsSafe, type EmailResult } from "@/lib/email";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";

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
  console.log('[booking][start]', { url: req.url, method: req.method });

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

    console.log('[booking][body]', body);

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

    console.log('[booking] request body parsed', {
      plan: data.plan,
      date: data.selectedDate,
      time: data.selectedTime,
      barberId: data.selectedBarber,
      rescheduleOf: data.rescheduleOf || null,
    });

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
        },
      });
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

    // Parse to UTC
    const startAt = new Date(data.selectedDate);
    const [time, period] = data.selectedTime.split(" "); // "10:00", "AM"
    const [hh, mm] = time.split(":");
    let hour = parseInt(hh, 10); 
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    startAt.setHours(hour, parseInt(mm ?? "0", 10), 0, 0);
    const startAtUTC = new Date(startAt.toISOString());
    const endAtUTC = new Date(startAtUTC.getTime() + 30 * 60 * 1000); // +30 minutes

    // Idempotency handling
    const providedKey = req.headers.get('idempotency-key');
    const idempotencyKey = providedKey || generateIdempotencyKey(data.customerEmail, barber.id, startAtUTC);

    // Check for existing booking with same idempotency key
    const existingAppointment = await prisma.appointment.findFirst({
      where: { idempotencyKey },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        barber: { select: { name: true } },
      },
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

    // Free Test Cut rules (LAUNCH VERSION):
    // Client should not be blocked from using Free Test Cut again if they canceled before the appointment time.
    // Only block if they have a future non-canceled free appointment.
    if (data.plan === "trial") {
      const previousTrial = await prisma.appointment.findFirst({
        where: {
          clientId: finalClientId,
          isFree: true,
          status: {
            not: "CANCELED" // Only block if they have a non-canceled free appointment
          },
          startAt: {
            gte: new Date() // Only check future appointments
          },
          // Exclude the old appointment if we're rescheduling a free trial
          ...(oldAppointmentId ? { id: { not: oldAppointmentId } } : {}),
        },
        select: { id: true, status: true, startAt: true },
      });
      if (previousTrial) {
        console.error('[booking] Trial blocked - existing non-canceled future trial found', {
          clientId: finalClientId,
          existingTrialId: previousTrial.id,
          existingTrialStatus: previousTrial.status,
          existingTrialStartAt: previousTrial.startAt.toISOString(),
        });
        return NextResponse.json(
          { ok: false, message: "You already have a free test cut scheduled. Cancel it first to book another." },
          { status: 400 }
        );
      }
    }

    // === DEBUG: Log exact data passed to create (ALWAYS ON for debugging) ===
    const appointmentData = {
      clientId: finalClientId,
      barberId: barber.id,
      type: data.plan === "deluxe" ? "HOME" : "SHOP" as const,
      startAt: startAtUTC,
      endAt: endAtUTC,
      status: "BOOKED" as const,
      address: data.plan === "deluxe" ? (data.location || null) : null, // Only deluxe (HOME) has address
      notes: data.notes || null,
      isFree: data.plan === "trial",
      idempotencyKey,
    };

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
    let appointment;
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

          // Create the new appointment
          const newAppt = await tx.appointment.create({
            // TS: relax type checking here, runtime is already working in dev
            data: appointmentData as any,
            include: {
              client: { select: { name: true, email: true, phone: true } },
              barber: { select: { name: true, email: true } },
            },
          });
          console.log("[booking][DEBUG] New appointment created:", newAppt.id);
          return newAppt;
        });
        appointment = result;
      } else {
        // Regular booking: just create
        console.log("[booking][DEBUG] Regular booking: calling prisma.appointment.create()...");
        console.log("[booking][DEBUG] Prisma create() data:", JSON.stringify(appointmentData, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }, 2));
        
        appointment = await prisma.appointment.create({
          // TS: relax type checking here, runtime is already working in dev
          data: appointmentData as any,
          include: {
            client: { select: { name: true, email: true, phone: true } },
            barber: { select: { name: true, email: true } },
          },
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

    // Debit points for booking (except for free trials)
    // Free Test Cut (trial plan) requires 0 points and bypasses the points check entirely
    if (data.plan !== "trial") {
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
      // Free Test Cut: no points required, log for debugging
      if (process.env.NODE_ENV === "development") {
        console.log(`✅ Free Test Cut booking created (no points deducted): ${appointment.id}`);
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
    
    console.log("[booking][DEBUG] Final response payload:", JSON.stringify(response, (key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }, 2));
    
    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('[booking][fatal]', error);
    console.error('[booking][fatal]', {
      message: error?.message || String(error),
      stack: error?.stack,
      code: error?.code,
      meta: error?.meta,
    });

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