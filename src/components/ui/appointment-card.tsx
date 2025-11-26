import * as React from "react";
import { Calendar, Clock, User, MapPin, X, CalendarDays, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { StatusBadge, type AppointmentStatus } from "./status-badge";
import { Button } from "./button";

export interface AppointmentCardData {
  id: string;
  barber: {
    id: string;
    name: string;
    photo: string | null;
    city?: string | null;
  };
  plan: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  type: "SHOP" | "HOME";
  address?: string | null;
  notes?: string | null;
}

export interface AppointmentCardProps {
  appointment: AppointmentCardData;
  className?: string;
  showActions?: boolean;
  onCancel?: (appointmentId: string) => void;
  onReschedule?: (appointmentId: string) => void;
}

/**
 * Appointment card component - displays a single appointment
 * Modern, soft UI with icons and status badge
 * Reusable for client and barber dashboards
 */
export function AppointmentCard({ 
  appointment, 
  className,
  showActions = false,
  onCancel,
  onReschedule
}: AppointmentCardProps) {
  const startDate = new Date(appointment.startAt);
  const endDate = new Date(appointment.endAt);
  
  // Show actions for upcoming appointments that are still active
  // Only show for BOOKED or CONFIRMED status (not CANCELED, COMPLETED, NO_SHOW)
  const shouldShowActions = showActions && 
    (appointment.status === "BOOKED" || appointment.status === "CONFIRMED");
  
  // Debug logging in development
  if (process.env.NODE_ENV === "development" && showActions) {
    console.log('[AppointmentCard]', {
      appointmentId: appointment.id,
      status: appointment.status,
      showActions,
      shouldShowActions,
      hasOnCancel: !!onCancel,
      hasOnReschedule: !!onReschedule,
    });
  }

  // Format: "Wed • Nov 27 • 3:00 PM"
  const dateFormatted = format(startDate, "EEE • MMM d");
  const timeFormatted = format(startDate, "h:mm a");
  const endTimeFormatted = format(endDate, "h:mm a");

  // Get barber initials for fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const barberInitials = getInitials(appointment.barber.name);

  return (
    <div
      className={cn(
        "group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:translate-y-[-1px] hover:shadow-md hover:bg-rose-50/40 hover:border-rose-300/60",
        className
      )}
    >
      <div className="flex items-start gap-4">
        {/* Barber Photo/Avatar */}
        <div className="relative flex-shrink-0">
          {appointment.barber.photo ? (
            <img
              src={appointment.barber.photo}
              alt={appointment.barber.name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-amber-100 ring-2 ring-slate-100">
              <span className="text-sm font-semibold text-slate-700">
                {barberInitials}
              </span>
            </div>
          )}
        </div>

        {/* Appointment Details */}
        <div className="flex-1 min-w-0">
          {/* Header: Date & Status */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-rose-500" />
              <span className="text-sm font-medium">{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={appointment.status} />
              {/* Future menu affordance - non-functional for now */}
              <button
                type="button"
                className="opacity-0 group-hover:opacity-40 hover:opacity-60 transition-opacity duration-200 p-1 rounded-full hover:bg-slate-100"
                aria-label="More options"
                disabled
              >
                <MoreVertical className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Barber Name */}
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{appointment.barber.name}</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 mb-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>
              {timeFormatted} – {endTimeFormatted}
            </span>
          </div>

          {/* Location (for HOME appointments) */}
          {appointment.type === "HOME" && appointment.address && (
            <div className="flex items-start gap-1.5 mb-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{appointment.address}</span>
            </div>
          )}

          {/* Plan Badge */}
          <div className="mt-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                appointment.plan === "Free Test Cut"
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : appointment.plan === "Deluxe"
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              )}
            >
              {appointment.plan}
              {appointment.type === "SHOP" && " • Shop"}
              {appointment.type === "HOME" && " • Home"}
            </span>
          </div>

          {/* Notes (if any) */}
          {appointment.notes && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-600 line-clamp-2">{appointment.notes}</p>
            </div>
          )}

          {/* Action Buttons (for clients) */}
          {shouldShowActions && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
              {onReschedule && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReschedule(appointment.id)}
                  className="flex-1 text-xs"
                >
                  <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                  Reschedule
                </Button>
              )}
              {onCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(appointment.id)}
                  className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

