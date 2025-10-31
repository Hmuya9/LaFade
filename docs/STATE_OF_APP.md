# LaFade Application - State of App Report

## Executive Summary

LaFade is a Next.js 14 application with NextAuth email-based authentication, Prisma ORM, Stripe payments, Resend email service, and a points-based booking system. The application has evolved from Clerk-based auth to NextAuth with email magic links, and includes role-based access control for barbers and clients.

## Authentication (NextAuth)

### Configuration
- **Provider**: Email Provider with custom Resend integration
- **Session Strategy**: JWT (not database sessions)
- **Adapter**: PrismaAdapter for user management
- **Version**: NextAuth v5 (beta)

### Email Flow
- **Magic Links**: Sent via Resend API directly (not SMTP)
- **From Address**: `process.env.EMAIL_FROM` (defaults to "onboarding@resend.dev")
- **Expiration**: 24 hours (`maxAge: 24 * 60 * 60`)
- **Custom Handler**: `sendVerificationRequest` uses Resend API

### URLs and Routes
- **Sign-in URL**: `/api/auth/signin/email`
- **Callback URL**: `/api/auth/callback/email`
- **Providers URL**: `/api/auth/providers`
- **Session URL**: `/api/auth/session`

### Environment Variables
- **NEXTAUTH_SECRET**: Required for JWT signing
- **NEXTAUTH_URL**: Used for callback URL generation
- **AUTH_TRUST_HOST**: Set to `true` for Vercel deployments
- **EMAIL_FROM**: Resend sender address
- **BARBER_EMAIL**: Email that gets BARBER role (case-insensitive)

### Role Assignment
- **Automatic**: Based on email comparison with `BARBER_EMAIL`
- **Case-insensitive**: Both emails normalized to lowercase
- **Default Role**: CLIENT for all other emails
- **Promotion**: Existing CLIENT users can be promoted to BARBER

### Cookies
- **CSRF Token**: `authjs.csrf-token`
- **Callback URL**: `authjs.callback-url`
- **Session**: JWT stored in secure HTTP-only cookie

## Resend Integration

### Usage Locations
- **Authentication**: Magic link emails in `src/lib/auth.ts`
- **Booking Confirmations**: Appointment emails in `src/lib/notify.ts`
- **Test Endpoint**: `/api/dev/resend-self` for smoke testing

### Configuration
- **API Key**: `process.env.RESEND_API_KEY`
- **From Address**: `process.env.EMAIL_FROM` (must be verified domain)
- **Error Handling**: Graceful fallback if API key missing

### Email Templates
- **Magic Links**: Simple HTML with clickable link
- **Booking Confirmations**: Rich HTML with ICS calendar invite
- **Subject Lines**: "Your LaFade magic sign-in link", "Booking Confirmation"

## Prisma Database Schema

### Authentication Models
- **User**: Core user with role, email, verification status
- **Account**: NextAuth provider accounts (not used with email provider)
- **Session**: NextAuth sessions (not used with JWT strategy)
- **VerificationToken**: Magic link tokens

### Business Models
- **Availability**: Time slots with barber name, date, time, booking status
- **Appointment**: Booked appointments with client/barber relations
- **PointsLedger**: Transactional points system (credit/debit)
- **Subscription**: Stripe subscription management
- **Payment**: Payment records from Stripe
- **Plan**: Subscription plan definitions

### Unique Indexes
- **Availability**: `@@unique([barberName, date, timeSlot])` - prevents double booking
- **User**: `email` unique constraint
- **Appointment**: Multiple unique constraints for scheduling conflicts

## Availability & Booking System

### API Routes
- **GET /api/availability**: Fetch available slots for barber/date
- **POST /api/bookings**: Create new appointment (requires CLIENT auth)
- **GET /api/bookings/ics/[id]**: Download calendar file

### Validation Rules
- **Authentication**: Must be CLIENT role for booking
- **Points**: 5 points required per booking (except trials)
- **Idempotency**: SHA256 hash prevents duplicate bookings
- **Availability**: Slot must exist and be unbooked

### Date/Timezone Handling
- **Storage**: All dates stored as UTC in database
- **Query**: Date filtering uses UTC start/end of day
- **Display**: Frontend handles timezone conversion

### Booking Flow
1. Client selects barber, date, time
2. System checks availability and points balance
3. Transaction creates Appointment + marks Availability as booked
4. Points debited (5 points) or booking fails
5. Email confirmation sent with ICS calendar invite

## Stripe Integration

### API Routes
- **POST /api/create-checkout-session**: Create Stripe checkout
- **POST /api/stripe/webhook**: Handle Stripe events

