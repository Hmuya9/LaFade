/**
 * Time utility functions for consistent timezone handling.
 * Uses America/Los_Angeles as the canonical business timezone.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parse, parseISO } from 'date-fns';

// Business timezone - all appointments are in Los Angeles time
export const BUSINESS_TIMEZONE = 'America/Los_Angeles';

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

/**
 * Convert a date+time string (in America/Los_Angeles) to a UTC Date object.
 * Used when creating appointments from user input.
 * 
 * @param dateStr - "2025-01-15" (YYYY-MM-DD)
 * @param timeStr - "9:00 AM" (12-hour format)
 * @returns UTC Date object
 */
export function parseLocalDateTimeToUTC(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [time, period] = timeStr.split(" ");
  const [hh, mm] = time.split(":");
  let hour24 = parseInt(hh, 10);
  if (period === "PM" && hour24 !== 12) hour24 += 12;
  if (period === "AM" && hour24 === 12) hour24 = 0;
  
  // SIMPLE CORRECT IMPLEMENTATION:
  // Use Intl API to get timezone offset for LA at this specific date/time
  // Then manually calculate UTC = LA time - offset
  
  // Create a reference date in LA timezone for this date
  // We'll use a known UTC time and see what it represents in LA
  const referenceUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Get what time this represents in LA
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const laTimeAtNoonUTC = formatter.format(referenceUTC);
  const [laHour, laMinute] = laTimeAtNoonUTC.split(':').map(Number);
  
  // Calculate offset: 12:00 UTC = laHour:laMinute in LA
  // If 12:00 UTC = 4:00 AM LA (PST), then LA is 8 hours behind UTC
  // Offset = laHour - 12 (negative means LA is behind UTC)
  // For PST: 4 - 12 = -8 (LA is 8 hours behind)
  const offsetHours = laHour - 12;
  
  // For our desired LA time (hour24:minute), calculate UTC
  // UTC = LA time - offset
  // Example: 14:30 LA - (-8) = 14:30 + 8 = 22:30 UTC ✓
  const utcHour = hour24 - offsetHours;
  let finalDay = day;
  let finalHour = utcHour;
  
  // Handle day rollover
  if (finalHour < 0) {
    finalHour += 24;
    finalDay -= 1;
  } else if (finalHour >= 24) {
    finalHour -= 24;
    finalDay += 1;
  }
  
  return new Date(Date.UTC(year, month - 1, finalDay, finalHour, parseInt(mm ?? "0", 10), 0));
}

/**
 * Format a UTC Date to display in America/Los_Angeles timezone.
 * 
 * @param utcDate - UTC Date object (from database)
 * @param formatStr - date-fns format string (e.g., "h:mm a", "MMM d, yyyy")
 * @returns Formatted string in Los Angeles time
 */
export function formatInBusinessTimeZone(utcDate: Date | string, formatStr: string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return formatInTimeZone(date, BUSINESS_TIMEZONE, formatStr);
}

/**
 * Format appointment date for display (e.g., "Jan 15")
 */
export function formatAppointmentDate(utcDate: Date | string): string {
  return formatInBusinessTimeZone(utcDate, 'MMM d');
}

/**
 * Format appointment time for display (e.g., "9:00 AM")
 */
export function formatAppointmentTime(utcDate: Date | string): string {
  return formatInBusinessTimeZone(utcDate, 'h:mm a');
}

/**
 * Format appointment date and time together (e.g., "Jan 15, 9:00 AM")
 */
export function formatAppointmentDateTime(utcDate: Date | string): string {
  return formatInBusinessTimeZone(utcDate, 'MMM d, h:mm a');
}

/**
 * Get a Date object representing the UTC date/time in Los Angeles timezone.
 * Useful for comparisons and operations that need LA time.
 */
export function toBusinessTimeZone(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, BUSINESS_TIMEZONE);
}

