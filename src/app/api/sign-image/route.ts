import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { paramsToSign: Record<string, string> };
    const { paramsToSign } = body;

    if (!env.cloudinaryApiSecret) {
      return NextResponse.json(
        { error: "Cloudinary not configured" },
        { status: 500 }
      );
    }

    const signature = cloudinary.v2.utils.api_sign_request(
      paramsToSign,
      env.cloudinaryApiSecret
    );

    return NextResponse.json({ signature });
  } catch (error) {
    console.error("Error generating Cloudinary signature", error);
    return NextResponse.json(
      { error: "Failed to generate signature" },
      { status: 500 }
    );
  }
}

