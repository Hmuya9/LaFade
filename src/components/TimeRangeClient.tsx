"use client";

import { useMemo } from "react";
import { format } from "date-fns";

interface TimeRangeClientProps {
  startAt: string | Date;
  endAt?: string | Date;
  durationMinutes?: number;
  showDate?: boolean;
  dateFormat?: string;
  timeFormat?: string;
}

/**
 * Client-side component for formatting appointment time ranges.
 * Converts UTC timestamps from the database to the user's local timezone.
 * 
 * This component should be used instead of server-side date formatting
 * to ensure times are displayed correctly in the user's local timezone.
 */
export function TimeRangeClient({
  startAt,
  endAt,
  durationMinutes = 30,
  showDate = false,
  dateFormat = "EEEE, MMMM d",
  timeFormat = "h:mm a",
}: TimeRangeClientProps) {
  const { dateText, timeText } = useMemo(() => {
    // Parse startAt as UTC timestamp (from database)
    // ISO strings like "2024-01-15T15:00:00.000Z" are automatically parsed as UTC
    const start = typeof startAt === "string" ? new Date(startAt) : startAt;
    
    // Calculate endAt if not provided
    const end = endAt 
      ? (typeof endAt === "string" ? new Date(endAt) : endAt)
      : new Date(start.getTime() + durationMinutes * 60 * 1000);
    
    // Debug logging in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === "development") {
      console.log("[TimeRangeClient]", {
        inputStartAt: startAt,
        parsedStart: start.toISOString(),
        localStart: start.toString(),
        localTime: start.toLocaleString(),
        timezoneOffset: start.getTimezoneOffset(),
        formattedTime: timeFormat && timeFormat !== "" ? format(start, timeFormat) : "N/A (date only)",
      });
    }
    
    // Format dates in user's local timezone (browser automatically handles conversion)
    // date-fns format() automatically uses the browser's local timezone
    const dateText = showDate ? format(start, dateFormat) : null;
    
    // Only calculate timeText if timeFormat is provided and not empty
    const timeText = (timeFormat && timeFormat !== "") 
      ? `${format(start, timeFormat)} – ${format(end, timeFormat)}`
      : null;
    
    return { dateText, timeText };
  }, [startAt, endAt, durationMinutes, showDate, dateFormat, timeFormat]);

  if (showDate && dateText) {
    // If timeFormat is empty, only show date
    if (!timeText) {
      return <span>{dateText}</span>;
    }
    // Otherwise show date and time
    return (
      <span>
        {dateText} • {timeText}
      </span>
    );
  }

  if (!timeText) {
    // Fallback if timeText is null (shouldn't happen with default props)
    return <span>Invalid time</span>;
  }

  return <span>{timeText}</span>;
}

