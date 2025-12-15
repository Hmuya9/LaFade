import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/plans
 * 
 * Returns all active plans from the database with their Stripe price IDs.
 * This is the source of truth for plan pricing and Stripe integration.
 */
export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        priceMonthly: true,
        cutsPerMonth: true,
        isHome: true,
        stripePriceId: true,
      },
      orderBy: { priceMonthly: "asc" },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("[api/plans] Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}




