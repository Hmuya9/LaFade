"use client";

import { useState, useEffect } from "react";
import { WeeklyScheduleCalendar } from "./WeeklyScheduleCalendar";
import { useSession } from "next-auth/react";

type AvailabilityData = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type AppointmentData = {
  id: string;
  startAt: string;
  endAt: string;
  clientName: string | null;
};

export function WeeklyScheduleCalendarWrapper() {
  const { data: session } = useSession();
  const [availabilities, setAvailabilities] = useState<AvailabilityData[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch availability
        const availResponse = await fetch("/api/barber/availability/weekly");
        if (availResponse.ok) {
          const availData = await availResponse.json();
          setAvailabilities(availData.availabilities || []);
        }

        // Fetch this week's appointments
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const appointmentsResponse = await fetch("/api/barber/appointments/me");
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          const allAppointments = [
            ...(appointmentsData.today || []),
            ...(appointmentsData.next7 || []),
          ];
          
          // Format appointments for calendar
          const formattedAppointments = allAppointments.map((apt: any) => ({
            id: apt.id,
            startAt: apt.startAt,
            endAt: apt.endAt,
            clientName: apt.client?.name || null,
          }));
          
          setAppointments(formattedAppointments);
        }
      } catch (error) {
        console.error("Failed to fetch calendar data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchData();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center">
        <p className="text-slate-600">Loading calendar...</p>
      </div>
    );
  }

  return (
    <WeeklyScheduleCalendar
      availabilities={availabilities}
      appointments={appointments}
    />
  );
}

