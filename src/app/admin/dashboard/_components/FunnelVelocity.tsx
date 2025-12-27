import { prisma } from "@/lib/db";
import { REAL_APPOINTMENT_WHERE } from "@/lib/analyticsFilters";
import { laf } from "@/components/ui/lafadeStyles";
import dayjs from "dayjs";

interface WindowMetrics {
  trialFree: number;
  discountSecond: number;
  total: number;
}

async function getFunnelVelocityData(): Promise<{
  days7: WindowMetrics;
  days14: WindowMetrics;
  days30: WindowMetrics;
}> {
  const now = dayjs();
  const start7 = now.subtract(7, "day").toDate();
  const start14 = now.subtract(14, "day").toDate();
  const start30 = now.subtract(30, "day").toDate();

  // Query appointments in parallel for all windows
  // Using indexed fields: startAt, kind, status
  const [appts7, appts14, appts30] = await Promise.all([
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
    // Last 30 days
    prisma.appointment.findMany({
      where: {
        startAt: { gte: start30 },
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
    days30: aggregateWindow(appts30),
  };
}

export default async function FunnelVelocity() {
  const data = await getFunnelVelocityData();

  const rows = [
    { window: "7 days", metrics: data.days7 },
    { window: "14 days", metrics: data.days14 },
    { window: "30 days", metrics: data.days30 },
  ];

  return (
    <section className="mb-12">
      <h2 className={laf.h2 + " mb-4"}>Funnel Velocity</h2>
      <div className={`${laf.card} ${laf.cardPad} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Window</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Free Cuts</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Second Cuts</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.window} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-3 px-4 text-sm text-zinc-900 font-medium">{row.window}</td>
                <td className="py-3 px-4 text-sm text-zinc-700 text-right">
                  {row.metrics.trialFree.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm text-zinc-700 text-right">
                  {row.metrics.discountSecond.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm font-semibold text-zinc-900 text-right">
                  {row.metrics.total.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

