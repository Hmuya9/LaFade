import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { debit } from "@/lib/points";
import { z } from "zod";
import crypto from "crypto";
import { buildICS } from "@/lib/calendar";
import { sendBookingEmail } from "@/lib/notify";

export const runtime = "nodejs";

const createBookingSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10),
  selectedDate: z.string(),           // YYYY-MM-DD
  selectedTime: z.string(),           // e.g., "10:00 AM"
  selectedBarber: z.string(),         // "Mike" | "Alex"
  plan: z.enum(["standard", "deluxe", "trial"]),
  location: z.string().optional(),    // address for deluxe (ignored for trial)
  notes: z.string().optional(),
});

type EmailResult = { emailed: boolean; reason?: string };

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

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user?.email || session.user.role !== "CLIENT") {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to book an appointment." },
        { status: 401 }
      );
    }

    // Guard against empty requests
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ Error: "Content-Type must be application/json" }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data = createBookingSchema.parse(body);

    // Find or create client
    let client = await prisma.user.findFirst({ where: { email: data.customerEmail } });
    if (!client) {
      client = await prisma.user.create({
        data: {
          name: data.customerName,
          email: data.customerEmail,
          phone: data.customerPhone,
          role: "CLIENT",
        },
      });
    }

    // Find barber by name
    const barber = await prisma.user.findFirst({
      where: { name: data.selectedBarber, role: "BARBER" },
    });
    if (!barber) {
      return NextResponse.json({ error: "Barber not found" }, { status: 404 });
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
      return NextResponse.json({ 
        appointment: existingAppointment,
        emailed: false,
        message: "Booking already exists" 
      }, { status: 200 });
    }

    // Overlap check: verify no existing appointment for this barber during this time
    const overlappingAppointment = await prisma.appointment.findFirst({
      where: {
        barberId: barber.id,
        startAt: { lt: endAtUTC },
        endAt: { gt: startAtUTC },
        status: { in: ["BOOKED", "CONFIRMED"] },
      },
      select: { id: true, startAt: true },
    });

    if (overlappingAppointment) {
      return NextResponse.json({ 
        error: "That time was just taken—please pick another." 
      }, { status: 409 });
    }

    // Duplicate booking prevention (same client + time)
    const duplicateAppointment = await prisma.appointment.findFirst({
      where: {
        clientId: client.id,
        startAt: startAtUTC,
        status: { in: ["BOOKED", "CONFIRMED"] },
      },
      select: { id: true },
    });

    if (duplicateAppointment) {
      return NextResponse.json({ 
        error: "You already have an appointment at this time." 
      }, { status: 409 });
    }

    // One trial per customer enforcement
    if (data.plan === "trial") {
      const previousTrial = await prisma.appointment.findFirst({
        where: {
          clientId: client.id,
          isFree: true
        },
        select: { id: true },
      });
      if (previousTrial) {
        return NextResponse.json({ 
          error: "Trial already used. Please choose a plan." 
        }, { status: 409 });
      }
    }

    // Create appointment with proper error handling
    let appointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          clientId: client.id,
          barberId: barber.id,
          type: data.plan === "deluxe" ? "HOME" : "SHOP",
          startAt: startAtUTC,
          endAt: endAtUTC,
          status: "BOOKED",
          address: data.plan === "trial" ? null : data.location,
          notes: data.notes,
          isFree: data.plan === "trial",
          idempotencyKey,
        },
        include: {
          client: { select: { name: true, email: true, phone: true } },
          barber: { select: { name: true } },
        },
      });
    } catch (uniqueError) {
      // Handle unique constraint violation (barber time conflict)
      if (isPrismaUniqueError(uniqueError)) {
        return NextResponse.json({ 
          error: "Time slot no longer available. Please pick another time." 
        }, { status: 409 });
      }
      throw uniqueError; // Re-throw other errors
    }

    // Mark availability slot as booked
    try {
      const timeSlotString = data.selectedTime; // e.g., "10:00 AM"
      const dateOnly = data.selectedDate; // e.g., "2025-10-15"

      await prisma.availability.updateMany({
        where: {
          barberName: data.selectedBarber,
          date: {
            gte: new Date(`${dateOnly}T00:00:00.000Z`),
            lt: new Date(`${dateOnly}T23:59:59.999Z`)
          },
          timeSlot: timeSlotString,
          isBooked: false
        },
        data: {
          isBooked: true
        }
      });

      console.log(`✅ Marked availability as booked: ${data.selectedBarber} on ${dateOnly} at ${timeSlotString}`);
    } catch (availabilityError) {
      console.error('Failed to update availability:', availabilityError);
      // Don't fail the booking if availability update fails - appointment is already created
    }

    // Debit points for booking (except for free trials)
    if (data.plan !== "trial") {
      try {
        await debit(session.user.id as string, 5, 'BOOKING_DEBIT', 'BOOKING', appointment.id);
        console.log(`✅ Debited 5 points from user ${session.user.id} for booking ${appointment.id}`);
      } catch (pointsError: any) {
        // If insufficient points, rollback the appointment
        await prisma.appointment.delete({ where: { id: appointment.id } });
        
        // Revert availability
        await prisma.availability.updateMany({
          where: {
            barberName: data.selectedBarber,
            date: {
              gte: new Date(`${data.selectedDate}T00:00:00.000Z`),
              lt: new Date(`${data.selectedDate}T23:59:59.999Z`)
            },
            timeSlot: data.selectedTime,
            isBooked: true
          },
          data: {
            isBooked: false
          }
        });
        
        return NextResponse.json(
          { error: "Not enough points. Please subscribe or renew to continue." },
          { status: 402 }
        );
      }
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

    // Send email with calendar invite
    let emailResult: EmailResult = { emailed: false, reason: 'no-resend' };
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
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
      // Continue anyway - don't fail the booking
    }

    // Generate ICS URL for frontend download (fallback when email disabled)
    const icsBase64 = Buffer.from(icsContent).toString('base64');
    const icsUrl = `/api/bookings/ics/${appointment.id}`;

    return NextResponse.json({ 
      appointment, 
      emailed: emailResult.emailed,
      reason: emailResult.reason,
      icsUrl: emailResult.emailed ? undefined : icsUrl,
      icsContent: emailResult.emailed ? undefined : icsBase64 
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 400 });
    }
    console.error("POST /api/bookings error:", err);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
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