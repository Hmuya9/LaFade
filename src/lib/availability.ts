/**
 * Availability utilities for generating time slots from weekly ranges
 * 
 * NOTE: Server-side only - uses Prisma and Node.js modules.
 * For client components, use time-utils.ts for pure time formatting functions.
 */

import { prisma } from "@/lib/db";
import { formatTime12Hour, parse12HourTime, toBusinessTimeZone, BUSINESS_TIMEZONE } from "@/lib/time-utils";
import { formatInTimeZone } from "date-fns-tz";

// V1 Launch Safety: Only allow these two real barbers
const REAL_BARBER_IDS = [
  "cmihqddi20001vw3oyt77w4uv",
  "cmj6jzd1j0000vw8ozlyw14o9",
];

// Slot duration in minutes (30-minute appointments)
export const SLOT_DURATION = 30;

/**
 * Generate discrete time slots from a time range.
 * 
 * @param startTime - "10:00" (24-hour format)
 * @param endTime - "14:00" (24-hour format)
 * @param slotDurationMinutes - Duration of each slot (default: 30)
 * @returns Array of time strings in "HH:mm" format
 */
export function generateSlotsFromRange(
  startTime: string,
  endTime: string,
  slotDurationMinutes: number = SLOT_DURATION
): string[] {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  const slots: string[] = [];
  
  for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDurationMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
  }
  
  return slots;
}

// formatTime12Hour is now imported from @/lib/time-utils for client-safe access

/**
 * Get available time slots for a barber on a specific date.
 * 
 * This function:
 * 1. Finds the barber's weekly availability for the day of week
 * 2. Generates discrete slots from the availability ranges
 * 3. Excludes slots that conflict with existing appointments
 * 
 * @param barberId - Barber's user ID
 * @param date - Date string in "YYYY-MM-DD" format
 * @returns Array of available time slots in 12-hour format (e.g., "10:00 AM")
 */
export async function getAvailableSlotsForDate(
  barberId: string,
  date: string
): Promise<string[]> {
  // Parse the date (YYYY-MM-DD format)
  const targetDate = new Date(date + "T00:00:00.000Z");
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  if (process.env.NODE_ENV === "development") {
    console.log("[availability] getAvailableSlotsForDate:", { 
      barberId, 
      date, 
      dayOfWeek,
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek]
    });
  }
  
  // Get weekly availability for this day
  const weeklyAvailability = await prisma.barberAvailability.findMany({
    where: {
      barberId,
      dayOfWeek,
    },
    orderBy: {
      startTime: "asc",
    },
  });
  
  if (process.env.NODE_ENV === "development") {
    console.log("[availability] Weekly ranges found:", {
      barberId,
      dayOfWeek,
      ranges: weeklyAvailability.map(a => `${a.startTime}-${a.endTime}`)
    });
  }
  
  if (weeklyAvailability.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[availability] No availability ranges for dayOfWeek:", dayOfWeek);
    }
    return []; // No availability for this day
  }
  
  // Generate all possible slots from ranges
  const allSlots: Set<string> = new Set();
  
  for (const avail of weeklyAvailability) {
    const slots = generateSlotsFromRange(avail.startTime, avail.endTime);
    slots.forEach((slot) => allSlots.add(slot));
  }
  
  if (process.env.NODE_ENV === "development") {
    console.log("[availability] Generated slots from ranges:", {
      barberId,
      date,
      totalSlots: allSlots.size,
      sampleSlots: Array.from(allSlots).slice(0, 5)
    });
  }
  
  // Get existing appointments for this barber on this date
  // Appointments are stored in UTC, so use UTC date boundaries
  const startOfDay = new Date(date + "T00:00:00.000Z");
  const endOfDay = new Date(date + "T23:59:59.999Z");
  
  const appointments = await prisma.appointment.findMany({
    where: {
      barberId,
      startAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        in: ["BOOKED", "CONFIRMED"], // Only count active appointments
      },
    },
  });
  
  if (process.env.NODE_ENV === "development") {
    console.log("[availability] Conflicting appointments:", {
      barberId,
      date,
      count: appointments.length,
      appointments: appointments.map(a => ({
        startAt: a.startAt,
        timeUTC: a.startAt.toISOString(),
        status: a.status
      }))
    });
  }
  
  // Convert appointments to time slots and remove from available slots
  // Appointments are stored in UTC, but we need to match against local time slots
  for (const appointment of appointments) {
    const appointmentDate = new Date(appointment.startAt);
    // Get UTC hours/minutes to match the 24-hour format slots
    const hour = appointmentDate.getUTCHours();
    const minute = appointmentDate.getUTCMinutes();
    const slot24 = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    allSlots.delete(slot24);
    
    if (process.env.NODE_ENV === "development") {
      console.log("[availability] Excluded slot:", { 
        slot24, 
        appointmentId: appointment.id,
        appointmentStart: appointment.startAt 
      });
    }
  }
  
  // Convert to 12-hour format and sort
  const availableSlots = Array.from(allSlots)
    .map(formatTime12Hour)
    .sort((a, b) => {
      // Sort by time (convert back to 24-hour for comparison)
      const timeA = parse12HourTime(a);
      const timeB = parse12HourTime(b);
      return timeA - timeB;
    });
  
  if (process.env.NODE_ENV === "development") {
    console.log("[availability] Final available slots:", {
      barberId,
      date,
      count: availableSlots.length,
      slots: availableSlots.slice(0, 10) // Log first 10
    });
  }
  
  return availableSlots;
}

