import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
