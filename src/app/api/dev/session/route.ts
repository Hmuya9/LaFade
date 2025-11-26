import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  // Only available in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const session = await auth();
    
    // Get cookie names from request headers
    const cookieHeader = process.env.NODE_ENV === "development" ? 
      "authjs.csrf-token, authjs.callback-url" : 
      "session cookie names would be here";

    return NextResponse.json({
      ok: true,
      session: session ? {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          role: (session as any).role
        },
        expires: session.expires
      } : null,
      cookies: cookieHeader.split(", "),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      session: null,
      cookies: [],
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}






