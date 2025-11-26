import { cn } from "@/lib/utils";

export interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
}

/**
 * Skeleton loading state for appointment cards
 * Light pulsing animation, matches appointment card layout
 */
export function SkeletonCard({ className, showAvatar = true }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm animate-pulse",
        className
      )}
    >
      <div className="flex items-start gap-4">
        {showAvatar && (
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-slate-200" />
          </div>
        )}
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-5 w-16 bg-slate-200 rounded-full" />
          </div>
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-28 bg-slate-200 rounded" />
          <div className="h-5 w-20 bg-slate-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}



