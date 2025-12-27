import { prisma } from "@/lib/db";
import { REAL_APPOINTMENT_WHERE, withRealUsers } from "@/lib/analyticsFilters";
import dayjs from "dayjs";

interface WindowMetrics {
  trialFree: number;
  discountSecond: number;
  total: number;
}

async function getFunnelVelocityData(): Promise<{
  days7: WindowMetrics;
  days14: WindowMetrics;
}> {
  const now = dayjs();
  const start7 = now.subtract(7, "day").toDate();
  const start14 = now.subtract(14, "day").toDate();

  // Query appointments in parallel for both windows
  // Using indexed fields: startAt, kind, status
  const [appts7, appts14] = await Promise.all([
    // Last 7 days
    prisma.appointment.findMany({
      where: {
        startAt: { gte: start7 },
        kind: { in: ["TRIAL_FREE", "DISCOUNT_SECOND"] },
        status: { not: "CANCELED" },
        ...REAL_APPOINTMENT_WHERE,
      },
      select: { kind: true },
    }),
    // Last 14 days
    prisma.appointment.findMany({
      where: {
        startAt: { gte: start14 },
        kind: { in: ["TRIAL_FREE", "DISCOUNT_SECOND"] },
        status: { not: "CANCELED" },
        ...REAL_APPOINTMENT_WHERE,
      },
      select: { kind: true },
    }),
  ]);

  // Aggregate by kind for each window
  const aggregateWindow = (appts: Array<{ kind: string | null }>): WindowMetrics => {
    const trialFree = appts.filter((a) => a.kind === "TRIAL_FREE").length;
    const discountSecond = appts.filter((a) => a.kind === "DISCOUNT_SECOND").length;
    return {
      trialFree,
      discountSecond,
      total: trialFree + discountSecond,
    };
  };

  return {
    days7: aggregateWindow(appts7),
    days14: aggregateWindow(appts14),
  };
}

async function getNewMembersCount(startDate: Date, endDate: Date): Promise<number> {
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
  return newSubscriptions.length;
}

export default async function WeeklySnapshot() {
  const now = dayjs();
  const last7DaysStart = now.subtract(7, "day").startOf("day").toDate();
  const last7DaysEnd = now.toDate();
  const previous7DaysStart = now.subtract(14, "day").startOf("day").toDate();
  const previous7DaysEnd = now.subtract(7, "day").toDate();

  // Fetch funnel velocity data and new members in parallel
  const [funnelData, currentNewMembers, previousNewMembers] = await Promise.all([
    getFunnelVelocityData(),
    getNewMembersCount(last7DaysStart, last7DaysEnd),
    getNewMembersCount(previous7DaysStart, previous7DaysEnd),
  ]);

  // Calculate deltas
  // Previous 7-day window = days14 - days7 (days 8-14)
  const previousFreeCuts = funnelData.days14.trialFree - funnelData.days7.trialFree;
  const previousSecondCuts = funnelData.days14.discountSecond - funnelData.days7.discountSecond;

  const freeCutsDelta = funnelData.days7.trialFree - previousFreeCuts;
  const secondCutsDelta = funnelData.days7.discountSecond - previousSecondCuts;
  const newMembersDelta = currentNewMembers - previousNewMembers;

  const formatDelta = (delta: number): string => {
    if (delta === 0) return "—";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${Math.abs(delta).toLocaleString()}`;
  };

  const getDeltaColor = (delta: number): string => {
    if (delta === 0) return "text-zinc-500";
    return delta > 0 ? "text-green-600" : "text-red-600";
  };

  const getArrow = (delta: number): string => {
    if (delta === 0) return "→";
    return delta > 0 ? "↑" : "↓";
  };

  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold text-zinc-900 mb-6">Weekly Snapshot</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Cuts Card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
          <div className="text-sm text-zinc-600 mb-2">Free Cuts (7 days)</div>
          <div className="flex items-baseline gap-3 mb-3">
            <div className="text-4xl font-bold text-zinc-900">
              {funnelData.days7.trialFree.toLocaleString()}
            </div>
            <div className={`text-lg font-semibold ${getDeltaColor(freeCutsDelta)}`}>
              {getArrow(freeCutsDelta)}
            </div>
          </div>
          <div className={`text-sm font-medium ${getDeltaColor(freeCutsDelta)}`}>
            {formatDelta(freeCutsDelta)} vs previous 7 days
          </div>
        </div>

        {/* Second Cuts Card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
          <div className="text-sm text-zinc-600 mb-2">Second Cuts (7 days)</div>
          <div className="flex items-baseline gap-3 mb-3">
            <div className="text-4xl font-bold text-zinc-900">
              {funnelData.days7.discountSecond.toLocaleString()}
            </div>
            <div className={`text-lg font-semibold ${getDeltaColor(secondCutsDelta)}`}>
              {getArrow(secondCutsDelta)}
            </div>
          </div>
          <div className={`text-sm font-medium ${getDeltaColor(secondCutsDelta)}`}>
            {formatDelta(secondCutsDelta)} vs previous 7 days
          </div>
        </div>

        {/* New Members Card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
          <div className="text-sm text-zinc-600 mb-2">New Members (7 days)</div>
          <div className="flex items-baseline gap-3 mb-3">
            <div className="text-4xl font-bold text-zinc-900">
              {currentNewMembers.toLocaleString()}
            </div>
            <div className={`text-lg font-semibold ${getDeltaColor(newMembersDelta)}`}>
              {getArrow(newMembersDelta)}
            </div>
          </div>
          <div className={`text-sm font-medium ${getDeltaColor(newMembersDelta)}`}>
            {formatDelta(newMembersDelta)} vs previous 7 days
          </div>
        </div>
      </div>
    </section>
  );
}

