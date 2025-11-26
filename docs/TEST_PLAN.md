# LaFade Test Plan

## Overview

This document provides step-by-step instructions for testing all major flows in the LaFade application, including authentication, booking, payments, and points management.

## Prerequisites

### Local Development Setup
1. **Environment Variables**: Ensure `.env.local` contains:
   ```bash
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="your-secret-key"
   RESEND_API_KEY="re_your_api_key"
   EMAIL_FROM="onboarding@resend.dev"
   BARBER_EMAIL="hmuya@uw.edu"
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_PRICE_SUB="price_..."
   ```

2. **Database Setup**:
   ```bash
   npm run db:push:local
   npm run seed:local
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

### Production Testing
- Ensure all environment variables are set in Vercel
- Verify `NEXTAUTH_URL` matches your production domain
- Test with Stripe test mode keys

## Test Flows

### 1. Authentication Flow (Email Magic Links)

#### Local Testing
1. **Start the server**: `npm run dev`
2. **Open barber login**: Navigate to `http://localhost:3000/barber/login`
3. **Submit email**: Enter `hmuya@uw.edu` and click "Send Magic Link"
4. **Check email**: Look for magic link email in inbox
5. **Click magic link**: Should redirect to `/barber` dashboard
6. **Verify session**: Check `http://localhost:3000/api/dev/session` shows authenticated session
7. **Check cookies**: Verify `authjs.csrf-token` and `authjs.callback-url` cookies are set

#### Common Issues & Solutions
- **Link reloads login page**: Check `NEXTAUTH_URL` matches actual URL
- **401 from Resend**: Verify `RESEND_API_KEY` is valid
- **Token not found**: Ensure Prisma migrations are applied
- **Role not assigned**: Check `BARBER_EMAIL` matches exactly (case-insensitive)

#### Production Testing
1. **Deploy to Vercel**: Ensure `NEXTAUTH_URL` is set to production domain
2. **Test magic link**: Use production domain in browser
3. **Verify cookies**: Check domain matches callback URL
4. **Test role assignment**: Confirm BARBER role is assigned correctly

### 2. Barber Dashboard Flow

#### Adding Availability Slots
1. **Login as barber**: Use magic link with `BARBER_EMAIL`
2. **Access dashboard**: Navigate to `/barber`
3. **Add slot**: 
   - Date: Tomorrow's date
   - Time: 09:00
   - Click "Add Slot"
4. **Verify slot appears**: Check slot shows in availability list
5. **Test duplicate prevention**: Try adding same slot again (should fail)

#### Managing Slots
1. **View existing slots**: See all slots with booking status
2. **Delete unbooked slot**: Click delete on available slot
3. **Try delete booked slot**: Should be disabled/grayed out
4. **Verify deletion**: Slot should disappear from list

### 3. Client Authentication & Points

#### Client Sign-up
1. **Use different email**: Sign in with email ≠ `BARBER_EMAIL`
2. **Verify role**: Check `/api/dev/session` shows `role: "CLIENT"`
3. **Check points**: Visit `/account` - should show 0 points initially

#### Points Management
1. **View account page**: Navigate to `/account`
2. **Check points balance**: Should display current points
3. **Subscribe button**: Click to go to subscription flow

### 4. Stripe Subscription & Points Credit

#### Test Subscription Flow
1. **Start subscription**: Click "Subscribe" from `/account`
2. **Stripe checkout**: Complete test payment
3. **Verify webhook**: Check server logs for webhook processing
4. **Check points**: Visit `/account` - should show +10 points
5. **Verify database**: Check `PointsLedger` table for credit entry

#### Manual Webhook Testing (Stripe CLI)
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Test checkout.session.completed
stripe trigger checkout.session.completed

