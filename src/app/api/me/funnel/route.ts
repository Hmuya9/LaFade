import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientFunnelForUser } from "@/lib/client-funnel";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const info = await getClientFunnelForUser(user.id);

  // Log in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.log("[api/me/funnel]", {
      userId: user.id,
      email: session.user.email,
      stage: info.stage,
      hasActiveMembership: info.hasActiveMembership,
      secondWindowExpiresAt: info.secondWindowExpiresAt?.toISOString(),
    });
  }

  return NextResponse.json(info);
}


