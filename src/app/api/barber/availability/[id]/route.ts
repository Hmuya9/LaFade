import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const slotId = parseInt(params.id)
    
    if (isNaN(slotId)) {
      return NextResponse.json(
        { error: "Invalid slot ID" },
        { status: 400 }
      )
    }

    // Get barber name from email or use email as fallback
    const barberName = session.user.name || session.user.email.split('@')[0]

    // Find the slot and verify ownership
    const slot = await prisma.availability.findFirst({
      where: {
        id: slotId,
        barberName,
      }
    })

    if (!slot) {
      return NextResponse.json(
        { error: "Slot not found" },
        { status: 404 }
      )
    }

    if (slot.isBooked) {
      return NextResponse.json(
        { error: "Cannot delete booked slot" },
        { status: 400 }
      )
    }

    await prisma.availability.delete({
      where: { id: slotId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete availability:", error)
    return NextResponse.json(
      { error: "Failed to delete availability" },
      { status: 500 }
    )
  }
}
