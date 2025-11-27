import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      // Clear any invalid session by redirecting to login with a flag
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const loginUrl = new URL("/login", baseUrl);
      loginUrl.searchParams.set("error", "session_invalid");
      return NextResponse.redirect(loginUrl);
    }

    // Route by role
    const role = (user as any).role || "CLIENT";
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    if (role === "BARBER") {
      return NextResponse.redirect(new URL("/barber", baseUrl));
    }
    if (role === "OWNER") {
      return NextResponse.redirect(new URL("/admin/appointments", baseUrl));
    }
    // CLIENT → redirect to /account (their home/dashboard)
    return NextResponse.redirect(new URL("/account", baseUrl));
  } catch (error) {
    // If database query fails, redirect to login
    console.error("[post-login] Error:", error);
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("error", "database_error");
    return NextResponse.redirect(loginUrl);
  }
}
