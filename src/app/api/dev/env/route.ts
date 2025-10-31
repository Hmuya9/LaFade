import { NextResponse } from "next/server";

export async function GET() {
  // Only available in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const envCheck = {
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    EMAIL_FROM: !!process.env.EMAIL_FROM,
    DATABASE_URL: !!process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    BARBER_EMAIL: !!process.env.BARBER_EMAIL,
    NODE_ENV: process.env.NODE_ENV
  };

  return NextResponse.json({
    ok: true,
    env: envCheck,
    timestamp: new Date().toISOString()
  });
}