/**
 * Get all time slots for a barber on a specific date with availability status.
 * Returns both available and booked slots so UI can display them differently.
 * 
 * @param barberId - Barber's user ID
 * @param date - Date string in "YYYY-MM-DD" format
 * @returns Array of slot objects with time and available status
 */
export async function getAllSlotsWithStatus(
  barberId: string,
  date: string
): Promise<Array<{ time: string; available: boolean }>> {
  // Parse the date (YYYY-MM-DD format)
  const targetDate = new Date(date + "T00:00:00.000Z");
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Get weekly availability for this day
  const weeklyAvailability = await prisma.barberAvailability.findMany({
    where: {
      barberId,
      dayOfWeek,
    },
    orderBy: {
      startTime: "asc",
    },
  });
  
  if (weeklyAvailability.length === 0) {
    return []; // No availability for this day
  }
  
  // Generate all possible slots from ranges
  const allSlots24: Set<string> = new Set();
  
  for (const avail of weeklyAvailability) {
    const slots = generateSlotsFromRange(avail.startTime, avail.endTime);
    slots.forEach((slot) => allSlots24.add(slot));
  }
  
  // Get existing appointments for this barber on this date
  // Appointments are stored in UTC, so use UTC date boundaries
  const startOfDay = new Date(date + "T00:00:00.000Z");
  const endOfDay = new Date(date + "T23:59:59.999Z");
  
  const appointments = await prisma.appointment.findMany({
    where: {
      barberId,
      startAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        in: ["BOOKED", "CONFIRMED"], // Only count active appointments
      },
    },
  });
  
  // Track which slots are booked
  // Convert appointment times from UTC to America/Los_Angeles to match slot format
  const bookedSlots24: Set<string> = new Set();
  
  for (const appointment of appointments) {
    // Convert UTC appointment time to LA timezone to get the actual time shown
    const laTime = formatInTimeZone(appointment.startAt, BUSINESS_TIMEZONE, "HH:mm");
    bookedSlots24.add(laTime);
  }
  
  // Convert all slots to 12-hour format and include availability status
  const allSlots = Array.from(allSlots24)
    .map((slot24) => ({
      time24: slot24,
      time12: formatTime12Hour(slot24),
      available: !bookedSlots24.has(slot24),
    }))
    .sort((a, b) => {
      // Sort by 24-hour time for correct ordering
      const timeA = parse12HourTime(a.time12);
      const timeB = parse12HourTime(b.time12);
      return timeA - timeB;
    })
    .map((slot) => ({
      time: slot.time12,
      available: slot.available,
    }));
  
  return allSlots;
}

/**
 * Find barber by ID or name (for backward compatibility).
 */
export async function findBarberByIdOrName(
  barberId?: string,
  barberName?: string
): Promise<{ id: string; name: string | null } | null> {
  if (barberId) {
    // V1 Launch Safety: Only allow real barbers
    if (!REAL_BARBER_IDS.includes(barberId)) {
      return null;
    }
    const barber = await prisma.user.findUnique({
      where: { id: barberId },
      select: { id: true, name: true },
    });
    if (barber) return barber;
  }
  
  if (barberName) {
    // SQLite doesn't support case-insensitive mode, so we search directly
    const barber = await prisma.user.findFirst({
      where: {
        name: { contains: barberName },
        role: "BARBER",
        id: { in: REAL_BARBER_IDS },
      },
      select: { id: true, name: true },
    });
    if (barber) return barber;
  }
  
  return null;
}

