export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
  calendly: process.env.NEXT_PUBLIC_CALENDLY_URL || "",
  stripeStandard: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD || "",
  stripeDeluxe: process.env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE || "",
  linkStandard: process.env.NEXT_PUBLIC_STRIPE_LINK_STANDARD || "",
  linkDeluxe: process.env.NEXT_PUBLIC_STRIPE_LINK_DELUXE || "",
  redisUrl: process.env.REDIS_URL || "",
};
