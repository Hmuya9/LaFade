/**
 * Barber working hours configuration
 * Per-barber schedule defining when appointments can be booked
 */

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export const BARBER_HOURS = {
  Mike: {
    start: '09:00',
    end: '17:30',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const, // Closed Sundays
  },
  Alex: {
    start: '10:00', // Later start
    end: '16:30',  // Earlier end
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const,
  },
} as const;

// Slot duration in minutes
export const SLOT_DURATION = 30;

/**
 * Generate available time slots for a barber on a given date
 * Returns array of formatted time strings
 */
export function generateTimeSlots(barberName: string, date: Date): string[] {
  const config = BARBER_HOURS[barberName as keyof typeof BARBER_HOURS];
  if (!config) {
    console.warn(`No hours config found for barber: ${barberName}`);
    return [];
  }

  // Check if it's a working day
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }) as Weekday;
  if (!config.workingDays.includes(dayName)) {
    return []; // No slots on non-working days
  }

  const slots: string[] = [];
  const [startHour, startMinute] = config.start.split(':').map(Number);
  const [endHour, endMinute] = config.end.split(':').map(Number);

  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = endHour * 60 + endMinute;

  for (let minutes = startTimeInMinutes; minutes < endTimeInMinutes; minutes += SLOT_DURATION) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    
    const slotDate = new Date(date);
    slotDate.setHours(hour, minute, 0, 0);
    
    const timeString = slotDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    slots.push(timeString);
  }

  return slots;
}

/**
 * Parse a barber name to get their ID from the database
 * Helper function used by API route
 */
export function parseBarberIdentifier(identifier: string): { name: string; id?: string } {
  // Remove any prefix (e.g. "barber-") if present
  const cleanId = identifier.replace(/^(barber-|barberId=)/i, '');
  
  // If it looks like a CUID or UUID, treat as ID
  if (cleanId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(cleanId)) {
    return { name: '', id: cleanId };
  }
  
  // Otherwise treat as name
  return { name: cleanId };
}
