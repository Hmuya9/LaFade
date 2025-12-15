import Stripe from 'stripe'

// For deployment, use placeholder if no API key is provided
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

// Log which Stripe key is being used (last 6 chars for verification, never log full key)
console.log(
  "[stripe] using secret key suffix",
  stripeSecretKey.slice(-6)
);

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-08-27.basil',
})

export const formatAmountForDisplay = (amount: number, currency: string): string => {
  let numberFormat = new Intl.NumberFormat(['en-US'], {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'symbol',
  })
  return numberFormat.format(amount)
}

export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100)
}

