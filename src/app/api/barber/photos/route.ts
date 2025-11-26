import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow BARBER and OWNER
  const role = (user as any).role || "CLIENT";
  if (role !== "BARBER" && role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const photos = await prisma.photo.findMany({
    where: { userId: user.id as string },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ photos });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user as any).role || "CLIENT";
  if (role !== "BARBER" && role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { url?: string; publicId?: string };

  if (!body.url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const photo = await prisma.photo.create({
    data: {
      url: body.url,
      publicId: body.publicId ?? null,
      isApproved: true, // for barber self-portfolio, treat as approved
      userId: user.id as string,
    },
  });

  return NextResponse.json({ photo }, { status: 201 });
}


