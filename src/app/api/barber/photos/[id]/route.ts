import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";

interface RouteParams {
  params: { id: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user as any).role || "CLIENT";
  if (role !== "BARBER" && role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const photo = await prisma.photo.findUnique({
    where: { id: params.id },
  });

  if (!photo || photo.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from Cloudinary if we have a publicId
  if (photo.publicId) {
    try {
      await cloudinary.v2.uploader.destroy(photo.publicId);
    } catch (error) {
      console.error("Error deleting Cloudinary image", error);
      // We still proceed with DB delete; just log the error
    }
  }

  await prisma.photo.delete({
    where: { id: photo.id },
  });

  return NextResponse.json({ ok: true });
}


