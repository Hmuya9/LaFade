import { getAvailableSlotsForDate } from "./availability";

export type Opening = {
  date: string;
  time: string;
  dateTime: Date;
};

/**
 * Get the next N available openings for a barber and plan.
 * Searches upcoming dates and finds slots until we have enough.
 * 
 * @param barberId - Barber's user ID
 * @param plan - Plan type (for future filtering)
 * @param limit - Maximum number of openings to return (default: 3)
 * @param maxDays - Maximum days to search ahead (default: 30)
 */
/**
 * Helper to format Date to YYYY-MM-DD in local time.
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to add days to a date in local time.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getNextOpeningsForBarber(
  barberId: string,
  plan: string = "any",
  limit: number = 3,
  maxDays: number = 30
): Promise<Opening[]> {
  const openings: Opening[] = [];
  // Get today at start of day in local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Search through upcoming dates
  for (let dayOffset = 0; dayOffset < maxDays && openings.length < limit; dayOffset++) {
    const searchDate = addDays(today, dayOffset);
    const dateStr = formatDateLocal(searchDate);

    try {
      // Get available slots for this date
      const slots = await getAvailableSlotsForDate(barberId, dateStr);

      if (slots.length > 0) {
        // Create opening objects for each slot
        for (const time of slots) {
          if (openings.length >= limit) break;

          // Parse time (e.g., "10:00 AM") and create DateTime in UTC
          const [timePart, period] = time.split(" ");
          const [hour, minute] = timePart.split(":").map(Number);
          let hour24 = hour;
          if (period === "PM" && hour !== 12) hour24 += 12;
          if (period === "AM" && hour === 12) hour24 = 0;

          // Parse date string and create UTC date
          const [year, month, day] = dateStr.split('-').map(Number);
          // Create Date in local timezone, which JavaScript stores as UTC internally
          const dateTime = new Date(year, month - 1, day, hour24, minute, 0, 0);
          
          if (process.env.NODE_ENV === "development" && openings.length === 0) {
            console.log("[next-openings] First opening:", {
              date: dateStr,
              time,
              dateTimeISO: dateTime.toISOString(),
            });
          }

          openings.push({
            date: dateStr,
            time,
            dateTime,
          });
        }
      }
    } catch (error) {
      // Skip dates that error (e.g., barber has no availability that day)
      if (process.env.NODE_ENV === "development") {
        console.warn(`[next-openings] Error fetching slots for ${dateStr}:`, error);
      }
      continue;
    }
  }

  // Sort by datetime to ensure chronological order
  openings.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  // Return only the requested limit
  return openings.slice(0, limit);
}

