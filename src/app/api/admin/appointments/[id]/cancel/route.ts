import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  // Free the slot & remove booking atomically
  await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.delete({ where: { id: params.id }});
    
    // Mark the availability slot as free again
    // Since we store by barberName and timeSlot, we need to find the matching slot
    const timeSlot = appt.startAt.toISOString().slice(11,16); // Extract HH:mm
    const barberName = process.env.BARBER_NAME || "CKENZO";
    
    await tx.availability.updateMany({
      where: { 
        barberName: barberName,
        date: {
          gte: new Date(appt.startAt.toISOString().split('T')[0] + 'T00:00:00.000Z'),
          lte: new Date(appt.startAt.toISOString().split('T')[0] + 'T23:59:59.999Z')
        },
        timeSlot: timeSlot
      },
      data: { isBooked: false }
    });
    
    // (Optional) refund points: +5
    await tx.pointsLedger.create({
      data: { 
        userId: appt.clientId, 
        delta: +5, 
        reason: "BOOKING_CANCEL_CREDIT", 
        refType: "BOOKING", 
        refId: appt.id 
      }
    });
  });
  
  return NextResponse.redirect(new URL("/admin/appointments", baseUrl));
}