### Events Handled
- **checkout.session.completed**: 
  - Subscription signup: +10 points
  - One-off payment: Creates appointment + marks slot booked
- **invoice.payment_succeeded**: +12 points for renewals
- **customer.subscription.updated**: Updates subscription status
- **customer.subscription.deleted**: Cancels subscription

### Environment Variables
- **STRIPE_SECRET_KEY**: Server-side operations
- **STRIPE_WEBHOOK_SECRET**: Webhook signature verification
- **STRIPE_PRICE_SUB**: Subscription price ID

### Payment Flow
1. Client initiates checkout (subscription or one-off)
2. Stripe processes payment
3. Webhook creates/updates records
4. Points credited for subscriptions
5. Appointments created for one-off payments

## Points System

### Credit/Debit Logic
- **Credit**: Positive delta added to ledger
- **Debit**: Negative delta added to ledger
- **Balance**: Sum of all deltas for user
- **Validation**: Debit throws error if insufficient points

### Transaction Boundaries
- **Booking**: Points debited in same transaction as appointment creation
- **Rollback**: If points insufficient, appointment creation is rolled back
- **Atomic**: All-or-nothing operations

### Points Sources
- **Subscription Signup**: +10 points
- **Subscription Renewal**: +12 points
- **Booking Cost**: -5 points per appointment

### API Routes
- **GET /api/me/points**: Fetch user's current balance

## Barber Dashboard

### Pages
- **/barber/login**: Magic link sign-in form
- **/barber**: Dashboard (requires BARBER role)

### APIs
- **GET /api/barber/availability**: Fetch barber's slots
- **POST /api/barber/availability**: Add new slot
- **DELETE /api/barber/availability/[id]**: Remove slot

### Access Control
- **Authentication**: Must be signed in
- **Authorization**: Must have BARBER role
- **Email-based**: Role assigned based on `BARBER_EMAIL` match

### Features
- **Slot Management**: Add/delete availability slots
- **Booking Status**: View which slots are booked
- **Date/Time**: Manual slot creation with validation

## Environment Variables

### Required Locally
- **DATABASE_URL**: SQLite file path (`file:./dev.db`)
- **NEXTAUTH_SECRET**: JWT signing secret
- **RESEND_API_KEY**: Email service API key
- **EMAIL_FROM**: Verified sender address
- **BARBER_EMAIL**: Email for barber role assignment

### Required in Production
- **DATABASE_URL**: PostgreSQL connection string
- **NEXTAUTH_URL**: Full app URL (e.g., `https://app.vercel.app`)
- **NEXTAUTH_SECRET**: Same as local
- **RESEND_API_KEY**: Production API key
- **EMAIL_FROM**: Production verified domain
- **STRIPE_SECRET_KEY**: Production Stripe key
- **STRIPE_WEBHOOK_SECRET**: Production webhook secret
- **STRIPE_PRICE_SUB**: Production subscription price ID

### Optional
- **NEXT_PUBLIC_APP_URL**: Used in emails and links
- **NOTIFY_FROM**: Alternative email sender
- **NOTIFY_TO**: Admin notification email
- **REDIS_URL**: Caching (graceful fallback if missing)

## Current Issues & Considerations

### Authentication
- **Debug Mode**: Currently enabled (`debug: true`)
- **Case Sensitivity**: Fixed with normalized email comparison
- **Role Promotion**: Existing users can be promoted via database update

### Database
- **Dual Schema**: `schema.prisma` (Postgres) vs `schema.local.prisma` (SQLite)
- **Migration State**: Production uses Postgres, local uses SQLite
- **Seeding**: Local seed creates test availability data

### Email
- **Resend Dependency**: Authentication fails without valid API key
- **Domain Verification**: EMAIL_FROM must be verified in Resend
- **Fallback**: ICS downloads when email fails

### Points
- **Transaction Safety**: Proper rollback on insufficient points
- **Balance Calculation**: Real-time aggregation from ledger
- **Error Handling**: Clear error messages for insufficient funds

## Security Considerations

### Authentication
- **JWT Strategy**: No database session storage
- **CSRF Protection**: Built-in NextAuth CSRF tokens
- **Magic Links**: 24-hour expiration
- **Role-based Access**: Server-side role validation

### API Security
- **Rate Limiting**: Basic in-memory rate limiting
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection**: Prisma ORM prevents SQL injection
- **XSS Protection**: Next.js built-in protections

### Environment Security
- **Secret Management**: Environment variables for sensitive data
- **Production Guards**: Debug endpoints disabled in production
- **Webhook Verification**: Stripe signature validation
