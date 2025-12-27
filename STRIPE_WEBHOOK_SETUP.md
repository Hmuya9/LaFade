# Stripe Webhook Setup for Local Development

## Problem
Stripe cannot send webhooks directly to `localhost`. You need to use **Stripe CLI** to forward webhooks from Stripe to your local development server.

## Quick Setup

### 1. Install Stripe CLI

**Windows (PowerShell):**
```powershell
# Using Scoop (recommended)
scoop install stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download from: https://github.com/stripe/stripe-cli/releases
# Or use package manager
```

### 2. Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate with your Stripe account.

### 3. Start Your Dev Server

In one terminal, start your Next.js dev server:

```bash
cd web
pnpm dev
```

Your server should be running on `http://localhost:3000` (or check the console output for the actual port).

### 4. Forward Webhooks to Localhost

In a **separate terminal**, run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Important:** Replace `3000` with your actual dev server port if different.

### 5. Copy the Webhook Secret

Stripe CLI will output something like:

```
> Ready! Your webhook signing secret is whsec_86e8aafc8fcd676a599e0e9c745d14b54b61c4a84262fab1921e43133c3b51a8
```

**Copy this secret** and add it to your `.env.local` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_86e8aafc8fcd676a599e0e9c745d14b54b61c4a84262fab1921e43133c3b51a8
```

### 6. Restart Your Dev Server

After updating `.env.local`, restart your Next.js dev server so it picks up the new webhook secret.

## Verify It's Working

1. **Check Stripe CLI terminal** - You should see webhook events being forwarded:
   ```
   2024-01-15 10:30:45   --> checkout.session.completed [evt_xxx]
   2024-01-15 10:30:45  <--  [200] POST http://localhost:3000/api/stripe/webhook [evt_xxx]
   ```

2. **Check your dev server logs** - You should see webhook processing logs:
   ```
   [webhook][checkout.session.completed] Event received
   ✅ Subscription created: sub_xxx for user user@example.com
   ```

3. **Test a subscription:**
   - Go to `/plans` page
   - Click "Get Standard Membership" or "Get Deluxe Membership"
   - Complete the Stripe checkout with test card: `4242 4242 4242 4242`
   - Check your database - a Subscription row should be created
   - Check `/account` - should show "You're on the Standard membership" (or Deluxe)

## Troubleshooting

### Webhook secret mismatch
- **Error:** "Invalid signature" in webhook logs
- **Fix:** Make sure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the secret from `stripe listen` output

### Port mismatch
- **Error:** Stripe CLI can't connect to your server
- **Fix:** Check what port your Next.js dev server is running on and update the `--forward-to` URL

### Webhook not receiving events
- **Check:** Is Stripe CLI still running? (Keep the terminal open)
- **Check:** Is your dev server running?
- **Check:** Are you using test mode in Stripe? (Make sure your Stripe keys are test keys)

### Subscription not created
- **Check:** Webhook logs for errors
- **Check:** Database connection
- **Check:** User exists in database (webhook creates user if missing, but email must match)

## Production Setup

For production, you don't need Stripe CLI. Instead:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Copy the webhook signing secret
4. Add to production environment variables: `STRIPE_WEBHOOK_SECRET=whsec_...`

## Common Commands

```bash
# Listen and forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger a test webhook event
stripe trigger checkout.session.completed

# View webhook events
stripe events list

# View specific event
stripe events retrieve evt_xxx
```






