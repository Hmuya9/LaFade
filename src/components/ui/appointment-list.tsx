import * as React from "react";
import { AppointmentCard, type AppointmentCardData } from "./appointment-card";
import { cn } from "@/lib/utils";

// Re-export for convenience
export type { AppointmentCardData } from "./appointment-card";

export interface AppointmentListProps {
  appointments: AppointmentCardData[];
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  className?: string;
  showActions?: boolean;
  onCancel?: (appointmentId: string) => void;
  onReschedule?: (appointmentId: string) => void;
  cancelingId?: string | null;
  reschedulingId?: string | null;
}

/**
 * Appointment list component - displays a list of appointment cards
 * Handles empty states with soft, friendly messaging
 * Reusable for client and barber dashboards
 */
export function AppointmentList({
  appointments,
  emptyMessage = "No appointments found",
  emptyActionLabel,
  emptyActionHref,
  className,
  showActions = false,
  onCancel,
  onReschedule,
  cancelingId = null,
  reschedulingId = null
}: AppointmentListProps) {
  if (appointments.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-slate-200/60 bg-slate-50/50 p-8 text-center", className)}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <span className="text-2xl">✂️</span>
        </div>
        <p className="text-sm font-medium text-slate-900 mb-1">{emptyMessage}</p>
        {emptyActionLabel && emptyActionHref && (
          <a
            href={emptyActionHref}
            className="mt-3 inline-flex items-center rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
          >
            {emptyActionLabel}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {appointments.map((appointment) => (
        <AppointmentCard 
          key={appointment.id} 
          appointment={appointment}
          showActions={showActions}
          onCancel={onCancel}
          onReschedule={onReschedule}
          isCanceling={cancelingId === appointment.id}
          isRescheduling={reschedulingId === appointment.id}
        />
      ))}
    </div>
  );
}

