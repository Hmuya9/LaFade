import { requireRoleWithRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { 
  MEMBERSHIP_STANDARD_PRICE_CENTS, 
  SECOND_CUT_PRICE_CENTS,
  COMMISSION_BARBER_PERCENT,
  COMMISSION_LAFADE_PERCENT,
  OPS_COST_CENTS,
  formatPrice 
} from "@/lib/lafadeBusiness";
import { laf } from "@/components/ui/lafadeStyles";

export const dynamic = 'force-dynamic';

interface FunnelHealth {
  totalFreeCutsUsed: number;
  totalSecondCutsUsed: number;
  members: number;
  conversionRateFreeToMember: number;
  conversionRateFreeToSecond: number;
}

interface BarberPerformance {
  barberId: string;
  barberName: string | null;
  barberEmail: string | null;
  freeCutsGiven: number;
  secondCutsGiven: number;
  activeMemberships: number;
  estimatedMonthlyGross: number;
}

interface FreeLoader {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  freeCutDate: Date;
  daysSinceFreeCut: number;
  barberName: string | null;
}

async function getFunnelHealth(): Promise<FunnelHealth> {
  // 1. Total Free Cuts Used (distinct clients with TRIAL_FREE, non-canceled)
  const freeCutClients = await prisma.appointment.findMany({
    where: {
      kind: "TRIAL_FREE",
      status: { not: "CANCELED" },
    },
    select: {
      clientId: true,
    },
    distinct: ['clientId'],
  });
  const totalFreeCutsUsed = freeCutClients.length;

  // 2. Total $10 Second Cuts Used (distinct clients with DISCOUNT_SECOND, non-canceled)
  const secondCutClients = await prisma.appointment.findMany({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
    },
    select: {
      clientId: true,
    },
    distinct: ['clientId'],
  });
  const totalSecondCutsUsed = secondCutClients.length;

  // 3. Members (distinct users with ACTIVE or TRIAL subscriptions)
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });
  const members = activeSubscriptions.length;

  // 4. Conversion rates
  const conversionRateFreeToMember = totalFreeCutsUsed > 0 
    ? (members / totalFreeCutsUsed) * 100 
    : 0;
  
  const conversionRateFreeToSecond = totalFreeCutsUsed > 0
    ? (totalSecondCutsUsed / totalFreeCutsUsed) * 100
    : 0;

  return {
    totalFreeCutsUsed,
    totalSecondCutsUsed,
    members,
    conversionRateFreeToMember,
    conversionRateFreeToSecond,
  };
}

