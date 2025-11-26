"use client";

import { AppointmentList } from "@/components/ui/appointment-list";
import type { AppointmentCardData } from "@/components/ui/appointment-card";

interface UpcomingAppointmentsClientProps {
  appointments: AppointmentCardData[];
}

/**
 * Simple, literal component - receives already-filtered upcoming appointments.
 * No additional filtering or status logic - all filtering happens in page.tsx.
 */
export function UpcomingAppointmentsClient({ appointments }: UpcomingAppointmentsClientProps) {
  return (
    <AppointmentList
      appointments={appointments}
      emptyMessage="You haven't booked a cut yet. Your first one is on us."
      emptyActionLabel="Book Now"
      emptyActionHref="/booking"
      showActions={false} // TEMP: disable client actions for launch
    />
  );
}

