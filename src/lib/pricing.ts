/**
 * Centralized pricing configuration for LaFade
 * 
 * This is the single source of truth for all haircut prices.
 * UI, Stripe, and database should all reference this config.
 */

export interface PricingItem {
  label: string;
  cents: number;
  stripePriceId: string | null;
}

export const PRICING = {
  freeTrial: {
    label: "Free Test Cut",
    cents: 0,
    stripePriceId: null,
  } as PricingItem,

  standardCut: {
    label: "Standard Cut",
    // Base one-off price for a standard shop cut (in cents)
    cents: 4500,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD ?? null,
  } as PricingItem,

  deluxeCut: {
    label: "Deluxe Cut",
    // Base one-off price for a deluxe home cut (in cents)
    cents: 9000,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE ?? null,
  } as PricingItem,

  secondCut10: {
    label: "$10 Second Cut",
    cents: 1000,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SECOND_CUT ?? null,
  } as PricingItem,
} as const;

/**
 * Helper to format cents as dollars
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get pricing item by plan ID (for backward compatibility with existing plan system)
 */
export function getPricingByPlanId(planId: "trial" | "standard" | "deluxe"): PricingItem {
  switch (planId) {
    case "trial":
      return PRICING.freeTrial;
    case "standard":
      return PRICING.standardCut;
    case "deluxe":
      return PRICING.deluxeCut;
    default:
      throw new Error(`Unknown plan ID: ${planId}`);
  }
}