async function getBarberPerformance(): Promise<BarberPerformance[]> {
  // Get all barbers
  const barbers = await prisma.user.findMany({
    where: {
      role: { in: ["BARBER", "OWNER"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  // Get appointment counts by barber and kind
  const freeCutCounts = await prisma.appointment.groupBy({
    by: ['barberId'],
    where: {
      kind: "TRIAL_FREE",
      status: { not: "CANCELED" },
    },
    _count: {
      id: true,
    },
  });

  const secondCutCounts = await prisma.appointment.groupBy({
    by: ['barberId'],
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
    },
    _count: {
      id: true,
    },
  });

  // Build a map of barberId -> counts
  const freeCutMap = new Map(freeCutCounts.map(item => [item.barberId, item._count.id]));
  const secondCutMap = new Map(secondCutCounts.map(item => [item.barberId, item._count.id]));

  // For each barber, find their "attributed" members
  // Attribution: Use barberId from client's most recent TRIAL_FREE appointment
  const barberMemberCounts = new Map<string, number>();
  
  // Get all active subscriptions with their user IDs
  const activeSubUserIds = (await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    select: {
      userId: true,
    },
  })).map(s => s.userId);

  if (activeSubUserIds.length > 0) {
    // Get most recent TRIAL_FREE for each member (more efficient: single query with grouping)
    // We'll use a subquery approach: for each userId, get their most recent TRIAL_FREE barberId
    const memberFreeCuts = await prisma.appointment.findMany({
      where: {
        clientId: { in: activeSubUserIds },
        kind: "TRIAL_FREE",
        status: { not: "CANCELED" },
      },
      select: {
        clientId: true,
        barberId: true,
        startAt: true,
      },
      orderBy: {
        startAt: 'desc',
      },
    });

    // Group by clientId and take the most recent (already sorted desc)
    const clientToBarber = new Map<string, string>();
    for (const appointment of memberFreeCuts) {
      if (!clientToBarber.has(appointment.clientId)) {
        clientToBarber.set(appointment.clientId, appointment.barberId);
      }
    }

    // Count members per barber
    for (const barberId of clientToBarber.values()) {
      const current = barberMemberCounts.get(barberId) || 0;
      barberMemberCounts.set(barberId, current + 1);
    }
  }

  // Build performance array
  const performance: BarberPerformance[] = barbers.map(barber => {
    const freeCutsGiven = freeCutMap.get(barber.id) || 0;
    const secondCutsGiven = secondCutMap.get(barber.id) || 0;
    const activeMemberships = barberMemberCounts.get(barber.id) || 0;
    const estimatedMonthlyGross = activeMemberships * MEMBERSHIP_STANDARD_PRICE_CENTS;

    return {
      barberId: barber.id,
      barberName: barber.name,
      barberEmail: barber.email,
      freeCutsGiven,
      secondCutsGiven,
      activeMemberships,
      estimatedMonthlyGross,
    };
  });

  // Sort by estimated monthly gross (descending)
  return performance.sort((a, b) => b.estimatedMonthlyGross - a.estimatedMonthlyGross);
}

async function getFreeLoaders(): Promise<FreeLoader[]> {
  // Get all clients with TRIAL_FREE (non-canceled)
  const freeCutAppointments = await prisma.appointment.findMany({
    where: {
      kind: "TRIAL_FREE",
      status: { not: "CANCELED" },
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      barber: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      startAt: 'desc',
    },
    take: 50,
  });

  // Get all clients with DISCOUNT_SECOND (non-canceled) - to exclude
  const secondCutClientIds = new Set(
    (await prisma.appointment.findMany({
      where: {
        kind: "DISCOUNT_SECOND",
        status: { not: "CANCELED" },
      },
      select: {
        clientId: true,
      },
      distinct: ['clientId'],
    })).map(a => a.clientId)
  );

  // Get all clients with active subscriptions - to exclude
  const activeSubClientIds = new Set(
    (await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: {
        userId: true,
      },
    })).map(s => s.userId)
  );

  // Filter: must NOT have DISCOUNT_SECOND AND must NOT have active subscription
  const freeLoaders: FreeLoader[] = [];
  const today = new Date();

  for (const appointment of freeCutAppointments) {
    const clientId = appointment.clientId;
    
    // Skip if they have a second cut or active subscription
    if (secondCutClientIds.has(clientId) || activeSubClientIds.has(clientId)) {
      continue;
    }

    const freeCutDate = appointment.startAt;
    const daysSince = Math.floor((today.getTime() - freeCutDate.getTime()) / (1000 * 60 * 60 * 24));

    freeLoaders.push({
      userId: clientId,
      name: appointment.client.name,
      email: appointment.client.email,
      phone: appointment.client.phone,
      freeCutDate,
      daysSinceFreeCut: daysSince,
      barberName: appointment.barber.name,
    });
  }

  // Sort by days since free cut (descending - oldest first)
  return freeLoaders.sort((a, b) => b.daysSinceFreeCut - a.daysSinceFreeCut);
}

interface ProfitAnalysis {
  totalRevenue: number;
  barberPayout: number;
  lafadeRevenue: number;
  netProfit: number;
}

async function getProfitAnalysis(): Promise<ProfitAnalysis> {
  // Get active members count
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });
  const activeMembersCount = activeSubscriptions.length;

  // Get second cuts count (all time, since we're calculating monthly revenue)
  const secondCutsCount = await prisma.appointment.count({
    where: {
      kind: "DISCOUNT_SECOND",
      status: { not: "CANCELED" },
    },
  });

  // Revenue = (activeMembersCount * MEMBERSHIP_STANDARD_PRICE_CENTS) + (secondCutsCount * SECOND_CUT_PRICE_CENTS)
  const membershipRevenue = activeMembersCount * MEMBERSHIP_STANDARD_PRICE_CENTS;
  const secondCutRevenue = secondCutsCount * SECOND_CUT_PRICE_CENTS;
  const totalRevenue = membershipRevenue + secondCutRevenue;

  // Barber Payout = Revenue * 0.65
  const barberPayout = Math.round(totalRevenue * COMMISSION_BARBER_PERCENT);

  // LaFade Revenue = Revenue * 0.35
  const lafadeRevenue = Math.round(totalRevenue * COMMISSION_LAFADE_PERCENT);

  // Net Profit = LaFade Revenue - Ops Cost
  const netProfit = lafadeRevenue - OPS_COST_CENTS;

  return {
    totalRevenue,
    barberPayout,
    lafadeRevenue,
    netProfit,
  };
}

