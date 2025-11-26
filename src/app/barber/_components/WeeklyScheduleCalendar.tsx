"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, parse, setHours, setMinutes } from "date-fns";
import { cn } from "@/lib/utils";

type WeeklyScheduleCalendarProps = {
  availabilities: {
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    startTime: string; // e.g. "09:00"
    endTime: string;   // e.g. "17:00"
  }[];
  appointments: {
    id: string;
    startAt: Date | string;
    endAt: Date | string;
    clientName: string | null;
  }[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Format time from "HH:MM" to "h:mm AM/PM"
 */
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes || 0, 0, 0);
  return format(date, "h:mm a");
}

/**
 * Check if an appointment falls within a time range on a given day
 */
function isAppointmentInRange(
  appointment: { startAt: Date | string; endAt: Date | string },
  day: Date,
  startTime: string,
  endTime: string
): boolean {
  const aptStart = typeof appointment.startAt === "string" ? new Date(appointment.startAt) : appointment.startAt;
  const aptEnd = typeof appointment.endAt === "string" ? new Date(appointment.endAt) : appointment.endAt;
  
  if (!isSameDay(aptStart, day)) return false;
  
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  const rangeStart = setHours(setMinutes(day, startM || 0), startH);
  const rangeEnd = setHours(setMinutes(day, endM || 0), endH);
  
  return aptStart >= rangeStart && aptStart < rangeEnd;
}

export function WeeklyScheduleCalendar({ availabilities, appointments }: WeeklyScheduleCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Group availabilities by day of week
  const availabilitiesByDay = availabilities.reduce((acc, avail) => {
    if (!acc[avail.dayOfWeek]) {
      acc[avail.dayOfWeek] = [];
    }
    acc[avail.dayOfWeek].push(avail);
    return acc;
  }, {} as Record<number, typeof availabilities>);

  // Get appointments for current week
  const weekAppointments = appointments.filter((apt) => {
    const aptStart = typeof apt.startAt === "string" ? new Date(apt.startAt) : apt.startAt;
    const weekEnd = addDays(currentWeekStart, 7);
    return aptStart >= currentWeekStart && aptStart < weekEnd;
  });

  return (
    <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
      <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-t-2xl border-b">
        <CardTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-rose-600" />
          This Week&apos;s Schedule
        </CardTitle>
        <CardDescription className="text-slate-600">
          Your availability and booked cuts
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm font-medium text-slate-900">
            {format(currentWeekStart, "MMM d")} – {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
          </span>
          <button
            onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayOfWeek = day.getDay();
            const dayAvailabilities = availabilitiesByDay[dayOfWeek] || [];
            const dayAppointments = weekAppointments.filter((apt) => {
              const aptStart = typeof apt.startAt === "string" ? new Date(apt.startAt) : apt.startAt;
              return isSameDay(aptStart, day);
            });

            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border p-3 min-h-[200px]",
                  isToday
                    ? "border-rose-300 bg-rose-50/30"
                    : "border-slate-200 bg-white"
                )}
              >
                {/* Day Header */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {DAY_NAMES[dayOfWeek]}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold mt-1",
                      isToday ? "text-rose-700" : "text-slate-900"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>

                {/* Availability Blocks */}
                <div className="space-y-2 mb-3">
                  {dayAvailabilities.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No availability</div>
                  ) : (
                    dayAvailabilities.map((avail, idx) => (
                      <div
                        key={idx}
                        className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50/50 text-slate-700"
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatTime(avail.startTime)} – {formatTime(avail.endTime)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Booked Appointments */}
                <div className="space-y-1.5">
                  {dayAppointments.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No bookings</div>
                  ) : (
                    dayAppointments.map((apt) => {
                      const aptStart = typeof apt.startAt === "string" ? new Date(apt.startAt) : apt.startAt;
                      const aptEnd = typeof apt.endAt === "string" ? new Date(apt.endAt) : apt.endAt;
                      const clientInitials = apt.clientName
                        ? apt.clientName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : "??";

                      return (
                        <div
                          key={apt.id}
                          className="text-xs px-2 py-1.5 rounded-md bg-gradient-to-r from-rose-500 to-amber-500 text-white font-medium shadow-sm"
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span>
                              {format(aptStart, "h:mm")} – {format(aptEnd, "h:mm a")}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] opacity-90">{clientInitials}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

