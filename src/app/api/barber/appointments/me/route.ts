import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/barber/appointments/me
 * Returns the logged-in barber's appointments (today + next 7 days)
 * 
 * Auth required: Must be logged in as BARBER or OWNER
 * Returns: { today: Appointment[], next7: Appointment[] }
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

    // Find the barber user
    const barber = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!barber || (barber.role !== "BARBER" && barber.role !== "OWNER")) {
      return NextResponse.json(
        { error: "Access denied. This endpoint is for barbers only." },
        { status: 403 }
      );
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const next7Days = new Date(now);
    next7Days.setDate(next7Days.getDate() + 7);
    next7Days.setHours(23, 59, 59, 999);

    // Fetch today's appointments
    const todayAppointments = await prisma.appointment.findMany({
      where: {
        barberId: barber.id,
        startAt: {
          gte: todayStart,
          lte: todayEnd
        },
        status: {
          in: ["BOOKED", "CONFIRMED"]
        }
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { startAt: "asc" }
    });

    // Fetch next 7 days appointments (excluding today)
    const next7Appointments = await prisma.appointment.findMany({
      where: {
        barberId: barber.id,
        startAt: {
          gt: todayEnd,
          lte: next7Days
        },
        status: {
          in: ["BOOKED", "CONFIRMED"]
        }
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { startAt: "asc" }
    });

    // Format appointments for response
    const formatAppointment = (apt: any) => {
      let planName = "Standard";
      if (apt.isFree) {
        planName = "Free Test Cut";
      } else if (apt.type === "HOME") {
        planName = "Deluxe";
      }

      return {
        id: apt.id,
        client: {
          id: apt.client.id,
          name: apt.client.name || apt.client.email || "Client",
          email: apt.client.email,
          phone: apt.client.phone
        },
        plan: planName,
        startAt: apt.startAt.toISOString(),
        endAt: apt.endAt.toISOString(),
        status: apt.status,
        type: apt.type,
        address: apt.address,
        notes: apt.notes,
        isFree: apt.isFree
      };
    };

    return NextResponse.json({
      today: todayAppointments.map(formatAppointment),
      next7: next7Appointments.map(formatAppointment)
    });
  } catch (error) {
    console.error("[api/barber/appointments/me] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}



