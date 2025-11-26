import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barberId = searchParams.get("barberId") || undefined;

    const where: any = {
      isApproved: true,
    };

    if (barberId) {
      where.userId = barberId;
    }

    const photos = await prisma.photo.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        url: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching portfolio photos", error);
    return NextResponse.json({ photos: [] }, { status: 200 });
  }
}

