import { PRICING } from "@/lib/pricing";
import { COPY, SECOND_CUT_PRICE_CENTS, formatPrice } from "@/lib/lafadeBusiness";

export const PLANS = [
  {
    id: "trial",
    name: "Free Test Cut",
    // Delegate to central pricing config for consistency
    priceMonthlyCents: PRICING.freeTrial.cents,
    bullets: [
      "1 cut at the shop",
      "Try your barber with no risk",
      "One free cut per person",
    ],
    isHome: false,
    stripePriceId: "", // No payment required for trial
    highlightLine: `After this visit, you can come back for a ${formatPrice(SECOND_CUT_PRICE_CENTS)} second cut.`,
  },
  {
    id: "standard",
    name: "Standard",
    // Delegate to central pricing config (standard shop cut)
    priceMonthlyCents: PRICING.standardCut.cents,
    bullets: [
      "Up to 2 cuts per month at the shop",
      "Priority scheduling with your barber",
      "Your first cut in the funnel was free — this locks in your spot long-term",
    ],
    isHome: false,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD ?? "",
    highlightLine: "Perfect if you can come to the shop and want a consistent monthly fade.",
  },
  {
    id: "deluxe",
    name: "Deluxe",
    // Delegate to central pricing config (deluxe home cut)
    priceMonthlyCents: PRICING.deluxeCut.cents,
    bullets: [
      "Up to 2 home visits per month",
      "Travel included",
      "Same barber, same quality, at your place",
    ],
    isHome: true,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE ?? "",
    highlightLine: "Best if you want the shop experience brought to your home.",
  },
] as const;

export type Plan = typeof PLANS[number];
