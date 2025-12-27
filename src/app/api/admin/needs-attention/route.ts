import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { REAL_APPOINTMENT_WHERE, withRealUsers } from "@/lib/analyticsFilters";
import dayjs from "dayjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Needs-Attention Ops Feed
 * 
 * Unified response for operational issues requiring attention:
 * 1. Bookings unconfirmed > 24h
 * 2. Upcoming today not confirmed
 * 3. Free cuts >14d ago with no second cut
 * 
 * Excludes test users from all queries.
 */
export interface NeedsAttentionResponse {
  unconfirmedBookings: UnconfirmedBooking[];
  todayUnconfirmed: TodayUnconfirmed[];
  staleFreeCuts: StaleFreeCut[];
}

export interface UnconfirmedBooking {
  appointmentId: string;
  clientName: string | null;
  clientEmail: string | null;
  barberName: string | null;
  startAt: string;
  hoursUnconfirmed: number;
  status: string;
}

export interface TodayUnconfirmed {
  appointmentId: string;
  clientName: string | null;
  clientEmail: string | null;
  barberName: string | null;
  startAt: string;
  status: string;
}

export interface StaleFreeCut {
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  freeCutDate: string;
  daysSinceFreeCut: number;
  barberName: string | null;
}

export async function GET() {
  try {
    await requireAdmin();

    const now = dayjs();
    const twentyFourHoursAgo = now.subtract(24, "hours").toDate();
    const fourteenDaysAgo = now.subtract(14, "days").toDate();
    const todayStart = now.startOf("day").toDate();
    const todayEnd = now.endOf("day").toDate();

    // 1. Bookings unconfirmed > 24h (status = BOOKED, startAt > 24h in the future but status still BOOKED)
    // We'll use startAt as proxy - if appointment is in the past or >24h from now and still BOOKED, it needs attention
    const unconfirmedBookings = await prisma.appointment.findMany({
      where: {
        status: "BOOKED",
        startAt: { lt: now.add(24, "hours").toDate() }, // Start time is within 24h or in past
        ...REAL_APPOINTMENT_WHERE,
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
        barber: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startAt: "asc", // Oldest first
      },
      take: 50, // Limit for performance
    });

    // 2. Upcoming today not confirmed (startAt is today, status = BOOKED)
    const todayUnconfirmed = await prisma.appointment.findMany({
      where: {
        status: "BOOKED",
        startAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        ...REAL_APPOINTMENT_WHERE,
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
        barber: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    });

    // 3. Free cuts >14d ago with no second cut
    // Get all free cuts >14d ago (exclude test users)
    const oldFreeCuts = await prisma.appointment.findMany({
      where: {
        kind: "TRIAL_FREE",
        status: { not: "CANCELED" },
        startAt: { lt: fourteenDaysAgo },
        ...REAL_APPOINTMENT_WHERE,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        barber: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    });

    // Get all clients who have a second cut (exclude test users)
    const secondCutClientIds = new Set(
      (
        await prisma.appointment.findMany({
          where: {
            kind: "DISCOUNT_SECOND",
            status: { not: "CANCELED" },
            ...REAL_APPOINTMENT_WHERE,
          },
          select: {
            clientId: true,
          },
          distinct: ["clientId"],
        })
      ).map((a) => a.clientId)
    );

    // Get all clients with active subscriptions (exclude test users)
    const activeSubClientIds = new Set(
      (
        await prisma.subscription.findMany({
          where: {
            status: { in: ["ACTIVE", "TRIAL"] },
            user: withRealUsers({}),
          },
          select: {
            userId: true,
          },
        })
      ).map((s) => s.userId)
    );

    // Filter: free cuts where client has NO second cut AND NO active subscription
    const staleFreeCuts: StaleFreeCut[] = [];
    for (const appointment of oldFreeCuts) {
      const clientId = appointment.clientId;
      if (
        !secondCutClientIds.has(clientId) &&
        !activeSubClientIds.has(clientId)
      ) {
        const daysSince = Math.floor(
          (now.valueOf() - dayjs(appointment.startAt).valueOf()) /
            (1000 * 60 * 60 * 24)
        );
        staleFreeCuts.push({
          clientId,
          clientName: appointment.client.name,
          clientEmail: appointment.client.email,
          freeCutDate: appointment.startAt.toISOString(),
          daysSinceFreeCut: daysSince,
          barberName: appointment.barber.name,
        });
      }
    }

    // Sort stale free cuts by days since (descending - oldest first)
    staleFreeCuts.sort((a, b) => b.daysSinceFreeCut - a.daysSinceFreeCut);

    // Format unconfirmed bookings
    const formattedUnconfirmed: UnconfirmedBooking[] = unconfirmedBookings.map(
      (apt) => {
        // Calculate hours until start time (negative if in past)
        const hoursUntilStart = Math.floor(
          (dayjs(apt.startAt).valueOf() - now.valueOf()) / (1000 * 60 * 60)
        );
        // If in past, use positive hours since start; if future, use hours until start
        const hoursUnconfirmed = hoursUntilStart < 0 
          ? Math.abs(hoursUntilStart) 
          : 24 - hoursUntilStart;
        return {
          appointmentId: apt.id,
          clientName: apt.client.name,
          clientEmail: apt.client.email,
          barberName: apt.barber.name,
          startAt: apt.startAt.toISOString(),
          hoursUnconfirmed: Math.max(0, hoursUnconfirmed),
          status: apt.status,
        };
      }
    );

    // Format today unconfirmed
    const formattedToday: TodayUnconfirmed[] = todayUnconfirmed.map((apt) => ({
      appointmentId: apt.id,
      clientName: apt.client.name,
      clientEmail: apt.client.email,
      barberName: apt.barber.name,
      startAt: apt.startAt.toISOString(),
      status: apt.status,
    }));

    const response: NeedsAttentionResponse = {
      unconfirmedBookings: formattedUnconfirmed,
      todayUnconfirmed: formattedToday,
      staleFreeCuts: staleFreeCuts.slice(0, 50), // Limit to top 50
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/admin/needs-attention] Error:", error);
    return NextResponse.json(
      {
        unconfirmedBookings: [],
        todayUnconfirmed: [],
        staleFreeCuts: [],
      },
      { status: 200 } // Return empty arrays instead of error
    );
  }
}

