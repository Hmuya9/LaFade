import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { apptId?: string; barberId?: string; rating?: number; review?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { apptId, barberId, rating, review } = body;

  if (!apptId || !barberId || typeof rating !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: apptId },
    select: {
      id: true,
      clientId: true,
      barberId: true,
      status: true,
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (appointment.clientId !== user.id) {
    return NextResponse.json({ error: "You are not allowed to confirm this appointment" }, { status: 403 });
  }

  if (appointment.barberId !== barberId) {
    return NextResponse.json({ error: "This QR does not match your barber" }, { status: 400 });
  }

  // Validate status: must not be COMPLETED or CANCELED
  if (appointment.status === "COMPLETED") {
    return NextResponse.json({ error: "This appointment is already marked as completed" }, { status: 400 });
  }

  if (appointment.status === "CANCELED") {
    return NextResponse.json({ error: "This appointment has been canceled and cannot be confirmed" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "COMPLETED",
        rating,
        review: review ?? null,
      },
    });

    // Log completion in points ledger (0-delta log so it doesn't affect balance by default)
    await tx.pointsLedger.create({
      data: {
        userId: appointment.clientId,
        delta: 0,
        reason: "cut_confirmed_qr",
        refType: "APPOINTMENT",
        refId: appointment.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}


