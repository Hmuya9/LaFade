import { prisma } from "@/lib/db";
import { REAL_APPOINTMENT_WHERE, withRealUsers } from "@/lib/analyticsFilters";
import { 
  MEMBERSHIP_STANDARD_PRICE_CENTS, 
  SECOND_CUT_PRICE_CENTS,
  formatPrice 
} from "@/lib/lafadeBusiness";
import dayjs from "dayjs";

interface KPIData {
  netMembers: number;
  freeToMemberConversion: number;
  revenue: number;
  needsAttention: number;
}

interface KPIDataWithDelta extends KPIData {
  netMembersDelta: number;
  freeToMemberConversionDelta: number;
  revenueDelta: number;
  needsAttentionDelta: number;
}

async function getNeedsAttentionCount(referenceDate?: Date): Promise<number> {
  const now = referenceDate ? dayjs(referenceDate) : dayjs();
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

async function getKPIData(startDate: Date, endDate: Date): Promise<KPIData> {
  // 1. Net Members = new members - churned members
  // New members: distinct users with subscriptions created in period with status ACTIVE or TRIAL
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
  const newMembers = newSubscriptions.length;

  // Churned members: distinct users who had active subscription before period start
  // but now only have canceled subscriptions (and canceled happened in period)
  // We'll approximate by counting canceled subscriptions with renewsAt in period
  // that belong to users who don't have active subscriptions now
  const canceledInPeriod = await prisma.subscription.findMany({
    where: {
      status: "CANCELED",
      renewsAt: { gte: startDate, lte: endDate },
      user: withRealUsers({}),
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });

  // Check which of these users don't have active subscriptions now
  const canceledUserIds = canceledInPeriod.map(s => s.userId);
  let churnedMembers = 0;
  if (canceledUserIds.length > 0) {
    const usersWithActive = await prisma.subscription.findMany({
      where: {
        userId: { in: canceledUserIds },
        status: { in: ["ACTIVE", "TRIAL"] },
        user: withRealUsers({}),
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });
    const usersWithActiveSet = new Set(usersWithActive.map(s => s.userId));
    churnedMembers = canceledUserIds.filter(id => !usersWithActiveSet.has(id)).length;
  }

  const netMembers = newMembers - churnedMembers;

  // 2. Free → Member conversion % (last 7 days)
  // Get distinct clients with free cuts in period
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
  const freeCutCount = freeCutClients.length;

  // Get clients who had free cut in period AND now have active subscription
  const freeCutClientIds = freeCutClients.map(a => a.clientId);
  let convertedCount = 0;
  if (freeCutClientIds.length > 0) {
    const convertedClients = await prisma.subscription.findMany({
      where: {
        userId: { in: freeCutClientIds },
        status: { in: ["ACTIVE", "TRIAL"] },
        user: withRealUsers({}),
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });
    convertedCount = convertedClients.length;
  }

  const freeToMemberConversion = freeCutCount > 0 
    ? (convertedCount / freeCutCount) * 100 
    : 0;

  // 3. Revenue (last 7 days)
  // New subscriptions created in period
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
  const subscriptionRevenue = newSubscriptions.length * MEMBERSHIP_STANDARD_PRICE_CENTS;

  // Second cuts in period
  const secondCuts = await prisma.appointment.count({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
      startAt: { gte: startDate, lte: endDate },
      ...REAL_APPOINTMENT_WHERE,
    },
  });
  const secondCutRevenue = secondCuts * SECOND_CUT_PRICE_CENTS;

  const revenue = subscriptionRevenue + secondCutRevenue;

  // 4. Needs Attention count (computed at end of period)
  const needsAttention = await getNeedsAttentionCount(endDate);

  return {
    netMembers,
    freeToMemberConversion,
    revenue,
    needsAttention,
  };
}

export default async function StickyHeaderKPIs() {
  const now = dayjs();
  const last7DaysStart = now.subtract(7, "day").startOf("day").toDate();
  const last7DaysEnd = now.toDate(); // Use current time, not end of day
  const previous7DaysStart = now.subtract(14, "day").startOf("day").toDate();
  const previous7DaysEnd = now.subtract(7, "day").toDate(); // Use 7 days ago, not end of day

  // Fetch both periods in parallel
  const [currentPeriod, previousPeriod] = await Promise.all([
    getKPIData(last7DaysStart, last7DaysEnd),
    getKPIData(previous7DaysStart, previous7DaysEnd),
  ]);

  const data: KPIDataWithDelta = {
    netMembers: currentPeriod.netMembers,
    netMembersDelta: currentPeriod.netMembers - previousPeriod.netMembers,
    freeToMemberConversion: currentPeriod.freeToMemberConversion,
    freeToMemberConversionDelta: currentPeriod.freeToMemberConversion - previousPeriod.freeToMemberConversion,
    revenue: currentPeriod.revenue,
    revenueDelta: currentPeriod.revenue - previousPeriod.revenue,
    needsAttention: currentPeriod.needsAttention,
    needsAttentionDelta: currentPeriod.needsAttention - previousPeriod.needsAttention,
  };

  const formatDelta = (delta: number, isPercentage: boolean = false): string => {
    if (delta === 0) return "—";
    const sign = delta > 0 ? "+" : "";
    const value = isPercentage ? delta.toFixed(1) : Math.abs(delta).toLocaleString();
    return `${sign}${value}${isPercentage ? "%" : ""}`;
  };

  const getDeltaColor = (delta: number, invert: boolean = false): string => {
    if (delta === 0) return "text-zinc-500";
    const isPositive = delta > 0;
    const shouldBeGreen = invert ? !isPositive : isPositive;
    return shouldBeGreen ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net Members */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="text-xs text-zinc-600 mb-1">Net Members (7d)</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-zinc-900">
                {data.netMembers > 0 ? `+${data.netMembers}` : data.netMembers}
              </div>
              <div className={`text-sm font-medium ${getDeltaColor(data.netMembersDelta)}`}>
                {formatDelta(data.netMembersDelta)}
              </div>
            </div>
          </div>

          {/* Free → Member Conversion */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="text-xs text-zinc-600 mb-1">Free → Member % (7d)</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-zinc-900">
                {data.freeToMemberConversion.toFixed(1)}%
              </div>
              <div className={`text-sm font-medium ${getDeltaColor(data.freeToMemberConversionDelta, false)}`}>
                {formatDelta(data.freeToMemberConversionDelta, true)}
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="text-xs text-zinc-600 mb-1">Revenue (7d)</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-zinc-900">
                {formatPrice(data.revenue)}
              </div>
              <div className={`text-sm font-medium ${getDeltaColor(data.revenueDelta)}`}>
                {formatDelta(data.revenueDelta)}
              </div>
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="text-xs text-zinc-600 mb-1">Needs Attention</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-zinc-900">
                {data.needsAttention}
              </div>
              <div className={`text-sm font-medium ${getDeltaColor(data.needsAttentionDelta, true)}`}>
                {formatDelta(data.needsAttentionDelta)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

