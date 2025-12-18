/**
 * Time utility functions for consistent timezone handling.
 * Uses America/Los_Angeles as the canonical business timezone.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parse } from 'date-fns';

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
  
  // Create a date string in ISO format, treating it as Los Angeles time
  const localDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${String(parseInt(mm ?? "0", 10)).padStart(2, '0')}:00`;
  
  // Parse as if it were in Los Angeles timezone and convert to UTC
  return fromZonedTime(new Date(localDateStr), BUSINESS_TIMEZONE);
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

