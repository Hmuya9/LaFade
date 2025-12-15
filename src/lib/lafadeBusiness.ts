/**
 * LaFade v1 Business Rules & Pricing
 * 
 * Single source of truth for v1 pricing, funnel rules, and copy.
 * Prevents drift between booking, plans, and API logic.
 */

// ============================================================================
// V1 PRICING (in cents)
// ============================================================================

export const SECOND_CUT_PRICE_CENTS = 1000; // $10.00

export const MEMBERSHIP_STANDARD_PRICE_CENTS = 4500; // $45.00/month

// Note: TRIAL_MEMBERSHIP_PRICE_CENTS omitted - not currently offered in v1

// ============================================================================
// V1 COMMISSION MODEL
// ============================================================================

export const COMMISSION_BARBER_PERCENT = 0.65; // 65% to barbers
export const COMMISSION_LAFADE_PERCENT = 0.35; // 35% to LaFade
export const OPS_COST_CENTS = 5000; // $50/month operations cost

// ============================================================================
// V1 CASH APP PAYMENT
// ============================================================================

export const CASH_APP_TAG = "LaFade01";

/**
 * Generate Cash App payment URL
 * @param amountCents Amount in cents
 * @param noteCode Unique code user must include in Cash App note
 * @returns Cash App payment URL
 */
export function cashAppUrl(amountCents: number, noteCode: string): string {
  const amountInDollars = (amountCents / 100).toFixed(2);
  const noteText = `LaFade ${noteCode}`;
  // Cash App URL format: https://cash.app/$TAG/AMOUNT?note=NOTE
  return `https://cash.app/$${CASH_APP_TAG}/${amountInDollars}?note=${encodeURIComponent(noteText)}`;
}

// ============================================================================
// V1 FUNNEL RULES
// ============================================================================

export const ONE_FREE_CUT_PER_USER = true;

// Note: SECOND_CUT_WINDOW_DAYS omitted - not currently enforced in v1

// ============================================================================
// V1 COPY SNIPPETS
// ============================================================================

export const COPY = {
  FREE_CUT: "Free cut (one-time)",
  SECOND_CUT: "$10 return cut",
  MEMBERSHIP_INCLUDED: "Membership included",
} as const;

/**
 * Helper to format cents as dollars (re-exported for convenience)
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

