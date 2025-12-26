"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client component that forces a page refresh after booking redirect.
 * Ensures newly booked appointments always appear immediately on the dashboard.
 */
export function AccountRefreshHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("justBooked") === "1" || params.get("rescheduled") === "1") {
      // Small delay to ensure page has hydrated, then refresh to get latest data
      setTimeout(() => router.refresh(), 400);
    }
  }, [params, router]);

  return null;
}

