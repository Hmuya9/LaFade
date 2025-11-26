import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/appointments/[id]
 * Get a single appointment by ID
 * 
 * Auth required: Must be logged in
 * Returns: Appointment details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check permissions: user must be the client or barber
    const isClient = appointment.clientId === user.id;
    const isBarber = appointment.barberId === user.id;
    const isOwner = user.role === "OWNER";

    if (!isClient && !isBarber && !isOwner) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Format response
    let planName = "Standard";
    if (appointment.isFree) {
      planName = "Free Test Cut";
    } else if (appointment.type === "HOME") {
      planName = "Deluxe";
    }

    const barberPhoto = appointment.barber.photos?.[0]?.url || appointment.barber.image || null;

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        client: {
          id: appointment.client.id,
          name: appointment.client.name || appointment.client.email || "Client",
          email: appointment.client.email
        },
        barber: {
          id: appointment.barber.id,
          name: appointment.barber.name || appointment.barber.email || "Barber",
          email: appointment.barber.email,
          photo: barberPhoto
        },
        plan: planName,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        status: appointment.status,
        type: appointment.type,
        address: appointment.address,
        notes: appointment.notes,
        isFree: appointment.isFree
      }
    });
  } catch (error) {
    console.error("[api/appointments/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment" },
      { status: 500 }
    );
  }
}



