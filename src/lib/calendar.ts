/**
 * Calendar ICS generation utility
 * Creates RFC 5545 compliant .ics files for appointment bookings
 */

import { BRAND } from "@/lib/brand";

interface ICSOptions {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
  organizer?: {
    name: string;
    email: string;
  };
}

/**
 * Generate ICS content for an appointment
 * Returns RFC 5545 compliant calendar invite string
 */
export function buildICS(options: ICSOptions): string {
  const { title, description, start, end, location, organizer } = options;
  
  // Convert dates to UTC format (YYYYMMDDTHHMMSSZ)
  const startUTC = start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const endUTC = end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  
  // Generate unique UID (RFC 4122)
  const uid = `${BRAND.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${BRAND.toLowerCase()}.com`;
  
  // Build ICS content
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND}//Booking System//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    '',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${startUTC}`,
    `DTEND:${endUTC}`,
    `SUMMARY:${escapeField(title)}`,
    `DESCRIPTION:${escapeField(description)}`,
  ];
  
  if (location) {
    lines.push(`LOCATION:${escapeField(location)}`);
  }
  
  if (organizer) {
    lines.push(`ORGANIZER;CN="${organizer.name}":mailto:${organizer.email}`);
  }
  
  lines.push(
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
    '' // End with LF
  );
  
  return lines.join('\r\n');
}

/**
 * Escape ICS field values for RFC compliance
 */
function escapeField(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Generate download URL for ICS file
 * Returns blob URL that can be used with <a download> or fetch()
 */
export async function generateICSBlobUrl(icsContent: string): Promise<string> {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}

/**
 * Trigger ICS file download in browser
 */
export function downloadICS(icsContent: string, filename: string = 'appointment.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

