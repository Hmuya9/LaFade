import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      env: {
        database: !!env.DATABASE_URL,
        nextauth: !!env.NEXTAUTH_SECRET,
        resend: !!env.RESEND_API_KEY,
        emailFrom: !!env.EMAIL_FROM,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: String(error) },
      { status: 500 }
    );
  }
}
