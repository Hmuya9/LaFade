import * as React from "react"
import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, title, description, variant = "default", onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl p-4 shadow-sm border",
          variant === "default" && "bg-white border-zinc-200",
          variant === "success" && "bg-emerald-50 border-emerald-200",
          variant === "error" && "bg-rose-50 border-rose-200",
          variant === "info" && "bg-sky-50 border-sky-200",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium">{title}</h4>
            {description ? (
              <p className="mt-1 text-sm text-zinc-600">{description}</p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    )
  }
)
Toast.displayName = "Toast"

export { Toast }
