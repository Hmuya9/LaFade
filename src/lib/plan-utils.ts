import { Plan } from "@/config/plans";

/**
 * Check if a plan is the Free Test Cut plan.
 * The Free Test Cut has:
 * - id === "trial"
 * - priceMonthlyCents === 0
 */
export function isFreeTestCut(plan: Plan | null | undefined): boolean {
  if (!plan) return false;
  // Primary check: plan ID
  if (plan.id === "trial") return true;
  // Fallback: price === 0 (defensive check)
  if (plan.priceMonthlyCents === 0) return true;
  return false;
}

/**
 * Get the required points for a booking plan.
 * Free Test Cut requires 0 points.
 * Paid plans (standard/deluxe) require 5 points per booking.
 */
export function getRequiredPointsForPlan(plan: Plan | null | undefined): number {
  if (isFreeTestCut(plan)) return 0;
  // All paid plans require 5 points per booking
  return 5;
}



