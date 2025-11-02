import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  let dbStatus: 'up' | 'down' = 'down';
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'up';
  } catch (dbError) {
    console.error('Health check: database connection failed', dbError);
  }

  const emailStatus = (process.env.RESEND_API_KEY && process.env.NOTIFY_FROM) 
    ? 'configured' 
    : 'skipped';

  return NextResponse.json({
    ok: true,
    db: dbStatus,
    email: emailStatus,
  }, { status: 200 });
}


