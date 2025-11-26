"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple modal component using overlay + centered content.
 * Lightweight, matches our soft aesthetic.
 * Smooth fade + scale animation on open/close.
 */
export function SimpleModal({
  open,
  onClose,
  title,
  description,
  children,
  className
}: SimpleModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-200" />

      {/* Modal Content */}
      <div
        className={cn(
          "relative z-50 w-full max-w-md mx-4 rounded-2xl bg-white shadow-xl border border-slate-200/60",
          "transition-all duration-200 ease-out",
          "animate-in fade-in-0 zoom-in-95",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {title && (
                  <h3 className="text-xl font-semibold text-slate-900 mb-1">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-sm text-slate-600">
                    {description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

