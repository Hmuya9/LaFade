import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/barber/profile
 * Get the logged-in barber's profile (including city)
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, city: true, phone: true },
    });

    if (!user || (user.role !== "BARBER" && user.role !== "OWNER")) {
      return NextResponse.json(
        { error: "Access denied. This endpoint is for barbers only." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      city: user.city || null,
      phone: user.phone || null,
    });
  } catch (error) {
    console.error("[api/barber/profile] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/barber/profile
 * Update the logged-in barber's city
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || (user.role !== "BARBER" && user.role !== "OWNER")) {
      return NextResponse.json(
        { error: "Access denied. This endpoint is for barbers only." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const city = body.city?.trim() || null;
    const phone = body.phone?.trim() || null;

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        city,
        phone,
      },
    });

    return NextResponse.json({
      ok: true,
      city,
      phone,
    });
  } catch (error) {
    console.error("[api/barber/profile] PATCH Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}








