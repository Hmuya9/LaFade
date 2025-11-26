import { useState, useEffect } from "react";

export interface UseAutoDismissBannerOptions {
  duration?: number; // milliseconds
  onDismiss?: () => void;
}

/**
 * Hook for auto-dismissing banners with manual dismiss option
 * Returns { isVisible, dismiss } for controlling banner visibility
 */
export function useAutoDismissBanner(
  initialVisible: boolean = true,
  options: UseAutoDismissBannerOptions = {}
) {
  const { duration = 5000, onDismiss } = options;
  const [isVisible, setIsVisible] = useState(initialVisible);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, onDismiss]);

  const dismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return { isVisible, dismiss };
}



