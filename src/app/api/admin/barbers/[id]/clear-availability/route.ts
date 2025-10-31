import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  // Clear future availability for this barber (using barberName since we store by name)
  const barber = await prisma.user.findUnique({
    where: { id: params.id },
    select: { email: true }
  });
  
  if (barber?.email) {
    // Get the barber name from environment (since we use CKENZO for all)
    const barberName = process.env.BARBER_NAME || "CKENZO";
    
    await prisma.availability.deleteMany({
      where: { 
        barberName: barberName,
        isBooked: false, 
        date: { gte: new Date() } 
      }
    });
  }
  
  return NextResponse.redirect(new URL("/admin/barbers", baseUrl));
}
