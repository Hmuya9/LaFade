import { prisma } from "@/lib/db";

export type BarberDaySummary = {
  dayIndex: number;      // 0-6 (Sun-Sat)
  label: string;         // "Sun" | "Mon" | ... | "Sat"
  slots: { start: string; end: string }[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Get weekly availability summary for a barber.
 * Groups availability by day of week and sorts by day index and start time.
 * 
 * @param barberId - Barber's user ID
 * @returns Array of day summaries with slots, sorted by day (Sun-Sat)
 */
export async function getBarberWeeklySummary(
  barberId: string
): Promise<BarberDaySummary[]> {
  const availability = await prisma.barberAvailability.findMany({
    where: { barberId },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
  });

  if (process.env.NODE_ENV === "development") {
    console.log("[barber-weekly-summary] Fetched availability:", {
      barberId,
      rangesCount: availability.length,
    });
  }

  // Group by dayOfWeek
  const groupedByDay = new Map<number, BarberDaySummary>();

  // Initialize all days with empty slots
  for (let i = 0; i < 7; i++) {
    groupedByDay.set(i, {
      dayIndex: i,
      label: DAY_LABELS[i],
      slots: [],
    });
  }

  // Add availability ranges to their respective days
  for (const avail of availability) {
    const day = groupedByDay.get(avail.dayOfWeek);
    if (day) {
      day.slots.push({
        start: avail.startTime,
        end: avail.endTime,
      });
    }
  }

  // Convert to array, filter out days with no slots, and sort by dayIndex
  const summary = Array.from(groupedByDay.values())
    .filter((day) => day.slots.length > 0)
    .sort((a, b) => a.dayIndex - b.dayIndex);

  if (process.env.NODE_ENV === "development") {
    console.log("[barber-weekly-summary] Summary generated:", {
      barberId,
      daysWithAvailability: summary.length,
      totalRanges: summary.reduce((sum, day) => sum + day.slots.length, 0),
    });
  }

  return summary;
}



