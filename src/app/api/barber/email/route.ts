import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  // Return barber email if configured (server-only env var)
  const barberEmail = env.BARBER_EMAIL || "";
  return NextResponse.json({ barberEmail });
}




