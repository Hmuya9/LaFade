"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppointmentList } from "@/components/ui/appointment-list";
import type { AppointmentCardData } from "@/components/ui/appointment-card";

interface UpcomingAppointmentsClientProps {
  appointments: AppointmentCardData[];
}

/**
 * Client component for upcoming appointments with reschedule/cancel actions.
 * Receives already-filtered upcoming appointments from server component.
 */
export function UpcomingAppointmentsClient({ appointments }: UpcomingAppointmentsClientProps) {
  const router = useRouter();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const handleReschedule = (appointmentId: string) => {
    setReschedulingId(appointmentId);
    router.push(`/booking?reschedule=${appointmentId}`);
  };

  const handleCancel = async (appointmentId: string) => {
    // Confirm before canceling
    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment? You can reschedule it instead if you'd like to change the time."
    );
    
    if (!confirmed) {
      return;
    }

    setCancelingId(appointmentId);
    
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "CANCELED",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to cancel appointment");
      }

      // Refresh the page to show updated appointment list
      router.refresh();
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      alert(error instanceof Error ? error.message : "Failed to cancel appointment. Please try again.");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <AppointmentList
      appointments={appointments}
      emptyMessage="You haven't booked a cut yet. Your first one is on us."
      emptyActionLabel="Book Now"
      emptyActionHref="/booking"
      showActions={true}
      onReschedule={handleReschedule}
      onCancel={handleCancel}
      cancelingId={cancelingId}
      reschedulingId={reschedulingId}
    />
  );
}

