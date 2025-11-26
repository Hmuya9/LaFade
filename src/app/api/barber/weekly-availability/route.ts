import { NextRequest, NextResponse } from "next/server";
import { getBarberWeeklySummary } from "@/lib/barber-weekly-summary";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * Get weekly availability summary for a barber.
 * 
 * Query params:
 * - barberId: Required. Barber's user ID
 * 
 * Returns weekly availability grouped by day of week.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barberId = searchParams.get("barberId");

    if (!barberId) {
      return NextResponse.json(
        { error: "Missing barberId parameter" },
        { status: 400 }
      );
    }

    const summary = await getBarberWeeklySummary(barberId);

    return NextResponse.json({
      barberId,
      summary,
      hasAvailability: summary.length > 0,
    });
  } catch (error: any) {
    console.error("[barber-weekly-availability] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly availability" },
      { status: 500 }
    );
  }
}



