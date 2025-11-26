"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AnimatedListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Animation duration in ms (default: 200) */
  duration?: number;
}

/**
 * Wrapper for lists that should fade in/out when content changes.
 * Used for weekly availability pills, calendar chips, etc.
 */
export function AnimatedList({ 
  children, 
  className, 
  duration = 200,
  ...props 
}: AnimatedListProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 transition-opacity duration-200",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
      {...props}
    >
      {children}
    </div>
  );
}



