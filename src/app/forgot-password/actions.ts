"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/schemas/password";
import { sendPasswordResetEmail } from "@/lib/notify";

type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function forgotPasswordAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: String(formData.get("email") || "").trim().toLowerCase(),
  };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid email",
    };
  }

  const { email } = parsed.data;

  // Generic success message, regardless of whether user exists
  const genericMessage =
    "If an account with that email exists, we've sent password reset instructions.";

  // Look up user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  // If no user or no passwordHash (magic-link-only account), return generic success
  if (!user || !user.passwordHash) {
    return { status: "success", message: genericMessage };
  }

  // Delete any existing tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  await sendPasswordResetEmail(user.email as string, token);

  return { status: "success", message: genericMessage };
}

