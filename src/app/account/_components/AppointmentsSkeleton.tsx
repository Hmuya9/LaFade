import { SkeletonCard } from "@/components/ui/skeleton-card";

/**
 * Skeleton loading state for appointments list
 * Shows 2-3 skeleton cards with pulsing animation
 */
export function AppointmentsSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}



