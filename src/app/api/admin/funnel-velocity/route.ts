import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { REAL_APPOINTMENT_WHERE } from "@/lib/analyticsFilters";
import dayjs from "dayjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Funnel Velocity Metrics
 * 
 * Aggregates appointments by kind (TRIAL_FREE, DISCOUNT_SECOND) across rolling windows:
 * - Last 7 days
 * - Last 14 days
 * - Last 30 days
 * 
 * Excludes test users from all metrics.
 */
export interface FunnelVelocityResponse {
  windows: {
    days7: WindowMetrics;
    days14: WindowMetrics;
    days30: WindowMetrics;
  };
}

export interface WindowMetrics {
  trialFree: number;
  discountSecond: number;
  total: number;
}

export async function GET() {
  try {
    await requireAdmin();

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

    const response: FunnelVelocityResponse = {
      windows: {
        days7: aggregateWindow(appts7),
        days14: aggregateWindow(appts14),
        days30: aggregateWindow(appts30),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/admin/funnel-velocity] Error:", error);
    // Return zeroed metrics on error
    return NextResponse.json({
      windows: {
        days7: { trialFree: 0, discountSecond: 0, total: 0 },
        days14: { trialFree: 0, discountSecond: 0, total: 0 },
        days30: { trialFree: 0, discountSecond: 0, total: 0 },
      },
    });
  }
}

