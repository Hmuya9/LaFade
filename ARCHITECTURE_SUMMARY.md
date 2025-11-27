# LaFade Architecture Summary

### 1. Project Overview
LaFade is a haircut subscription platform where customers subscribe to monthly plans (Standard $39.99 or Deluxe $60) to book appointments with barbers. The app manages subscriptions via Stripe, handles appointment booking with real-time availability, and provides role-based dashboards for clients, barbers, and owners. Core features include email confirmations with calendar invites, points/rewards system, and admin metrics.

### 2. Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI components, React Hook Form + Zod validation
- **Backend**: Next.js API Routes, Server Actions, Prisma ORM
- **Database**: SQLite (dev) at `prisma/dev.db`, PostgreSQL-ready schema
- **Auth**: NextAuth.js v4 with Credentials provider (email/password) + Email provider (magic links), JWT sessions, role-based access
- **Payments**: Stripe for subscriptions and checkout sessions, webhook handlers for payment events
- **Other services**: Resend (email), Pusher (real-time updates), Cloudinary (image uploads), Redis (caching, optional)

### 3. Key Folders & Files
- **/app/**: Next.js App Router pages - `/login`, `/signup`, `/booking`, `/barber`, `/admin`, `/plans`, `/account`
- **/app/api/**: API routes - `/api/auth/[...nextauth]` (NextAuth), `/api/bookings`, `/api/availability`, `/api/stripe/webhook`, `/api/create-checkout-session`
- **/lib/**: Core utilities - `auth-options.ts` (NextAuth config), `auth-utils.ts` (centralized login helpers), `db.ts` (Prisma client), `stripe.ts`, `notify.ts` (Resend), `env.ts` (Zod-validated env vars)
- **/components/**: React components - `Navbar.tsx` (role-based links), `BookingForm.tsx`, auth components
- **/prisma/**: Database schema with User, Appointment, Subscription, Plan models; Role enum (CLIENT/BARBER/OWNER)
- **/middleware.ts**: Route protection, role-based access for `/admin` (OWNER only) and `/barber` (BARBER/OWNER)

### 4. Core Flows
- **Auth flow**: Signup creates CLIENT users with bcrypt password hashes. Login uses `verifyCredentials()` helper with case-insensitive email lookup (SQLite-compatible). NextAuth JWT/session callbacks propagate role. Middleware protects routes by role. Magic link auth also supported via EmailProvider.
- **Membership/subscription flow**: Users select plans on `/plans`, redirected to `/booking?plan=X`. Paid plans use Stripe Checkout (`/api/create-checkout-session`), free trials book directly. Stripe webhook (`/api/stripe/webhook`) handles `checkout.session.completed`, creates Subscription records, credits points. Subscription status tracked in DB (TRIAL/ACTIVE/PAST_DUE/CANCELED).
- **Booking flow**: `/api/availability` checks barber time slots, `/api/bookings` POST creates appointments with idempotency keys, sends email confirmations with .ics calendar files. Duplicate prevention via DB unique constraints on `[barberId, startAt]` and `[clientId, startAt]`.
- **Background jobs/webhooks**: Stripe webhook processes payment events, updates subscription status, credits points. No cron jobs; all async via webhooks.

### 5. Known Fragile / Messy Areas
- **Database path resolution**: `DATABASE_URL="file:./prisma/dev.db"` works in CLI but fails in Next.js server context (Error code 14). Path resolution differs between script execution and server runtime.
- **Auth code duplication**: Some legacy Clerk references in schema (`clerkId` field) but not used; NextAuth is the active auth system.
- **Email case sensitivity**: SQLite case-sensitive lookups handled via `findUserByEmailInsensitive()` which fetches all users and filters in memory (inefficient but works).
- **Environment variable loading**: Prisma CLI loads from `prisma/.env` while Next.js loads from `.env.local` - both need DATABASE_URL but paths may differ.




