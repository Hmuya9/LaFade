import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = (
      process.env.EMAIL_FROM?.trim() ||
      process.env.NOTIFY_FROM?.trim() ||
      "onboarding@resend.dev"
    );
    const to = process.env.BARBER_EMAIL ?? "hmuya@uw.edu";

    const r = await resend.emails.send({
      from,
      to,
      subject: "LaFade Resend smoke test",
      html: "<p>It works 🎉</p>"
    });

    if ((r as any)?.error) {
      return NextResponse.json({ ok: false, error: (r as any).error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: (r as any).id ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
