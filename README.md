# Le Fade - Barber Booking System

A modern booking platform for professional hair-cutting services with email notifications and calendar integration.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your configuration

# Set up database
npm run db:dedupe    # Remove any duplicate appointments
npm run db:migrate   # Apply schema changes with unique constraints

# Run in development
npm run dev -- --port 9999
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

### Required
- `DATABASE_URL` - SQLite: `file:./dev.db` or PostgreSQL URL for production
- `NEXT_PUBLIC_APP_URL` - Your app URL (local: `http://localhost:9999`)

### Optional Email Integration
- `RESEND_API_KEY` - For sending confirmation emails
- `NOTIFY_FROM` - Sender email like `"Le Fade <no-reply@yourdomain.com>"`
- `NOTIFY_TO` - Internal notifications like `"bookings@lefade.com"`

**Without email setup**: Bookings still work perfectly, with "Add to Calendar (.ics)" download buttons as fallback.

### Optional Stripe Integration
- `STRIPE_SECRET_KEY` - For payment processing
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Public Stripe key
- `STRIPE_WEBHOOK_SECRET` - For webhooks
- `NEXT_PUBLIC_STRIPE_PRICE_STANDARD` - Standard plan price ID
- `NEXT_PUBLIC_STRIPE_PRICE_DELUXE` - Deluxe plan price ID

## Database Management

```bash
# Remove duplicate appointments
npm run db:dedupe

# Apply schema changes
npm run db:migrate

# Visual database browser
npm run db:studio
```

## Windows Development Notes

If `npx prisma generate` fails with EPERM errors:
1. Stop the development server (Ctrl+C)
2. Run: `npx prisma generate`
3. Restart the development server

This is due to Windows file locking when Prisma tries to update the query engine.

## Features

### Booking System
- ✅ Real-time availability checking
- ✅ Duplicate booking prevention (DB constraints)
- ✅ Email confirmations with calendar invites
- ✅ ICS file downloads when email unavailable
- ✅ Free trial validation (one per person)

### Availability API
- Automatic slot generation (30-min intervals)
- Working hours per barber (configurable)
- Real-time conflict detection
- Immediate UI updates after booking

### Plans Integration
- Click "Free Trial" → `/booking?plan=trial`
- Click "Get Standard" → `/booking?plan=standard`
- Click "Get Deluxe" → `/booking?plan=deluxe`
- Forms auto-preselects based on URL

### Duplicate Prevention
- Database unique constraints on `(barberId, startAt)` and `(clientId, startAt)`
- Server-side conflict validation
- UI disables submit button during processing
- Idempotent request handling

## API Endpoints

- `/api/bookings` - POST: Create booking, GET: List bookings
- `/api/availability` - GET: Available time slots for a barber/date
- `/api/bookings/ics/{id}` - GET: Download .ics calendar file

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Database seeding
npm run seed:reviews
```

## Production Deployment

1. Set up PostgreSQL database
2. Update `DATABASE_URL` in environment
3. Run `npm run build`
4. Deploy with your preferred platform (Vercel, etc.)
5. Set up Resend API key for email delivery
6. Configure Stripe webhooks if using payments