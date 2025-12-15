import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const confirmSchema = z.object({
  intentId: z.string(),
  noteCode: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    // Auth required
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: "Please sign in to confirm payment." },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "User not found." },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validated = confirmSchema.parse(body);

    // Load intent
    const intent = await prisma.cashAppPaymentIntent.findUnique({
      where: { id: validated.intentId },
    });

    if (!intent) {
      return NextResponse.json(
        { ok: false, message: "Payment intent not found." },
        { status: 404 }
      );
    }

    // Verify intent belongs to user
    if (intent.userId !== user.id) {
      return NextResponse.json(
        { ok: false, message: "Payment intent does not belong to you." },
        { status: 403 }
      );
    }

    // Verify status is PENDING
    if (intent.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, message: `Payment intent is already ${intent.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    // Verify not expired
    if (intent.expiresAt && new Date() > intent.expiresAt) {
      return NextResponse.json(
        { ok: false, message: "Payment intent has expired." },
        { status: 400 }
      );
    }

    // Verify note code matches
    if (intent.noteCode !== validated.noteCode) {
      return NextResponse.json(
        { ok: false, message: "Note code does not match." },
        { status: 400 }
      );
    }

    // Update intent to CONFIRMED
    await prisma.cashAppPaymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cashapp/confirm] Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, message: "Invalid request data.", errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "Failed to confirm payment." },
      { status: 500 }
    );
  }
}


