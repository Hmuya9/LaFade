import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

async function getDefaultBarberId(): Promise<string | null> {
  const barberEmail = env.BARBER_EMAIL?.toLowerCase() ?? null;

  let defaultBarberId: string | null = null;

  if (barberEmail) {
    const barberByEmail = await prisma.user.findFirst({
      where: {
        email: barberEmail,
        role: "BARBER",
      },
      select: { id: true },
    });

    if (barberByEmail) {
      defaultBarberId = barberByEmail.id;
    }
  }

  // Fallback: first BARBER user if BARBER_EMAIL not set or lookup fails (exclude OWNER)
  if (!defaultBarberId) {
    const barberByRole = await prisma.user.findFirst({
      where: {
        role: "BARBER",
        NOT: { role: "OWNER" },
      },
      select: { id: true },
    });

    if (barberByRole) {
      defaultBarberId = barberByRole.id;
    }
  }

  return defaultBarberId;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      hasAnsweredFreeCutQuestion: true,
    },
  });

  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { answer?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const answer = body.answer;

  if (answer !== "YES" && answer !== "NO") {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  // If already answered, be idempotent and just send them to account
  if (user.hasAnsweredFreeCutQuestion) {
    return NextResponse.json({ redirect: "/account" });
  }

  if (answer === "NO") {
    await prisma.user.update({
      where: { id: user.id },
      data: { hasAnsweredFreeCutQuestion: true },
    });

    const redirectPath = "/account";
    
    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.log("[api/onboarding/free-cut]", {
        userId: user.id,
        answer: "NO",
        redirect: redirectPath,
      });
    }

    return NextResponse.json({ redirect: redirectPath });
  }

  // YES: auto-create free cut appointment and start 10-day window
  let barberId: string | null = null;

  // Prefer the barber from the most recent appointment, if any
  const lastAppointment = await prisma.appointment.findFirst({
    where: { clientId: user.id },
    orderBy: { startAt: "desc" },
    select: { barberId: true },
  });

  if (lastAppointment?.barberId) {
    barberId = lastAppointment.barberId;
  } else {
    barberId = await getDefaultBarberId();
  }

  if (!barberId) {
    return NextResponse.json(
      { error: "No barber available to assign free cut" },
      { status: 500 }
    );
  }

  const now = new Date();
  const endAt = new Date(now.getTime() + 30 * 60 * 1000);
  const idempotencyKey = `onboarding-freecut-${user.id}-${now.toISOString().slice(0, 10)}`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { hasAnsweredFreeCutQuestion: true },
    });

    await tx.appointment.upsert({
      where: { idempotencyKey },
      update: {
        isFree: true,
        kind: "TRIAL_FREE",
        status: "COMPLETED",
        priceCents: 0,
        paidVia: null,
        paymentStatus: "WAIVED", // Free trial is waived
      },
      create: {
        clientId: user.id,
        barberId,
        type: "SHOP",
        startAt: now,
        endAt,
        status: "COMPLETED",
        isFree: true,
        kind: "TRIAL_FREE",
        priceCents: 0,
        paidVia: null,
        paymentStatus: "WAIVED", // Free trial is waived
        idempotencyKey,
      },
    });
  });

  const redirectPath = "/booking/second-cut";
  
  // Log in development
  if (process.env.NODE_ENV === "development") {
    console.log("[api/onboarding/free-cut]", {
      userId: user.id,
      answer: "YES",
      redirect: redirectPath,
      appointmentCreated: true,
    });
  }

  return NextResponse.json({ redirect: redirectPath });
}


