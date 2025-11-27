import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs";
export const dynamic = 'force-dynamic'

/**
 * Get all barbers (users with role BARBER or OWNER).
 * Used by client booking page to show barber selection.
 */
export async function GET() {
  try {
    const barbers = await prisma.user.findMany({
      where: {
        role: {
          in: ["BARBER", "OWNER"],
        },
        // Filter out placeholder "barber" user
        NOT: {
          name: "barber",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        city: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(barbers)
  } catch (error) {
    console.error("Failed to fetch barbers:", error)
    return NextResponse.json(
      { error: "Failed to fetch barbers" },
      { status: 500 }
    )
  }
}




