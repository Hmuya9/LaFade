# LaFade Environment Setup

This document outlines the required environment variables for the LaFade application.

## Required Environment Variables

### NextAuth Configuration
```bash
NEXTAUTH_URL=http://localhost:3000          # Your app URL
NEXTAUTH_SECRET=<your-secret-key>           # Random string (keep secret!)
AUTH_TRUST_HOST=true                        # Allow Vercel previews
```

### Resend Email Provider
```bash
RESEND_API_KEY=re_...                       # Your Resend API key
EMAIL_FROM=onboarding@resend.dev           # Sender email (or your verified domain)
```

### Barber Configuration
```bash
BARBER_EMAIL=hmuya@uw.edu                   # Email for barber login
BARBER_NAME=CKENZO                          # Single barber name
NEXT_PUBLIC_BARBER_NAME=CKENZO             # Public barber name
```

### Database
```bash
# Local Development
DATABASE_URL=file:./dev.db

# Production (Neon Postgres)
DATABASE_URL=postgresql://...
```

### Stripe (Optional - for payments)
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SUB=price_...                  # Subscription price ID
```

### Application
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

1. Create a `.env.local` file in the `web` directory
2. Copy the variables above and fill in your values
3. For Resend:
   - Sign up at https://resend.com
   - Create an API key
   - Use `onboarding@resend.dev` for testing, or verify your domain for production
4. For NextAuth:
   - Generate a secret: `openssl rand -base64 32`
   - Add it as `NEXTAUTH_SECRET`
5. For Stripe:
   - Sign up at https://stripe.com
   - Get test API keys from the dashboard
   - Set up billing portal in test mode

## Local Development

The app will use SQLite (`file:./dev.db`) for local development.

Run:
```bash
cd web
npm install
npm run db:push:local
npm run seed:local
npm run dev
```

## Production Deployment

1. Set environment variables in Vercel
2. Use a Postgres database (Neon, Supabase, etc.)
3. Update `DATABASE_URL` to your Postgres connection string
4. Ensure all required variables are set in Vercel

## Important Notes

- The `.env.local` file is ignored by git - never commit secrets
- Use test mode for Stripe and Resend in development
- Verify your sending domain in Resend for production
- The barber email determines role assignment (BARBER vs CLIENT)