import { prisma } from "@/lib/db";
import { REAL_APPOINTMENT_WHERE, withRealUsers } from "@/lib/analyticsFilters";
import { 
  MEMBERSHIP_STANDARD_PRICE_CENTS, 
  SECOND_CUT_PRICE_CENTS,
  formatPrice 
} from "@/lib/lafadeBusiness";
import { laf } from "@/components/ui/lafadeStyles";
import dayjs from "dayjs";

async function getRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
  // Revenue from new subscriptions created in period
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

  // Revenue from second cuts in period
  const secondCuts = await prisma.appointment.count({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
      startAt: { gte: startDate, lte: endDate },
      ...REAL_APPOINTMENT_WHERE,
    },
  });
  const secondCutRevenue = secondCuts * SECOND_CUT_PRICE_CENTS;

  return subscriptionRevenue + secondCutRevenue;
}

async function getLifetimeMetrics(): Promise<{
  avgRevenuePerClient: number;
  avgRevenuePerBarber: number;
}> {
  // Total lifetime revenue
  // All subscriptions (distinct users) * membership price
  const allSubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL", "CANCELED"] }, // Include all for lifetime
      user: withRealUsers({}),
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });
  const totalSubscriptionRevenue = allSubscriptions.length * MEMBERSHIP_STANDARD_PRICE_CENTS;

  // All second cuts (lifetime)
  const allSecondCuts = await prisma.appointment.count({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
      ...REAL_APPOINTMENT_WHERE,
    },
  });
  const totalSecondCutRevenue = allSecondCuts * SECOND_CUT_PRICE_CENTS;

  const totalLifetimeRevenue = totalSubscriptionRevenue + totalSecondCutRevenue;

  // Distinct clients (users who have had subscriptions OR second cuts)
  const clientsWithSubscriptions = new Set(allSubscriptions.map(s => s.userId));
  const clientsWithSecondCuts = await prisma.appointment.findMany({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
      ...REAL_APPOINTMENT_WHERE,
    },
    select: {
      clientId: true,
    },
    distinct: ['clientId'],
  });
  clientsWithSecondCuts.forEach(apt => clientsWithSubscriptions.add(apt.clientId));
  const distinctClients = clientsWithSubscriptions.size;

  // Distinct barbers (BARBER or OWNER role, exclude test)
  const distinctBarbers = await prisma.user.count({
    where: {
      role: { in: ["BARBER", "OWNER"] },
      isTest: false,
    },
  });

  // Calculate averages
  const avgRevenuePerClient = distinctClients > 0 
    ? totalLifetimeRevenue / distinctClients 
    : 0;
  const avgRevenuePerBarber = distinctBarbers > 0 
    ? totalLifetimeRevenue / distinctBarbers 
    : 0;

  return {
    avgRevenuePerClient,
    avgRevenuePerBarber,
  };
}

export default async function RevenueReality() {
  const now = dayjs();
  const last7DaysStart = now.subtract(7, "day").startOf("day").toDate();
  const last7DaysEnd = now.toDate();
  const last30DaysStart = now.subtract(30, "day").startOf("day").toDate();
  const last30DaysEnd = now.toDate();

  // Fetch all metrics in parallel
  const [revenue7d, revenue30d, lifetimeMetrics] = await Promise.all([
    getRevenueForPeriod(last7DaysStart, last7DaysEnd),
    getRevenueForPeriod(last30DaysStart, last30DaysEnd),
    getLifetimeMetrics(),
  ]);

  return (
    <section className="mb-12">
      <h2 className={laf.h2 + " mb-4"}>Revenue Reality</h2>
      <div className={`${laf.card} ${laf.cardPad}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Revenue Last 7 Days */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">Revenue (7 days)</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {formatPrice(revenue7d)}
            </div>
          </div>

          {/* Revenue Last 30 Days */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">Revenue (30 days)</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {formatPrice(revenue30d)}
            </div>
          </div>

          {/* Avg Revenue Per Client */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">Avg Revenue Per Client (lifetime)</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {formatPrice(Math.round(lifetimeMetrics.avgRevenuePerClient))}
            </div>
          </div>

          {/* Avg Revenue Per Barber */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">Avg Revenue Per Barber (lifetime)</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {formatPrice(Math.round(lifetimeMetrics.avgRevenuePerBarber))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

