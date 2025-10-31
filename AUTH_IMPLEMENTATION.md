# Auth, Subscriptions & Points Implementation

This document outlines the implementation of authentication, subscription management, and points-based booking system.

## Features Implemented

### 1. Authentication (NextAuth + Resend Email)
- **Email-based magic link authentication** using NextAuth with Resend
- **JWT session strategy** for stateless authentication
- **Automatic role assignment**: 
  - Email matching `BARBER_EMAIL` → `BARBER` role
  - All other emails → `CLIENT` role
- **Prisma adapter** for session management

### 2. Barber Dashboard (`/barber`)
- **Login page** (`/barber/login`) with magic link form
- **Dashboard** (`/barber`) for managing availability slots
- **CRUD operations** for availability slots
- **Duplicate prevention** with unique constraints

### 3. Points System (Ledger-based)
- **PointsLedger model** tracks all point transactions
- **Credit operations**: Subscription signup (+10), Renewal (+12)
- **Debit operations**: Booking appointments (-5)
- **Balance calculation** via aggregation
- **Transaction rollback** on insufficient points

### 4. Stripe Subscription Integration
- **Subscription checkout** using `STRIPE_PRICE_SUB`
- **Webhook handlers** for:
  - `checkout.session.completed` → +10 points
  - `invoice.payment_succeeded` → +12 points
- **Robust error handling** with logging

### 5. Booking System Updates
- **Authentication required** for all bookings
- **Points validation** before booking creation
- **Automatic rollback** on insufficient points
- **Points display** in booking UI
- **Sign-in prompts** for unauthenticated users

## Database Changes

### New Models Added
```prisma
model PointsLedger {
  id        String   @id @default(cuid())
  userId    String
  delta     Int      // Positive for credits, negative for debits
  reason    String   // 'SUBSCRIBE_INIT' | 'RENEWAL' | 'BOOKING_DEBIT'
  refType   String?  // 'SUBSCRIPTION' | 'INVOICE' | 'BOOKING'
  refId     String?  // Reference to related record
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  @@index([userId])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}
```

### User Model Updates
```prisma
model User {
  id            String    @id @default(cuid())
  role          Role      @default(CLIENT)
  email         String?   @unique
  emailVerified DateTime?  // Added for NextAuth
  phone         String?
  name          String?
  image         String?   // Added for NextAuth
  clerkId       String?   @unique
  createdAt     DateTime  @default(now())
  
  accounts      Account[]     // Added
  sessions      Session[]     // Added
  pointsLedger  PointsLedger[] // Added
  // ... existing relations
}
```

### Availability Model Updates
```prisma
model Availability {
  id          Int      @id @default(autoincrement())
  barberName  String
  date        DateTime
  timeSlot    String
  isBooked    Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@unique([barberName, date, timeSlot]) // Added unique constraint
}
```

## Environment Variables

### Required Variables
```bash
# Authentication
BARBER_EMAIL="barber@example.com"  # Email that gets BARBER role
EMAIL_FROM="lafade487@gmail.com"   # From address for magic links

# Stripe
STRIPE_PRICE_SUB="price_1Q1uX8HPLabcd12345"  # Subscription price ID

# Existing variables
DATABASE_URL="file:./dev.db"
STRIPE_SECRET_KEY="sk_test_..."
RESEND_API_KEY="re_test_dummy"
NOTIFY_TO="you@example.com"
NEXT_PUBLIC_APP_URL="http://localhost:9999"
STRIPE_WEBHOOK_SECRET="whsec_test_..."
```

## API Endpoints

### New Endpoints
- `POST /api/auth/[...nextauth]` - NextAuth authentication
- `GET /api/barber/availability` - Get barber's availability slots
- `POST /api/barber/availability` - Create new availability slot
- `DELETE /api/barber/availability/[id]` - Delete availability slot
- `GET /api/me/points` - Get user's points balance

### Updated Endpoints
- `POST /api/bookings` - Now requires authentication and points
- `POST /api/stripe/webhook` - Now credits points for subscriptions

## User Flows

### Client Flow
1. **Sign in** via magic link at `/booking`
2. **View points balance** in booking UI
3. **Book appointment** (requires 5 points, except free trials)
4. **Subscribe** to earn points via `/account`
5. **Manage account** at `/account`

### Barber Flow
1. **Sign in** at `/barber/login` with BARBER_EMAIL
2. **Access dashboard** at `/barber`
3. **Manage availability** slots (add/delete)
4. **View bookings** and slot status

## Points System

### Earning Points
- **Subscription signup**: +10 points
- **Monthly renewal**: +12 points

### Spending Points
- **Standard/Deluxe booking**: -5 points
- **Free trial**: 0 points (no deduction)

### Error Handling
- **Insufficient points**: Returns 402 status with rollback
- **Transaction safety**: Database rollback on points failure
- **Balance validation**: Real-time balance checking

## Security Considerations

- **Role-based access**: BARBER vs CLIENT role enforcement
- **Session validation**: JWT-based authentication
- **Points integrity**: Atomic transactions with rollback
- **Input validation**: Zod schemas for all inputs
- **Rate limiting**: Existing rate limiting preserved

## Migration Notes

- **PostgreSQL**: Applied via `prisma db push --accept-data-loss`
- **SQLite**: Applied via `prisma db push --accept-data-loss --schema prisma/schema.local.prisma`
- **Unique constraint**: Added to Availability table (may cause data loss warnings)
- **Backward compatibility**: Existing APIs preserved
