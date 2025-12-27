import { requireRoleWithRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { laf } from "@/components/ui/lafadeStyles";
import StickyHeaderKPIs from "./_components/StickyHeaderKPIs";
import WeeklySnapshot from "./_components/WeeklySnapshot";
import FunnelVelocity from "./_components/FunnelVelocity";
import NeedsAttention from "./_components/NeedsAttention";
import BarberPerformance from "./_components/BarberPerformance";
import RevenueReality from "./_components/RevenueReality";
import ClientHealth from "./_components/ClientHealth";

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // Require OWNER role
  await requireRoleWithRedirect(["OWNER"]);

  // Get test data counts for badge
  const testDataCounts = await Promise.all([
    prisma.user.count({ where: { isTest: true } }),
    prisma.appointment.count({
      where: {
        OR: [
          { client: { isTest: true } },
          { barber: { isTest: true } },
        ],
      },
    }),
  ]).then(([testUsers, testAppointments]) => ({ testUsers, testAppointments }));

  return (
    <div className={`${laf.page} ${laf.texture}`}>
      <StickyHeaderKPIs />
      <div className={laf.container}>
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className={laf.h1}>Growth Truth Dashboard</h1>
              <p className={laf.sub}>Data-first funnel health and barber performance</p>
            </div>
            {(testDataCounts.testUsers > 0 || testDataCounts.testAppointments > 0) && (
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Test data: {testDataCounts.testUsers} users, {testDataCounts.testAppointments} appointments
                </span>
              </div>
            )}
          </div>
        </header>

        <WeeklySnapshot />
        <FunnelVelocity />
        <NeedsAttention />
        <BarberPerformance />
        <RevenueReality />
        <ClientHealth />
      </div>
    </div>
  );
}