export default async function AdminDashboardPage() {
  // Require OWNER role
  await requireRoleWithRedirect(["OWNER"]);

  // Fetch all data in parallel
  const [funnelHealth, barberPerformance, freeLoaders, profitAnalysis] = await Promise.all([
    getFunnelHealth(),
    getBarberPerformance(),
    getFreeLoaders(),
    getProfitAnalysis(),
  ]);

  return (
    <div className={`${laf.page} ${laf.texture}`}>
      <div className={laf.container}>
        <header className="mb-8">
          <h1 className={laf.h1}>Growth Truth Dashboard</h1>
          <p className={laf.sub}>Data-first funnel health and barber performance</p>
        </header>

        {/* A) Global Funnel Health */}
        <section className="mb-12">
          <h2 className={laf.h2 + " mb-4"}>Global Funnel Health</h2>
          <div className={`${laf.card} ${laf.cardPad}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <div className="text-sm text-zinc-600 mb-1">Total Free Cuts Used</div>
                <div className="text-2xl font-semibold text-zinc-900">{funnelHealth.totalFreeCutsUsed}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">$10 Second Cuts Used</div>
                <div className="text-2xl font-semibold text-zinc-900">{funnelHealth.totalSecondCutsUsed}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">Active Members</div>
                <div className="text-2xl font-semibold text-zinc-900">{funnelHealth.members}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">Free → Member Conversion</div>
                <div className="text-2xl font-semibold text-zinc-900">
                  {funnelHealth.conversionRateFreeToMember.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">Free → Second Conversion</div>
                <div className="text-2xl font-semibold text-zinc-900">
                  {funnelHealth.conversionRateFreeToSecond.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* B) Barber Performance Table */}
        <section className="mb-12">
          <h2 className={laf.h2 + " mb-4"}>Barber Performance</h2>
          <div className={`${laf.card} ${laf.cardPad} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Barber</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Free Cuts Given</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">$10 Cuts Given</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Active Memberships</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Est. Monthly Gross</th>
                </tr>
              </thead>
              <tbody>
                {barberPerformance.map((barber) => (
                  <tr key={barber.barberId} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="py-3 px-4 text-sm text-zinc-900">
                      <div className="font-medium">{barber.barberName || "Unknown"}</div>
                      <div className="text-xs text-zinc-500">{barber.barberEmail || ""}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-700 text-right">{barber.freeCutsGiven}</td>
                    <td className="py-3 px-4 text-sm text-zinc-700 text-right">{barber.secondCutsGiven}</td>
                    <td className="py-3 px-4 text-sm text-zinc-700 text-right">{barber.activeMemberships}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-zinc-900 text-right">
                      {formatPrice(barber.estimatedMonthlyGross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* D) Profit Analysis - Commission Model */}
        <section className="mb-12">
          <h2 className={laf.h2 + " mb-4"}>Profit Analysis (Commission Model)</h2>
          <div className={`${laf.card} ${laf.cardPad}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-zinc-600 mb-1">Total Revenue</div>
                <div className="text-2xl font-semibold text-green-600">
                  {formatPrice(profitAnalysis.totalRevenue)}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">Barber Payout (65%)</div>
                <div className="text-2xl font-semibold text-zinc-900">
                  {formatPrice(profitAnalysis.barberPayout)}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">LaFade Revenue (35%)</div>
                <div className="text-2xl font-semibold text-blue-600">
                  {formatPrice(profitAnalysis.lafadeRevenue)}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">Net Profit (after ops)</div>
                <div className={`text-2xl font-semibold ${
                  profitAnalysis.netProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {formatPrice(profitAnalysis.netProfit)}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Ops: {formatPrice(OPS_COST_CENTS)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* C) Free Loader List */}
        <section>
          <h2 className={laf.h2 + " mb-4"}>Free Loaders (Top 50)</h2>
          <p className="text-sm text-zinc-600 mb-4">
            Clients who used free cut but have no second cut and no active membership
          </p>
          <div className={`${laf.card} ${laf.cardPad} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Phone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Free Cut Date</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Days Since</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Barber</th>
                </tr>
              </thead>
              <tbody>
                {freeLoaders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-sm text-zinc-500">
                      No free loaders found
                    </td>
                  </tr>
                ) : (
                  freeLoaders.map((loader) => (
                    <tr key={loader.userId} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-3 px-4 text-sm text-zinc-900">
                        {loader.name || loader.email || "Unknown"}
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-700">{loader.phone || "—"}</td>
                      <td className="py-3 px-4 text-sm text-zinc-700">
                        {loader.freeCutDate.toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-700 text-right">{loader.daysSinceFreeCut}</td>
                      <td className="py-3 px-4 text-sm text-zinc-700">{loader.barberName || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

