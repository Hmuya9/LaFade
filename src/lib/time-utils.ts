/**
 * Client-safe time utility functions.
 * These are pure functions that don't depend on Node.js modules or Prisma.
 * Safe to import in client components.
 */

/**
 * Convert 24-hour time string to 12-hour format with AM/PM.
 * 
 * @param time24 - "14:00"
 * @returns "2:00 PM"
 */
export function formatTime12Hour(time24: string): string {
  const [hour, minute] = time24.split(":").map(Number);
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Parse 12-hour time string to minutes since midnight.
 * Helper for sorting.
 * 
 * @param time12 - "2:00 PM"
 * @returns Minutes since midnight (e.g., 840 for 2:00 PM)
 */
export function parse12HourTime(time12: string): number {
  const [time, ampm] = time12.split(" ");
  const [hour, minute] = time.split(":").map(Number);
  let hour24 = hour;
  if (ampm === "PM" && hour !== 12) hour24 += 12;
  if (ampm === "AM" && hour === 12) hour24 = 0;
  return hour24 * 60 + minute;
}

