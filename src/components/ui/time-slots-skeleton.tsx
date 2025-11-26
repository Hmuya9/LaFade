import { cn } from "@/lib/utils";

/**
 * Skeleton loading state for time slots grid
 * Shows 6 placeholder buttons with pulsing animation
 */
export function TimeSlotsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-xl bg-slate-200 animate-pulse"
        />
      ))}
    </div>
  );
}



