"use client";

import { X } from "lucide-react";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useAutoDismissBanner } from "@/hooks/use-auto-dismiss-banner";

export interface DismissibleBannerProps {
  children: React.ReactNode;
  variant?: "success" | "info" | "warning" | "error";
  autoDismiss?: boolean;
  duration?: number;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Dismissible banner with auto-dismiss and manual close
 * Fades out smoothly when dismissed
 */
export function DismissibleBanner({
  children,
  variant = "success",
  autoDismiss = true,
  duration = 5000,
  onDismiss,
  className,
}: DismissibleBannerProps) {
  const { isVisible, dismiss } = useAutoDismissBanner(true, {
    duration: autoDismiss ? duration : undefined,
    onDismiss,
  });

  if (!isVisible) return null;

  const variantStyles = {
    success: "border-emerald-200 bg-emerald-50/80",
    info: "border-blue-200 bg-blue-50/80",
    warning: "border-amber-200 bg-amber-50/80",
    error: "border-red-200 bg-red-50/80",
  };

  return (
    <Alert
      className={cn(
        variantStyles[variant],
        "shadow-sm rounded-xl transition-all duration-300",
        !isVisible && "opacity-0 translate-y-[-4px]",
        className
      )}
    >
      <AlertDescription className="flex items-start justify-between gap-2">
        <span className="flex-1">{children}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="h-6 w-6 p-0 rounded-full hover:bg-black/5 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}



