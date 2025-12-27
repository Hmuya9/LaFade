import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cashAppUrl } from "@/lib/lafadeBusiness";
import { z } from "zod";
import crypto from "crypto";

export const runtime = "nodejs";

const createIntentSchema = z.object({
  amountCents: z.number().int().positive(),
  kind: z.string(),
});

/**
 * Generate a random short code (6-8 uppercase characters)
 */
function generateNoteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars like 0, O, I, 1
  const length = 6 + Math.floor(Math.random() * 3); // 6-8 chars
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    // Auth required
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: "Please sign in to create a payment intent." },
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
    const validated = createIntentSchema.parse(body);

    // Generate unique note code
    const noteCode = generateNoteCode();

    // Set expiration to 2 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    // Create payment intent
    const intent = await prisma.cashAppPaymentIntent.create({
      data: {
        userId: user.id,
        amountCents: validated.amountCents,
        kind: validated.kind,
        noteCode,
        status: "PENDING",
        expiresAt,
      },
    });

    // Generate payment URL
    const paymentUrl = cashAppUrl(validated.amountCents, noteCode);
    const noteText = `LaFade ${noteCode}`;

    return NextResponse.json({
      ok: true,
      intentId: intent.id,
      paymentUrl,
      noteText,
    });
  } catch (error) {
    console.error("[cashapp/intents] Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, message: "Invalid request data.", errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "Failed to create payment intent." },
      { status: 500 }
    );
  }
}



