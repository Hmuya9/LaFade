import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/config/plans";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/appointments/me
 * Returns the logged-in client's appointments (upcoming + past)
 * 
 * Auth required: Must be logged in as CLIENT
 * Returns: { upcoming: Appointment[], past: Appointment[] }
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Find the client user
    const client = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!client || client.role !== "CLIENT") {
      return NextResponse.json(
        { error: "Access denied. This endpoint is for clients only." },
        { status: 403 }
      );
    }

    const now = new Date();

    // Fetch all appointments for this client
    const allAppointments = await prisma.appointment.findMany({
      where: { clientId: client.id },
      include: {
        barber: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            photos: {
              where: { isApproved: true },
              select: { url: true },
              take: 1,
              orderBy: { createdAt: "desc" }
            }
          }
        }
      },
      orderBy: { startAt: "asc" }
    });

    // Split into upcoming and past
    // Upcoming = startAt >= now AND status !== 'CANCELED'
    // Past = startAt < now (including CANCELED so we can see history)
    const upcoming = allAppointments
      .filter(apt => apt.startAt >= now && apt.status !== "CANCELED")
      .map(formatAppointmentForResponse);

    const past = allAppointments
      .filter(apt => apt.startAt < now)
      .map(formatAppointmentForResponse)
      .reverse(); // Most recent first

    return NextResponse.json({ upcoming, past });
  } catch (error) {
    console.error("[api/appointments/me] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

/**
 * Format appointment for API response
 * Derives plan name from isFree and type fields
 */
function formatAppointmentForResponse(apt: any) {
  // Derive plan name from appointment fields
  let planName = "Standard";
  if (apt.isFree) {
    planName = "Free Test Cut";
  } else if (apt.type === "HOME") {
    planName = "Deluxe";
  } else if (apt.type === "SHOP") {
    planName = "Standard";
  }

  // Get barber photo (first approved photo, or image field, or null)
  const barberPhoto = apt.barber.photos?.[0]?.url || apt.barber.image || null;

  return {
    id: apt.id,
    barber: {
      id: apt.barber.id,
      name: apt.barber.name || apt.barber.email || "Barber",
      photo: barberPhoto
    },
    plan: planName,
    startAt: apt.startAt.toISOString(),
    endAt: apt.endAt.toISOString(),
    status: apt.status,
    type: apt.type,
    address: apt.address,
    notes: apt.notes,
    createdAt: apt.createdAt?.toISOString() || apt.startAt.toISOString()
  };
}

