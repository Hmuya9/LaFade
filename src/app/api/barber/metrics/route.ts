import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import dayjs from "dayjs";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/barber/metrics
 * Returns barber-specific metrics for the logged-in barber
 * 
 * Auth required: Must be logged in as BARBER or OWNER
 * Returns: BarberMetricsResponse
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

    const barberId = barber.id;

    // Compute week boundaries (same pattern as admin metrics)
    const now = dayjs();
    const startWeek = now.startOf("week").toDate();
    const endWeek = now.endOf("week").toDate();

    // Free Cuts Given: appointments with kind="TRIAL_FREE" and status != "CANCELED"
    const freeCutsGiven = await prisma.appointment.count({
      where: {
        barberId: barberId,
        kind: "TRIAL_FREE",
        status: { not: "CANCELED" }
      }
    });

    // Free Cut Clients: distinct clientIds from same filter
    const freeCutAppointments = await prisma.appointment.findMany({
      where: {
        barberId: barberId,
        kind: "TRIAL_FREE",
        status: { not: "CANCELED" }
      },
      select: { clientId: true }
    });

    const uniqueClientIds = new Set(freeCutAppointments.map(apt => apt.clientId));
    const freeCutClients = uniqueClientIds.size;

    // Active Members: subscriptions where user has at least one appointment with this barber
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["TRIAL", "ACTIVE"] },
        user: {
          clientAppts: {
            some: { barberId: barberId }
          }
        }
      },
      include: {
        plan: true
      }
    });

    const activeMembers = activeSubscriptions.length;

    // Monthly Earnings (65%): sum of plan.priceMonthly for active members, multiplied by 0.65
    const monthlyEarningsCents = Math.round(
      activeSubscriptions.reduce((sum, sub) => {
        return sum + (sub.plan?.priceMonthly ?? 0);
      }, 0) * 0.65
    );

    // Utilization This Week: appointments in current week with status IN ("BOOKED", "CONFIRMED", "COMPLETED")
    const utilizationThisWeek = await prisma.appointment.count({
      where: {
        barberId: barberId,
        status: { in: ["BOOKED", "CONFIRMED", "COMPLETED"] },
        startAt: {
          gte: startWeek,
          lte: endWeek
        }
      }
    });

    // Conversion Rate: activeMembers / freeCutClients (0 if freeCutClients === 0)
    const conversionRate = freeCutClients > 0 ? activeMembers / freeCutClients : 0;

    return NextResponse.json({
      activeMembers,
      freeCutsGiven,
      freeCutClients,
      conversionRate,
      utilizationThisWeek,
      monthlyEarningsCents
    });
  } catch (error) {
    console.error("[api/barber/metrics] Error:", error);
    // Return zeroed metrics instead of 500 error (same pattern as admin metrics)
    return NextResponse.json({
      activeMembers: 0,
      freeCutsGiven: 0,
      freeCutClients: 0,
      conversionRate: 0,
      utilizationThisWeek: 0,
      monthlyEarningsCents: 0
    });
  }
}





