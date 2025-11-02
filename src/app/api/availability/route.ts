import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { redisGet, redisSet } from "@/lib/redis"
import { generateTimeSlots, parseBarberIdentifier } from "@/lib/hours"

export const runtime = "nodejs";
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")
    let barberName = (searchParams.get("barberName") ?? process.env.BARBER_NAME ?? "CKENZO").trim()
    const plan = searchParams.get("plan")

    if (!dateStr) {
      return NextResponse.json(
        { error: "Missing date parameter" },
        { status: 400 }
      )
    }

    // Check cache first (graceful fallback if Redis unavailable)
    const cacheKey = `avail:${barberName}:${dateStr}:${plan || 'any'}`
    let cached;
    try {
      cached = await redisGet<any>(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    } catch (redisError) {
      console.log('Redis cache unavailable, continuing without cache')
    }

    // Query availability records for this barber and date (using UTC)
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z')
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z')

    const availabilityRecords = await prisma.availability.findMany({
      where: {
        barberName: barberName, // Direct match (case-sensitive for SQLite)
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isBooked: false, // Only get available slots
      },
      orderBy: {
        timeSlot: 'asc'
      }
    })

    // Format available slots for frontend compatibility
    const formattedSlots = availabilityRecords.map(record => ({
      time: record.timeSlot,
      available: true,
    }))

    // Get total slots for this barber and date (both booked and available)
    const totalAvailabilityRecords = await prisma.availability.findMany({
      where: {
        barberName: barberName, // Direct match (case-sensitive for SQLite)
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      }
    })

    const result = {
      barberId: null, // Not using barber ID anymore
      barberName: barberName,
      date: dateStr,
      plan: plan || 'any',
      availableSlots: formattedSlots,
      totalSlots: totalAvailabilityRecords.length,
      bookedSlots: totalAvailabilityRecords.length - formattedSlots.length,
    }

    // Cache for 60 seconds (graceful fallback if Redis fails)
    try {
      await redisSet(cacheKey, result, 60)
    } catch (redisError) {
      console.log('Cache set failed, continuing without caching')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Availability API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}