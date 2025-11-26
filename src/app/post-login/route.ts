import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
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
}
