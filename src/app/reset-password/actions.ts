"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/schemas/password";
import { revalidatePath } from "next/cache";

type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function resetPasswordAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    token: String(formData.get("token") || ""),
    password: String(formData.get("password") || ""),
    confirmPassword: String(formData.get("confirmPassword") || ""),
  };

  if (!raw.token) {
    return { status: "error", message: "Invalid or missing reset token." };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: raw.password,
    confirmPassword: raw.confirmPassword,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid password",
    };
  }

  const existingToken = await prisma.passwordResetToken.findUnique({
    where: { token: raw.token },
    include: { user: true },
  });

  if (!existingToken || !existingToken.user) {
    return { status: "error", message: "Invalid or expired reset link." };
  }

  if (existingToken.expiresAt.getTime() < Date.now()) {
    // Token expired
    await prisma.passwordResetToken.delete({
      where: { id: existingToken.id },
    });
    return { status: "error", message: "Reset link has expired. Please request a new one." };
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);

  await prisma.user.update({
    where: { id: existingToken.userId },
    data: {
      passwordHash: hashed,
    },
  });

  await prisma.passwordResetToken.delete({
    where: { id: existingToken.id },
  });

  revalidatePath("/login");

  return {
    status: "success",
    message: "Your password has been updated. You can now log in with your new password.",
  };
}

