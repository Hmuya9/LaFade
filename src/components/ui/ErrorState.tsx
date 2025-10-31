import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({ 
  title = "Something went wrong", 
  description = "We encountered an error. Please try again.",
  onRetry,
  className
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <Alert variant="destructive" className="max-w-md">
        <AlertDescription className="text-center">
          <div className="font-semibold mb-2">{title}</div>
          <div className="text-sm mb-4">{description}</div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