# Test invoice.payment_succeeded  
stripe trigger invoice.payment_succeeded
```

#### Webhook Event Verification
- **checkout.session.completed**: +10 points for subscription signup
- **invoice.payment_succeeded**: +12 points for renewal
- **customer.subscription.updated**: Updates subscription status
- **customer.subscription.deleted**: Cancels subscription

### 5. Booking Flow & Points Debit

#### Complete Booking Process
1. **Login as client**: Use non-barber email
2. **Ensure points**: Have at least 5 points (subscribe if needed)
3. **Navigate to booking**: Go to `/booking`
4. **Select barber**: Choose barber (Mike or Alex)
5. **Select date**: Pick tomorrow's date
6. **Select time**: Choose available slot (e.g., 09:00)
7. **Fill form**: Complete customer details
8. **Submit booking**: Click "Book Appointment"

#### Verify Booking Success
1. **Check points**: Visit `/account` - should show -5 points
2. **Verify database**: 
   - `Appointment` record created
   - `Availability` slot marked as `isBooked: true`
   - `PointsLedger` entry with -5 delta
3. **Check availability**: Re-run booking form - slot should be gone
4. **Email confirmation**: Check for booking confirmation email

#### Test Insufficient Points
1. **Deplete points**: Book multiple appointments to reduce points
2. **Try booking**: Attempt booking with <5 points
3. **Verify error**: Should get 402 error "Not enough points"
4. **Check rollback**: No appointment created, availability unchanged

### 6. Availability System

#### Barber Adds Slots
1. **Login as barber**: Use `BARBER_EMAIL`
2. **Add multiple slots**: Create slots for tomorrow (09:00, 10:00, 11:00)
3. **Verify API**: Check `/api/availability?barberName=Mike&date=2025-10-20`

#### Client Books Slots
1. **Login as client**: Different email
2. **Book slot**: Select one of the available slots
3. **Verify removal**: Slot should disappear from availability
4. **Check barber view**: Barber dashboard should show slot as booked

#### Database Verification
```sql
-- Check availability records
SELECT * FROM Availability WHERE barberName = 'Mike' AND date = '2025-10-20';

-- Check appointments
SELECT * FROM Appointment WHERE startAt >= '2025-10-20' AND startAt < '2025-10-21';

-- Check points ledger
SELECT * FROM PointsLedger ORDER BY createdAt DESC LIMIT 10;
```

### 7. Error Handling & Edge Cases

#### Authentication Errors
- **Invalid email**: Test with malformed email addresses
- **Expired token**: Wait 24+ hours and try magic link
- **Wrong domain**: Test with incorrect `NEXTAUTH_URL`

#### Booking Errors
- **Double booking**: Try booking same slot twice quickly
- **Invalid barber**: Use non-existent barber name
- **Past dates**: Try booking in the past
- **Invalid times**: Use non-existent time slots

#### Payment Errors
- **Invalid webhook**: Send malformed webhook payload
- **Missing signature**: Test webhook without proper signature
- **Failed payment**: Test with declined test card

### 8. Production Deployment Verification

#### Environment Variables
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `NEXTAUTH_URL` matches production domain exactly
- [ ] `NEXTAUTH_SECRET` is set and secure
- [ ] `RESEND_API_KEY` is production key
- [ ] `EMAIL_FROM` is verified domain
- [ ] `STRIPE_SECRET_KEY` is production key
- [ ] `STRIPE_WEBHOOK_SECRET` is production secret

#### Database Migration
```bash
# Apply migrations to production
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

#### Smoke Tests
```bash
# Run production smoke tests
npm run smoke:prod
```

#### Manual Production Tests
1. **Magic link flow**: Test with production domain
2. **Payment processing**: Use real Stripe test mode
3. **Email delivery**: Verify emails arrive correctly
4. **Database persistence**: Check data survives deployments

## Troubleshooting Guide

### Authentication Issues
- **Magic link not working**: Check `NEXTAUTH_URL` and `NEXTAUTH_SECRET`
- **Role not assigned**: Verify `BARBER_EMAIL` matches exactly
- **Session not persisting**: Check cookie domain settings

### Database Issues
- **Connection failed**: Verify `DATABASE_URL` format
- **Migration errors**: Run `prisma migrate deploy`
- **Schema mismatch**: Ensure local and production schemas match

### Email Issues
- **Not sending**: Check `RESEND_API_KEY` validity
- **Domain not verified**: Verify `EMAIL_FROM` in Resend dashboard
- **Rate limits**: Check Resend usage limits

### Payment Issues
- **Webhook not firing**: Verify `STRIPE_WEBHOOK_SECRET`
- **Points not credited**: Check webhook event handling
- **Checkout failing**: Verify Stripe keys and price IDs

## Success Criteria

### ✅ Authentication
- Magic links work in both local and production
- Role assignment works correctly
- Sessions persist across page refreshes
- Logout clears session properly

### ✅ Booking System
- Slots can be added and removed by barbers
- Clients can book available slots
- Points are debited correctly
- Email confirmations are sent
- Double booking is prevented

### ✅ Payment System
- Subscriptions create Stripe customers
- Webhooks credit points correctly
- Payment failures are handled gracefully
- Subscription status updates properly

### ✅ Points System
- Credits and debits are atomic
- Balance calculations are accurate
- Insufficient funds prevent booking
- Transaction history is maintained

### ✅ Production Readiness
- All environment variables are set
- Database migrations are applied
- Email delivery works reliably
- Error handling is robust
- Performance is acceptable






