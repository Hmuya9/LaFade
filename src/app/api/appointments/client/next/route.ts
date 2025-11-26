import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/appointments/client/next
 * Returns the next upcoming appointment for the logged-in client
 * 
 * Auth required: Must be logged in as CLIENT
 * Returns: Appointment | null
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Robust user lookup (same as booking API and /account)
    const sessionUser = session.user as any;
    const sessionUserId = sessionUser.id as string | undefined;
    const sessionEmail = sessionUser.email as string | undefined;

    let client = null;

    // Prefer id if present
    if (sessionUserId) {
      client = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, role: true }
      });
    }

    // Fallback to email
    if (!client && sessionEmail) {
      client = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true, role: true }
      });
    }

    if (!client || client.role !== "CLIENT") {
      return NextResponse.json(
        { error: "Access denied. This endpoint is for clients only." },
        { status: 403 }
      );
    }

    const now = new Date();

    // Fetch next upcoming appointment (not canceled)
    const nextAppointment = await prisma.appointment.findFirst({
      where: {
        clientId: client.id,
        startAt: { gte: now },
        status: { not: "CANCELED" }
      },
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

    if (!nextAppointment) {
      return NextResponse.json({ appointment: null });
    }

    // Format appointment
    let planName = "Standard";
    if (nextAppointment.isFree) {
      planName = "Free Test Cut";
    } else if (nextAppointment.type === "HOME") {
      planName = "Deluxe";
    }

    const barberPhoto = nextAppointment.barber.photos?.[0]?.url || nextAppointment.barber.image || null;

    return NextResponse.json({
      appointment: {
        id: nextAppointment.id,
        barber: {
          id: nextAppointment.barber.id,
          name: nextAppointment.barber.name || nextAppointment.barber.email || "Barber",
          photo: barberPhoto
        },
        plan: planName,
        startAt: nextAppointment.startAt.toISOString(),
        endAt: nextAppointment.endAt.toISOString(),
        status: nextAppointment.status,
        type: nextAppointment.type,
        address: nextAppointment.address,
        notes: nextAppointment.notes
      }
    });
  } catch (error) {
    console.error("[api/appointments/client/next] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch next appointment" },
      { status: 500 }
    );
  }
}

