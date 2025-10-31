import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Only available in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    // Test Prisma connection
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`;
    
    // Test NextAuth adapter tables exist
    const userCount = await prisma.user.count();
    const accountCount = await prisma.account.count();
    const sessionCount = await prisma.session.count();
    const verificationTokenCount = await prisma.verificationToken.count();

    return NextResponse.json({
      ok: true,
      auth: {
        adapter: "PrismaAdapter",
        tables: {
          User: userCount,
          Account: accountCount,
          Session: sessionCount,
          VerificationToken: verificationTokenCount
        },
        dbConnected: Array.isArray(dbTest) && dbTest.length > 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      auth: {
        adapter: "PrismaAdapter",
        tables: null,
        dbConnected: false
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
