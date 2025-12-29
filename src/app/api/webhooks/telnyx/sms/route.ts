import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    console.log("TELNYX INBOUND SMS", payload);
    
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("TELNYX INBOUND SMS ERROR", error);
    return NextResponse.json(
      { received: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}

