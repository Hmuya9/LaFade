import * as React from "react";
import { cn } from "@/lib/utils";

export type AppointmentStatus = "BOOKED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELED";

export interface StatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
}

/**
 * Status badge component for appointment statuses
 * Uses soft, modern styling with color-coded states
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    BOOKED: {
      label: "Booked",
      className: "bg-slate-100 text-slate-700 border-slate-200"
    },
    CONFIRMED: {
      label: "Confirmed",
      className: "bg-blue-100 text-blue-700 border-blue-200"
    },
    COMPLETED: {
      label: "Completed",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200"
    },
    NO_SHOW: {
      label: "No Show",
      className: "bg-amber-100 text-amber-700 border-amber-200"
    },
    CANCELED: {
      label: "Canceled",
      className: "bg-red-100 text-red-700 border-red-200"
    }
  };

  const config = statusConfig[status] || statusConfig.BOOKED;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}



