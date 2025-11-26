import { NextRequest, NextResponse } from "next/server";
import { getNextOpeningsForBarber } from "@/lib/next-openings";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * Get the next N available openings for a barber.
 * 
 * Query params:
 * - barberId: Required. Barber's user ID
 * - plan: Optional. Plan type (default: "any")
 * - limit: Optional. Number of openings to return (default: 3)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barberId = searchParams.get("barberId");
    const plan = searchParams.get("plan") || "any";
    const limit = parseInt(searchParams.get("limit") || "3", 10);

    if (!barberId) {
      return NextResponse.json(
        { error: "Missing barberId parameter" },
        { status: 400 }
      );
    }

    const openings = await getNextOpeningsForBarber(barberId, plan, limit);

    return NextResponse.json({
      barberId,
      plan,
      openings,
      count: openings.length,
    });
  } catch (error: any) {
    console.error("[barber-next-openings] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch next openings" },
      { status: 500 }
    );
  }
}



