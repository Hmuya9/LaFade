import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Always use BARBER_NAME from environment
    const barberName = (process.env.BARBER_NAME ?? "CKENZO").trim()

    const slots = await prisma.availability.findMany({
      where: { 
        barberName: barberName // Direct match (case-sensitive for SQLite)
      },
      orderBy: [
        { date: 'asc' },
        { timeSlot: 'asc' }
      ]
    })

    return NextResponse.json(slots)
  } catch (error) {
    console.error("Failed to fetch availability:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { date, time } = await request.json()

    if (!date || !time) {
      return NextResponse.json(
        { error: "Date and time are required" },
        { status: 400 }
      )
    }

    // Always use BARBER_NAME from environment - do not rely on client input
    const barberName = (process.env.BARBER_NAME ?? "CKENZO").trim()
    const dateUtc = new Date(date + 'T00:00:00.000Z') // Store as UTC start of day

    // Check for duplicate
    const existing = await prisma.availability.findFirst({
      where: {
        barberName: barberName, // Direct match (case-sensitive for SQLite)
        date: dateUtc,
        timeSlot: time,
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Slot already exists for this date and time" },
        { status: 409 }
      )
    }

    const slot = await prisma.availability.create({
      data: {
        barberName,        // Force env name
        date: dateUtc,     // UTC Date for the day
        timeSlot: time,    // 'HH:mm'
      }
    })

    return NextResponse.json(slot)
  } catch (error) {
    console.error("Failed to create availability:", error)
    return NextResponse.json(
      { error: "Failed to create availability" },
      { status: 500 }
    )
  }
}
