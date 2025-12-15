import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/barber/availability/weekly
 * Returns the logged-in barber's weekly availability ranges
 * 
 * Auth required: Must be logged in as BARBER or OWNER
 * Returns: { availabilities: { dayOfWeek, startTime, endTime }[] }
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

    // Fetch weekly availability
    const availabilities = await prisma.barberAvailability.findMany({
      where: { barberId: barber.id },
      orderBy: [
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    });

    return NextResponse.json({
      availabilities: availabilities.map(a => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    });
  } catch (error) {
    console.error("[api/barber/availability/weekly] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}








