import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPointsBalance } from "@/lib/points"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const balance = await getPointsBalance(session.user.id as string)

    return NextResponse.json({ balance })
  } catch (error) {
    console.error("Failed to fetch points:", error)
    return NextResponse.json(
      { error: "Failed to fetch points" },
      { status: 500 }
    )
  }
}
