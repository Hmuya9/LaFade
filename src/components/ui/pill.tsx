import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "available" | "unavailable" | "highlight";
  icon?: LucideIcon;
  children: React.ReactNode;
}

/**
 * Reusable pill/chip component for availability, day chips, etc.
 * Designed for social-ready UI with subtle animations.
 */
export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  ({ className, variant = "default", icon: Icon, children, ...props }, ref) => {
    const baseClasses = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all duration-200";
    
    const variantClasses = {
      default: "bg-white/70 text-slate-700 shadow-sm border border-slate-200/50",
      available: "bg-rose-100/80 text-rose-900 shadow-sm border border-rose-200/50 hover:bg-rose-200/80",
      unavailable: "bg-slate-100/50 text-slate-500 border border-slate-200/30",
      highlight: "bg-amber-100/80 text-amber-900 shadow-sm border border-amber-200/50",
    };

    return (
      <span
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        {...props}
      >
        {Icon && <Icon className="w-3 h-3 mr-1.5" />}
        {children}
      </span>
    );
  }
);

Pill.displayName = "Pill";



