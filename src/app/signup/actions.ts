"use server";

import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";

export type SignupActionState = {
  ok: boolean;
  error: string;
};

export async function signupAction(
  prevState: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const rawEmail = String(formData.get("email") || "");
  const email = rawEmail.trim().toLowerCase(); // Normalize to lowercase
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.passwordHash) {
    return { ok: false, error: "Account already exists with this email." };
  }

  try {
    const passwordHash = await hash(password, 10);

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: name || null,
        role: "CLIENT", // New signups are always CLIENT by default
        // Note: BARBER and OWNER roles are set manually in the database or via seed script
        passwordHash,
      },
      update: {
        passwordHash,
        name: (name || existing?.name) ?? null,
      },
    });

    // Redirect to login page (user must log in)
    redirect("/login?registered=1");
  } catch (error: any) {
    // Re-throw redirect errors (Next.js handles them specially)
    if (error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[signup] Error:", error);
    return { 
      ok: false, 
      error: error?.message || "Failed to create account. Please try again." 
    };
  }
}
