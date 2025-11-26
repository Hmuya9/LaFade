/**
 * Date utility functions for booking UI
 */

/**
 * Get the next date for a given weekday (0-6, where 0 = Sunday).
 * Returns the next occurrence of that weekday from today.
 * Uses local time to ensure correct calendar day.
 */
export function getNextDateForWeekday(dayOfWeek: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  
  // Calculate days until the next occurrence
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }
  
  const nextDate = addDays(today, daysUntil);
  
  // Format as YYYY-MM-DD in local time
  return formatDateLocal(nextDate);
}

/**
 * Get the next N dates for a weekday starting from today.
 * Uses local time to ensure correct calendar days.
 */
export function getNextNDatesForWeekday(dayOfWeek: number, count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  for (let i = 0; i < count; i++) {
    const date = addDays(today, daysUntil + (i * 7));
    dates.push(formatDateLocal(date));
  }
  
  return dates;
}

/**
 * Helper to add days to a date in local time (avoids timezone issues).
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format a Date to YYYY-MM-DD in local time (not UTC).
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get dates for the next 7 days (week strip).
 * Uses local time to ensure dates match the user's calendar.
 * Returns today's date string for comparison.
 */
export function getNext7Days(): Array<{ date: string; dayName: string; dayIndex: number; isToday: boolean }> {
  // Get today at start of day in local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateLocal(today);
  
  const days: Array<{ date: string; dayName: string; dayIndex: number; isToday: boolean }> = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const dayIndex = date.getDay();
    const dateStr = formatDateLocal(date);
    
    days.push({
      date: dateStr,
      dayName: dayNames[dayIndex],
      dayIndex,
      isToday: dateStr === todayStr,
    });
  }
  
  if (process.env.NODE_ENV === "development") {
    console.log("[date-utils] getNext7Days first day:", {
      label: days[0].dayName,
      dateString: days[0].date,
      isToday: days[0].isToday,
    });
  }
  
  return days;
}

/**
 * Format date to display format (e.g., "Nov 27").
 * Parses YYYY-MM-DD as local date (not UTC).
 */
export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format date with day name (e.g., "Wed, Nov 27").
 * Parses YYYY-MM-DD as local date (not UTC).
 */
export function formatDateWithDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

