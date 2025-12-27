import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { REAL_APPOINTMENT_WHERE, withRealUsers } from "@/lib/analyticsFilters";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Threshold constants (week 1 defaults - can be tuned later)
const THRESHOLDS = {
  freeToMemberMin: 15, // WARN if freeToMember7d < 15%
  needsAttentionMax: 0, // ALERT if needsAttentionNow > 0
  freeCutsMin: 1, // WARN if freeCuts7d == 0
} as const;

interface KPIHealthResponse {
  window: {
    startAtISO: string;
    endAtISO: string;
  };
  krs: {
    freeCuts7d: number;
    secondCuts7d: number;
    newMembers7d: number;
    freeToMember7d: number;
    needsAttentionNow: number;
  };
  thresholds: {
    freeToMemberMin: number;
    needsAttentionMax: number;
  };
  breaches: Array<{
    key: string;
    severity: "WARN" | "ALERT";
    message: string;
    current: number;
    threshold: number;
  }>;
  ok: boolean;
}

/**
 * Compute needs attention count (same logic as /api/admin/needs-attention but returns count only)
 */
async function getNeedsAttentionCount(): Promise<number> {
  const now = dayjs();
  const twentyFourHoursAgo = now.subtract(24, "hours").toDate();
  const fourteenDaysAgo = now.subtract(14, "days").toDate();
  const todayStart = now.startOf("day").toDate();
  const todayEnd = now.endOf("day").toDate();

  // 1. Bookings unconfirmed > 24h
  const unconfirmedBookings = await prisma.appointment.count({
    where: {
      status: "BOOKED",
      startAt: { lt: now.add(24, "hours").toDate() },
      ...REAL_APPOINTMENT_WHERE,
    },
  });

  // 2. Upcoming today not confirmed
  const todayUnconfirmed = await prisma.appointment.count({
    where: {
      status: "BOOKED",
      startAt: {
        gte: todayStart,
        lte: todayEnd,
      },
      ...REAL_APPOINTMENT_WHERE,
    },
  });

  // 3. Free cuts >14d ago with no second cut
  const oldFreeCuts = await prisma.appointment.findMany({
    where: {
      kind: "TRIAL_FREE",
      status: { not: "CANCELED" },
      startAt: { lt: fourteenDaysAgo },
      ...REAL_APPOINTMENT_WHERE,
    },
    select: {
      clientId: true,
    },
  });

  // Get all clients who have a second cut or active subscription
  const [secondCutClientIds, activeSubClientIds] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        kind: "DISCOUNT_SECOND",
        status: { not: "CANCELED" },
        ...REAL_APPOINTMENT_WHERE,
      },
      select: {
        clientId: true,
      },
      distinct: ["clientId"],
    }).then(appts => new Set(appts.map(a => a.clientId))),
    prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIAL"] },
        user: withRealUsers({}),
      },
      select: {
        userId: true,
      },
    }).then(subs => new Set(subs.map(s => s.userId))),
  ]);

  // Filter: free cuts where client has NO second cut AND NO active subscription
  const staleFreeCutsCount = oldFreeCuts.filter(
    (apt) => !secondCutClientIds.has(apt.clientId) && !activeSubClientIds.has(apt.clientId)
  ).length;

  return unconfirmedBookings + todayUnconfirmed + staleFreeCutsCount;
}

/**
 * Compute KPI health metrics for last 7 days
 */
async function computeKPIHealth(): Promise<KPIHealthResponse> {
  const now = dayjs().tz("America/Los_Angeles");
  const startDate = now.subtract(7, "day").startOf("day").toDate();
  const endDate = now.toDate();

  // 1. Free cuts 7d
  const freeCuts7d = await prisma.appointment.count({
    where: {
      kind: "TRIAL_FREE",
      status: { not: "CANCELED" },
      startAt: { gte: startDate, lte: endDate },
      ...REAL_APPOINTMENT_WHERE,
    },
  });

  // 2. Second cuts 7d
  const secondCuts7d = await prisma.appointment.count({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
      startAt: { gte: startDate, lte: endDate },
      ...REAL_APPOINTMENT_WHERE,
    },
  });

  // 3. New members 7d (distinct users who started subscription in period)
  const newSubscriptions = await prisma.subscription.findMany({
    where: {
      startDate: { gte: startDate, lte: endDate },
      status: { in: ["ACTIVE", "TRIAL"] },
      user: withRealUsers({}),
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });
  const newMembers7d = newSubscriptions.length;

  // 4. Free to member conversion 7d
  // Get distinct clients with TRIAL_FREE in last 7d
  const freeCutClients = await prisma.appointment.findMany({
    where: {
      kind: "TRIAL_FREE",
      status: { not: "CANCELED" },
      startAt: { gte: startDate, lte: endDate },
      ...REAL_APPOINTMENT_WHERE,
    },
    select: {
      clientId: true,
    },
    distinct: ['clientId'],
  });
  const freeCutClientsCount = freeCutClients.length;
  const freeToMember7d = freeCutClientsCount > 0 
    ? (newMembers7d / freeCutClientsCount) * 100 
    : 0;

  // 5. Needs attention count
  const needsAttentionNow = await getNeedsAttentionCount();

  // Check breaches
  const breaches: KPIHealthResponse['breaches'] = [];

  // ALERT if needsAttentionNow > 0
  if (needsAttentionNow > THRESHOLDS.needsAttentionMax) {
    breaches.push({
      key: "needsAttentionNow",
      severity: "ALERT",
      message: "Operational issues require attention",
      current: needsAttentionNow,
      threshold: THRESHOLDS.needsAttentionMax,
    });
  }

  // WARN if freeToMember7d < 15
  if (freeToMember7d < THRESHOLDS.freeToMemberMin) {
    breaches.push({
      key: "freeToMember7d",
      severity: "WARN",
      message: "Free to member conversion below threshold",
      current: freeToMember7d,
      threshold: THRESHOLDS.freeToMemberMin,
    });
  }

  // WARN if freeCuts7d == 0
  if (freeCuts7d < THRESHOLDS.freeCutsMin) {
    breaches.push({
      key: "freeCuts7d",
      severity: "WARN",
      message: "No free cuts in last 7 days",
      current: freeCuts7d,
      threshold: THRESHOLDS.freeCutsMin,
    });
  }

  return {
    window: {
      startAtISO: dayjs(startDate).toISOString(),
      endAtISO: dayjs(endDate).toISOString(),
    },
    krs: {
      freeCuts7d,
      secondCuts7d,
      newMembers7d,
      freeToMember7d: Math.round(freeToMember7d * 10) / 10, // Round to 1 decimal
      needsAttentionNow,
    },
    thresholds: {
      freeToMemberMin: THRESHOLDS.freeToMemberMin,
      needsAttentionMax: THRESHOLDS.needsAttentionMax,
    },
    breaches,
    ok: breaches.length === 0,
  };
}

export async function GET() {
  try {
    await requireAdmin();

    const health = await computeKPIHealth();

    return NextResponse.json(health);
  } catch (error) {
    console.error("[api/admin/kpi-health] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to compute KPI health",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Export the compute function for reuse in cron route
export { computeKPIHealth };

