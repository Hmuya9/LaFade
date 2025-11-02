import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await requireAdmin();
  
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const form = await req.formData();
  const subject = String(form.get("subject") || "").trim();
  const message = String(form.get("message") || "").trim();
  
  if (!subject || !message) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const users = await prisma.user.findMany({ 
    where: { email: { not: null } }, 
    select: { email: true } 
  });
  
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Naive fan-out (for small lists; for large, batch/queue)
  await Promise.allSettled(users.map(u => resend.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to: u.email!,
    subject,
    html: `<p>${message.replace(/\n/g, "<br/>")}</p>`
  })));

  return NextResponse.redirect(new URL("/admin/broadcast", baseUrl));
}

