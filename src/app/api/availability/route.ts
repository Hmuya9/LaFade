import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { redisGet, redisSet } from "@/lib/redis"
import { getAvailableSlotsForDate, findBarberByIdOrName } from "@/lib/availability"

export const runtime = "nodejs";
export const dynamic = 'force-dynamic'

// V1 Launch Safety: Only allow these two real barbers
const REAL_BARBER_IDS = [
  "cmihqddi20001vw3oyt77w4uv",
  "cmj6jzd1j0000vw8ozlyw14o9",
];

/**
 * Availability API endpoint.
 * 
 * NEW SYSTEM: Uses BarberAvailability (weekly recurring ranges) + Appointment conflicts.
 * 
 * Query params:
 * - date: Required. Date in "YYYY-MM-DD" format
 * - barberId: Required. Barber's user ID
 * - plan: Optional. Plan type (for future use)
 * 
 * Returns available time slots based on:
 * 1. Barber's weekly availability ranges (BarberAvailability model)
 * 2. Excludes slots that conflict with existing appointments (Appointment model)
 * 
 * Removed:
 * - barberName (old Availability model system)
 * - isBooked flag (old Availability model)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")
    const barberId = searchParams.get("barberId") || undefined
    const barberName = searchParams.get("barberName") || undefined // Legacy support only
    const plan = searchParams.get("plan")

    if (!dateStr) {
      return NextResponse.json(
        { error: "Missing date parameter" },
        { status: 400 }
      )
    }

    if (!barberId && !barberName) {
      return NextResponse.json(
        { error: "Missing barberId or barberName parameter" },
        { status: 400 }
      )
    }

    // Find barber by ID or name (name is legacy support only)
    const barber = await findBarberByIdOrName(barberId, barberName)
    
    if (!barber) {
      return NextResponse.json(
        { error: "Barber not found" },
        { status: 404 }
      )
    }

    // V1 Launch Safety: Only allow real barbers
    if (!REAL_BARBER_IDS.includes(barber.id)) {
      return NextResponse.json(
        { error: "Barber not available" },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[availability] Fetching slots:", { barberId: barber.id, dateStr, plan });
    }

    // Check cache first (graceful fallback if Redis unavailable)
    const cacheKey = `avail:${barber.id}:${dateStr}:${plan || 'any'}`
    let cached;
    try {
      cached = await redisGet<any>(cacheKey)
      if (cached) {
        if (process.env.NODE_ENV === "development") {
          console.log("[availability] Cache hit:", { barberId: barber.id, dateStr, slots: cached.totalSlots });
        }
        return NextResponse.json(cached)
      }
    } catch (redisError) {
      console.log('[availability] Redis cache unavailable, continuing without cache')
    }

    // Get available slots from weekly availability system
    const availableSlots = await getAvailableSlotsForDate(barber.id, dateStr)

    if (process.env.NODE_ENV === "development") {
      console.log("[availability] Generated slots:", { 
        barberId: barber.id, 
        dateStr, 
        count: availableSlots.length,
        slots: availableSlots.slice(0, 5) // Log first 5 slots
      });
    }

    // Format for frontend compatibility
    const formattedSlots = availableSlots.map(time => ({
      time,
      available: true,
    }))

    const result = {
      barberId: barber.id,
      barberName: barber.name || "Unknown",
      date: dateStr,
      plan: plan || 'any',
      availableSlots: formattedSlots,
      totalSlots: availableSlots.length,
      bookedSlots: 0, // Not tracked separately in new system (conflicts handled via Appointment table)
    }

    // Cache for 60 seconds (graceful fallback if Redis fails)
    try {
      await redisSet(cacheKey, result, 60)
    } catch (redisError) {
      console.log('[availability] Cache set failed, continuing without caching')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[availability] API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}