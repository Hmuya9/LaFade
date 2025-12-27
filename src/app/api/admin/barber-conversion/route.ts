import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { REAL_APPOINTMENT_WHERE, withRealUsers } from "@/lib/analyticsFilters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Barber Conversion Metrics
 * 
 * For each barber, calculates:
 * - Free → Second %: Percentage of free cuts that converted to $10 second cuts
 * - Free → Member %: Percentage of free cuts that converted to active memberships
 * 
 * Excludes test users from all metrics.
 * Returns sorted by Free → Member % (descending).
 */
export interface BarberConversionResponse {
  barbers: BarberConversion[];
}

export interface BarberConversion {
  barberId: string;
  barberName: string | null;
  barberEmail: string | null;
  freeCutsGiven: number;
  secondCutsConverted: number;
  membersConverted: number;
  freeToSecondPercent: number;
  freeToMemberPercent: number;
}

export async function GET() {
  try {
    await requireAdmin();

    // Get all barbers (exclude test barbers)
    const barbers = await prisma.user.findMany({
      where: {
        role: { in: ["BARBER", "OWNER"] },
        isTest: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Get all free cuts by barber (exclude test users)
    const freeCutsByBarber = await prisma.appointment.groupBy({
      by: ["barberId"],
      where: {
        kind: "TRIAL_FREE",
        status: { not: "CANCELED" },
        ...REAL_APPOINTMENT_WHERE,
      },
      _count: {
        id: true,
      },
    });

    // Get all second cuts by barber (exclude test users)
    const secondCutsByBarber = await prisma.appointment.groupBy({
      by: ["barberId"],
      where: {
        kind: "DISCOUNT_SECOND",
        status: { not: "CANCELED" },
        ...REAL_APPOINTMENT_WHERE,
      },
      _count: {
        id: true,
      },
    });

    // Build maps for quick lookup
    const freeCutsMap = new Map(
      freeCutsByBarber.map((item) => [item.barberId, item._count.id])
    );
    const secondCutsMap = new Map(
      secondCutsByBarber.map((item) => [item.barberId, item._count.id])
    );

    // Get all active subscriptions (exclude test users)
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIAL"] },
        user: withRealUsers({}),
      },
      select: {
        userId: true,
      },
    });

    const activeMemberIds = new Set(activeSubscriptions.map((s) => s.userId));

    // For each member, find their most recent free cut barber (attribution)
    const memberFreeCuts = await prisma.appointment.findMany({
      where: {
        clientId: { in: Array.from(activeMemberIds) },
        kind: "TRIAL_FREE",
        status: { not: "CANCELED" },
        ...REAL_APPOINTMENT_WHERE,
      },
      select: {
        clientId: true,
        barberId: true,
        startAt: true,
      },
      orderBy: {
        startAt: "desc",
      },
    });

    // Group by clientId and take most recent (already sorted desc)
    const clientToBarber = new Map<string, string>();
    for (const appointment of memberFreeCuts) {
      if (!clientToBarber.has(appointment.clientId)) {
        clientToBarber.set(appointment.clientId, appointment.barberId);
      }
    }

    // Count members per barber
    const membersByBarber = new Map<string, number>();
    for (const barberId of clientToBarber.values()) {
      const current = membersByBarber.get(barberId) || 0;
      membersByBarber.set(barberId, current + 1);
    }

    // Build conversion metrics for each barber
    const conversions: BarberConversion[] = barbers.map((barber) => {
      const freeCutsGiven = freeCutsMap.get(barber.id) || 0;
      const secondCutsConverted = secondCutsMap.get(barber.id) || 0;
      const membersConverted = membersByBarber.get(barber.id) || 0;

      const freeToSecondPercent =
        freeCutsGiven > 0 ? (secondCutsConverted / freeCutsGiven) * 100 : 0;
      const freeToMemberPercent =
        freeCutsGiven > 0 ? (membersConverted / freeCutsGiven) * 100 : 0;

      return {
        barberId: barber.id,
        barberName: barber.name,
        barberEmail: barber.email,
        freeCutsGiven,
        secondCutsConverted,
        membersConverted,
        freeToSecondPercent: Math.round(freeToSecondPercent * 10) / 10, // Round to 1 decimal
        freeToMemberPercent: Math.round(freeToMemberPercent * 10) / 10,
      };
    });

    // Sort by Free → Member % (descending)
    conversions.sort((a, b) => b.freeToMemberPercent - a.freeToMemberPercent);

    const response: BarberConversionResponse = {
      barbers: conversions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/admin/barber-conversion] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch barber conversion metrics" },
      { status: 500 }
    );
  }
}

