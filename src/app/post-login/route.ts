import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  // Route by role
  const role = (session.user as any).role || "CLIENT";
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  if (role === "BARBER") return NextResponse.redirect(new URL("/barber", baseUrl));
  if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", baseUrl));
  return NextResponse.redirect(new URL("/booking", baseUrl));
}
