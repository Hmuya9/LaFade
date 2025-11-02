import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildICS } from "@/lib/calendar";

export const runtime = "nodejs";

// Validation schema for appointment ID parameter
const appointmentIdSchema = z.object({
  id: z.string().cuid("Invalid appointment ID format")
});

// Validation schema for appointment status
const validStatuses = ["BOOKED", "CONFIRMED", "COMPLETED"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate appointment ID format
    const validationResult = appointmentIdSchema.safeParse(params);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: "Invalid appointment ID", 
        details: validationResult.error.issues 
      }, { status: 400 });
    }

    const { id } = validationResult.data;

    // Fetch appointment with related data
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true } },
        barber: { select: { name: true, email: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ 
        error: "Appointment not found",
        message: "The requested appointment does not exist or has been deleted"
      }, { status: 404 });
    }

    // Validate appointment can generate ICS (not canceled or no-show)
    if (appointment.status === "CANCELED" || appointment.status === "NO_SHOW") {
      return NextResponse.json({ 
        error: "Cannot generate calendar file",
        message: `Appointment is ${appointment.status.toLowerCase()} and cannot be added to calendar`
      }, { status: 400 });
    }

    // Validate appointment dates are in the future or recent past
    const now = new Date();
    const appointmentDate = new Date(appointment.startAt);
    const daysSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Don't allow ICS generation for appointments more than 7 days in the past
    if (daysSinceAppointment > 7) {
      return NextResponse.json({ 
        error: "Appointment is too old",
        message: "Calendar files can only be generated for upcoming or recent appointments"
      }, { status: 400 });
    }

    const barberName = appointment.barber.name || "Le Fade Barber";
    const barberEmail = appointment.barber.email || "no-reply@lefade.com";

    // Generate ICS calendar file
    const icsContent = buildICS({
      title: `${appointment.type === "HOME" ? "Deluxe" : appointment.isFree ? "Free Trial" : "Standard"} Cut with ${barberName}`,
      description: appointment.notes || "Haircut appointment",
      start: appointment.startAt,
      end: appointment.endAt,
      location: appointment.address || "Le Fade Barbershop",
      organizer: { 
        name: barberName, 
        email: barberEmail 
      }
    });

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="lefade_appointment_${id}.ics"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error("ICS download error:", error);
    
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: error.issues 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: "Failed to generate calendar file",
      message: "An unexpected error occurred while generating the calendar file"
    }, { status: 500 });
  }
}