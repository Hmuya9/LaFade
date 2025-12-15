import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ signedIn: false, points: 0 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true }
  });

  let points = 0;
  if (user) {
    // Sum all points (no filtering by reason/refType) - includes subscription points
    const agg = await prisma.pointsLedger.aggregate({
      where: { userId: user.id },
      _sum: { delta: true }
    });
    points = agg._sum.delta ?? 0;
    
    // Log in development to verify points calculation
    if (process.env.NODE_ENV === "development") {
      console.log('[api/me] Points calculated', {
        userId: user.id,
        pointsTotal: points,
      });
    }
  }

  return NextResponse.json({
    signedIn: true,
    email: session.user.email,
    role: user?.role ?? "CLIENT",
    points
  });
}

