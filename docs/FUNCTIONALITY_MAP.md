# LaFade Functionality Map

**Last Updated**: December 2024  
**Purpose**: Code-level audit mapping what works, what's wired, and what's missing

---

## 📍 **1. Routes & Pages (App Router)**

### **Auth Routes**
- `/login` - General login page
- `/signup` - Client signup
- `/signin` - Magic link signin
- `/client/login` - Client-specific login
- `/barber/login` - Barber-specific login
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form
- `/api/auth/*` - NextAuth API routes

**Components**:
- `src/app/login/LoginForm.tsx`
- `src/app/client/login/ClientLoginForm.tsx`
- `src/app/barber/login/BarberLoginForm.tsx`
- `src/app/signup/actions.ts` - Server actions for signup

**Auth Flow**:
1. User visits `/signup` → fills form → `signup/actions.ts` creates user with `role: "CLIENT"`
2. User visits `/login` → NextAuth handles authentication
3. Middleware (`src/middleware.ts`) protects routes based on role
4. After login → redirects to `/post-login` → role-based redirect

---

### **Client Pages**
- `/` - Landing page
- `/plans` - Subscription plans display
- `/booking` - Appointment booking form
- `/account` - Client account dashboard (points, subscription, password)
- `/post-login` - Post-login redirect handler

**Booking Page** (`/booking`):
- **Server Component**: `src/app/booking/page.tsx` - Fetches default barber
- **Client Component**: `src/app/booking/_components/BookingForm.tsx` - Main booking form
- **Components**:
  - `BookingPortfolioSection.tsx` - Barber portfolio photos
  - `BookingForm.tsx` - Full booking UI with:
    - Plan selection (Standard/Deluxe/Trial)
    - Barber selection
    - Date/time selection
    - Customer info form
    - Mini calendar strip
    - Weekly availability summary
    - Next 3 openings banner

**Account Page** (`/account`):
- **Server Component**: `src/app/account/page.tsx`
- **Shows**:
  - Points balance (from `PointsLedger` aggregate)
  - Subscription section (Subscribe / Manage buttons)
  - Password management
- **Missing**: No appointments display here

---

### **Barber Pages**
- `/barber` - Barber dashboard
- `/barber/login` - Barber login

**Barber Dashboard** (`/barber`):
- **Client Component**: `src/app/barber/page.tsx`
- **Components**:
  - `BarberPhotosSection.tsx` - Upload/manage portfolio photos
  - `RealtimeBookingsPanel.tsx` - Live bookings via Pusher (event stream only)
  - `WeeklyAvailabilityForm.tsx` - Set weekly recurring availability ranges
- **Shows**:
  - Portfolio photos upload
  - Weekly availability form (uses `BarberAvailability` model)
  - Live bookings panel (real-time events, not actual appointment list)
- **Missing**: No "My Appointments" list showing actual booked appointments

---

### **Admin/Owner Pages**
- `/admin` - Admin dashboard
- `/admin/appointments` - All upcoming appointments
- `/admin/barbers` - Barber management
- `/admin/broadcast` - Broadcast messages

**Admin Appointments** (`/admin/appointments`):
- **Server Component**: `src/app/admin/appointments/page.tsx`
- **Queries**: `prisma.appointment.findMany({ where: { startAt: { gte: now } } })`
- **Shows**: Table of all upcoming appointments (client, barber, time, notes)
- **Actions**: Cancel appointment button

---

## 🗄️ **2. Data Models (Prisma Schema)**

### **User Model**
```prisma
model User {
  id            String    @id @default(cuid())
  role          Role      @default(CLIENT)  // CLIENT | BARBER | OWNER
  email         String?   @unique
  name          String?
  phone         String?
  passwordHash  String?
  // Relations:
  clientAppts   Appointment[] @relation("ClientAppts")
  barberAppts   Appointment[] @relation("BarberAppts")
  subscriptions Subscription[]
  pointsLedger  PointsLedger[]
  weeklyAvailability BarberAvailability[]
  photos        Photo[]
}
```

**Key Fields**:
- `role` - Controls access: CLIENT, BARBER, OWNER
- `email` - Unique identifier (optional for phone-only)

---

### **Appointment Model**
```prisma
model Appointment {
  id             String     @id @default(cuid())
  clientId       String
  barberId       String
  type           ApptType   // SHOP | HOME
  startAt        DateTime
  endAt          DateTime
  status         ApptStatus @default(BOOKED)  // BOOKED | CONFIRMED | COMPLETED | NO_SHOW | CANCELED
  address        String?    // For HOME appointments
  notes          String?
  isFree         Boolean    @default(false)  // For trial cuts
  idempotencyKey String?    @unique  // Prevents duplicate bookings
  
  client User @relation("ClientAppts", fields: [clientId], references: [id])
  barber User @relation("BarberAppts", fields: [barberId], references: [id])
  
  @@unique([barberId, startAt])  // Prevents double-booking barbers
  @@unique([clientId, startAt])  // Prevents double-booking clients
  @@index([barberId, startAt])
}
```

**Status Flow**:
- `BOOKED` (default) → `CONFIRMED` → `COMPLETED` / `NO_SHOW` / `CANCELED`

**Key Constraints**:
- One barber per time slot (unique constraint)
- One client per time slot (unique constraint)
- Indexed by `barberId` + `startAt` for availability queries

---

### **BarberAvailability Model** (Current System)
```prisma
model BarberAvailability {
  id        String   @id @default(cuid())
  barberId  String
  dayOfWeek Int      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime String   // "10:00" (24-hour format)
  endTime   String   // "14:00" (24-hour format)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  barber User @relation("BarberAvailability", fields: [barberId], references: [id])
  
  @@unique([barberId, dayOfWeek, startTime, endTime])
  @@index([barberId, dayOfWeek])
}
```

**Purpose**: Weekly recurring availability ranges (e.g., "Monday 10:00-14:00")

---

### **Availability Model** (Legacy - Still in Schema)
```prisma
model Availability {
  id         Int      @id @default(autoincrement())
  barberName String
  date       DateTime
  timeSlot   String
  isBooked   Boolean  @default(false)
  
  @@unique([barberName, date, timeSlot])
}
```

**Status**: Legacy model, kept for backward compatibility. Not used in UI anymore.

---

### **Other Models**
- `Plan` - Subscription plans (Standard, Deluxe, Trial)
- `Subscription` - User subscriptions to plans
- `PointsLedger` - Transaction log for points (delta, reason, refType, refId)
- `Payment` - Stripe payment records
- `Photo` - Barber portfolio photos (Cloudinary)
- `Review` - Customer reviews (approved flag for moderation)

---

## 🔄 **3. Key Flows**

### **Client Flow: Sign Up → Book → See Appointment**

#### **1. Sign Up** (`/signup`)
- **Page**: `src/app/signup/page.tsx`
- **Action**: `src/app/signup/actions.ts` - `signUp()` server action
- **Creates**:
  - `User` with `role: "CLIENT"`, email, name, phone
  - Hashed password
- **Redirects**: To `/login` or `/post-login`

#### **2. Login** (`/login`)
- **Auth**: NextAuth (`src/lib/auth.ts`)
- **Session**: Stored with `role` field
- **Redirects**: Role-based via `/post-login`

#### **3. Book Appointment** (`/booking`)
- **Form**: `BookingForm.tsx` (client component)
- **API**: `POST /api/bookings`
- **Flow**:
  1. User selects plan (Standard/Deluxe/Trial)
  2. Selects barber (fetches from `/api/barbers`)
  3. Selects date (shows mini calendar with availability)
  4. Selects time (fetches from `/api/availability?barberId=...&date=...`)
  5. Fills customer info
  6. Submits → `POST /api/bookings`
- **API Handler** (`src/app/api/bookings/route.ts`):
  - Validates session (must be CLIENT)
  - Finds/creates client by email
  - Finds barber by ID
  - Validates date/time not in past
  - Checks for conflicts (unique constraints prevent double-booking)
  - Creates `Appointment` record:
    - `clientId`, `barberId`, `type`, `startAt`, `endAt`, `status: "BOOKED"`
    - `isFree: true` for trial plans
    - `address` for HOME appointments
  - If not trial: deducts points via `PointsLedger`
  - Sends email with calendar invite (Resend)
  - Broadcasts Pusher event ("booking.created")
  - Returns success + ICS URL
- **UI Feedback**: Shows success message, "Booking confirmed!"

#### **4. See Appointment** ❌ **MISSING**
- **Current**: No client-facing page shows "My Appointments"
- **Account Page** (`/account`): Shows points, subscription, password — but NO appointments
- **Expected**: Should show upcoming + past appointments with status

---

### **Barber Flow: Login → Set Availability → See Bookings**

#### **1. Login** (`/barber/login`)
- **Auth**: NextAuth with role check
- **Middleware**: Protects `/barber/*` routes (requires BARBER or OWNER role)

#### **2. Set Availability** (`/barber`)
- **Component**: `WeeklyAvailabilityForm.tsx`
- **Action**: `src/app/barber/actions.ts` - `saveBarberAvailability()`
- **Flow**:
  1. Barber sets weekly ranges (e.g., Monday 10:00-14:00, Wednesday 09:00-17:00)
  2. Submits → `saveBarberAvailability()` server action
  3. Deletes old ranges for barber, creates new ones
  4. Uses `BarberAvailability` model (weekly recurring)
- **Data**: Stored in `BarberAvailability` table (dayOfWeek, startTime, endTime)

#### **3. See Bookings** ⚠️ **PARTIALLY IMPLEMENTED**
- **Component**: `RealtimeBookingsPanel.tsx`
- **Current Behavior**:
  - Shows real-time booking events via Pusher
  - Displays last 10 events in a feed
  - Shows: appointmentId, date/time, type (SHOP/HOME), isFree flag
- **Missing**:
  - No persistent list of "My Appointments" (today + next 7 days)
  - No query to `Appointment` model by `barberId`
  - No display of client info, notes, status
  - No actions (confirm, complete, cancel)

---

### **Availability & Slot Generation**

#### **How Slots Are Generated**
1. **Weekly Availability** (`BarberAvailability` model):
   - Barber sets ranges like "Monday 10:00-14:00"
   - Stored as `dayOfWeek` (0-6), `startTime`, `endTime`

2. **Slot Generation** (`src/lib/availability.ts`):
   - `getAvailableSlotsForDate(barberId, date)`:
     - Gets `dayOfWeek` from date
     - Queries `BarberAvailability` for that day
     - Generates 30-minute slots from ranges
     - Queries `Appointment` for conflicts (same barber, same date, status BOOKED/CONFIRMED)
     - Excludes booked slots
     - Returns available slots in 12-hour format

3. **API** (`/api/availability`):
   - `GET /api/availability?barberId=...&date=...`
   - Returns `{ availableSlots: [...] }`

---

### **Points & Plans**

#### **Points System**
- **Model**: `PointsLedger` (transaction log)
- **Fields**: `userId`, `delta` (+/-), `reason`, `refType`, `refId`, `createdAt`
- **Balance**: Aggregated via `prisma.pointsLedger.aggregate({ _sum: { delta } })`

#### **Plans** (`src/config/plans.ts`):
- **Standard**: $39.99/month (SHOP, 2 cuts)
- **Deluxe**: $60/month (HOME, 2 cuts)
- **Trial**: $0/month (FREE, isFree: true)

#### **Booking Points Logic**:
- **Trial Plans**: `isFree: true`, no points deducted
- **Paid Plans**: Points deducted via `debit()` helper (creates `PointsLedger` entry)
- **API**: `POST /api/bookings` checks `isFreeTestCut()` before deducting

---

## 🔗 **4. Broken / Missing Links**

### **Client Dashboard → Appointments**

**Area**: Client Account Page (`/account`)

**Intended Behavior**:
- Show "My Appointments" section with:
  - Upcoming appointments (next 7 days)
  - Past appointments (last 30 days)
  - Status badges (BOOKED, CONFIRMED, COMPLETED, CANCELED)
  - Actions: View details, Cancel, Reschedule

**Current Behavior**:
- Only shows:
  - Points balance
  - Subscription section
  - Password management
- **NO appointments displayed**

**Cause**: 
- No query to `Appointment` model by `clientId`
- No component to render appointments list
- No API route for client appointments

**Files Affected**:
- `src/app/account/page.tsx` - Needs appointment query + display

---

### **Barber Dashboard → Upcoming Bookings**

**Area**: Barber Dashboard (`/barber`)

**Intended Behavior**:
- Show "My Appointments" section with:
  - Today's appointments
  - Next 7 days appointments
  - Client info (name, email, phone)
  - Status (BOOKED → CONFIRMED → COMPLETED)
  - Actions: Confirm, Complete, Cancel, View notes

**Current Behavior**:
- `RealtimeBookingsPanel.tsx` shows real-time events only:
  - Last 10 booking events from Pusher
  - No persistent list from database
  - No client info, notes, or status
  - No actions

**Cause**:
- `RealtimeBookingsPanel` only subscribes to Pusher events
- No query to `Appointment` model by `barberId`
- No component to render persistent appointment list
- No API route for barber appointments (except `/api/bookings?barberId=...` which returns all active bookings)

**Files Affected**:
- `src/app/barber/page.tsx` - Needs appointment query + display
- `src/app/api/bookings/route.ts` - Has GET handler but returns all active bookings (not filtered by logged-in barber)

---

### **Appointment Status Management**

**Area**: Appointment lifecycle

**Intended Behavior**:
- Status transitions: BOOKED → CONFIRMED → COMPLETED
- UI shows status badges/indicators
- Actions to change status (barber confirms, completes)
- Client sees status updates

**Current Behavior**:
- Status enum exists (`BOOKED | CONFIRMED | COMPLETED | NO_SHOW | CANCELED`)
- Defaults to `BOOKED` on creation
- No UI to change status
- No status display in client/barber views
- Only admin can cancel (`/admin/appointments`)

**Cause**:
- No API routes for status updates (except admin cancel)
- No UI components for status management
- Status is stored but not used in views

---

### **Appointment Display Components**

**Area**: Reusable appointment components

**Intended Behavior**:
- Shared `<AppointmentCard>` component
- `<AppointmentList>` component with filtering
- Consistent styling across client/barber/admin views

**Current Behavior**:
- No shared components
- Each view (admin, barber real-time) has custom rendering
- Inconsistent styling

**Cause**:
- No component library for appointments
- Each feature built separately

---

### **Empty States**

**Area**: Client & Barber dashboards

**Intended Behavior**:
- Show friendly empty states:
  - Client: "No upcoming appointments. [Book Now]"
  - Barber: "No bookings today. Check your availability settings."
- Guide users on next steps

**Current Behavior**:
- No empty states (because no appointment lists exist)
- Missing guidance

**Cause**:
- Appointment views don't exist yet

---

### **Inconsistencies**

**Area**: Appointment query patterns

**Issues**:
1. **Admin Appointments** (`/admin/appointments`):
   - Queries `Appointment` model correctly
   - Shows all upcoming appointments
   - ✅ Works

2. **GET /api/bookings**:
   - Returns all active appointments (optionally filtered by `barberId`)
   - Not filtered by logged-in user (anyone can query)
   - Used by admin, but not by client/barber

3. **Client Appointments**:
   - No API route to query by `clientId`
   - Account page doesn't query appointments

4. **Barber Appointments**:
   - `RealtimeBookingsPanel` only shows Pusher events
   - No persistent query by `barberId`
   - No API route for barber's own appointments

**Root Cause**:
- Appointment queries are not scoped to logged-in user
- Missing API routes for client/barber-specific queries
- No components to display appointments in client/barber dashboards

---

## 🎨 **5. UX Gaps (Compared to IG/DoorDash/Uber Style Apps)**

### **Feedback & State**

#### **Booking Confirmation**
✅ **Works**: Shows "Booking confirmed!" message after booking  
❌ **Missing**: 
- No link to "View Appointment" or "My Appointments"
- No calendar integration reminder
- No email confirmation preview

#### **Appointment Status Updates**
❌ **Missing**:
- Client doesn't see status changes (BOOKED → CONFIRMED)
- No notifications when barber confirms/completes
- No real-time updates (except Pusher events for barbers)

---

### **Dashboards**

#### **Client Dashboard** (`/account`)
❌ **Missing**:
- "My Appointments" section (upcoming + past)
- Appointment cards with:
  - Date/time
  - Barber name/photo
  - Status badge
  - Location (SHOP/HOME)
  - Actions (Cancel, Reschedule)
- Empty state: "No appointments. [Book Now]"
- Upcoming vs Past tabs/filters

#### **Barber Dashboard** (`/barber`)
⚠️ **Partial**:
- Has real-time booking events (Pusher feed)
- ❌ Missing:
  - Persistent "My Appointments" list (today + next 7 days)
  - Today's schedule view
  - Client info display (name, phone, notes)
  - Status management (Confirm, Complete buttons)
  - Calendar view
  - Empty state

---

### **Lifecycle & Status**

#### **Appointment Statuses**
✅ **Defined**: `BOOKED | CONFIRMED | COMPLETED | NO_SHOW | CANCELED`  
❌ **Missing**:
- UI to change status (barber confirms, completes)
- Status display in appointment cards
- Status-based filtering (show only BOOKED, etc.)
- Status transition notifications

#### **Empty States**
❌ **Missing**:
- Client: "No upcoming appointments. [Browse Plans] [Book Now]"
- Barber: "No bookings today. [Set Availability] [View Calendar]"
- Clear CTAs to next actions

#### **Appointment Details**
❌ **Missing**:
- Detail view/modal for appointment:
  - Full client info (name, email, phone)
  - Notes/special requests
  - Address (for HOME appointments)
  - Status history
  - Actions (Confirm, Complete, Cancel, Reschedule)

---

### **Real-Time Features**

✅ **Works**: Pusher real-time events for barbers (`RealtimeBookingsPanel`)  
❌ **Missing**:
- Client-side real-time updates (status changes)
- Browser notifications
- In-app notifications/badges

---

## 📊 **6. API Routes Summary**

### **Appointment APIs**
- `POST /api/bookings` - Create appointment ✅ (works)
- `GET /api/bookings` - Get appointments ⚠️ (returns all active, not user-scoped)
- `GET /api/bookings/ics/[id]` - Download ICS file ✅

**Missing**:
- `GET /api/appointments/me` - Client's own appointments
- `GET /api/appointments/barber/me` - Barber's own appointments
- `PATCH /api/appointments/[id]/status` - Update status (confirm, complete)
- `DELETE /api/appointments/[id]` - Cancel appointment (client)

### **Availability APIs**
- `GET /api/availability` - Get available slots ✅
- `GET /api/barber/weekly-availability` - Get weekly summary ✅
- `GET /api/barber/next-openings` - Get next openings ✅

### **User APIs**
- `GET /api/me` - Current user info ✅
- `GET /api/me/points` - Points balance ✅

**Missing**:
- `GET /api/me/appointments` - Client appointments
- `GET /api/barber/appointments` - Barber appointments

---

## 🎯 **7. Prioritized Fix/Feature List**

### **P1: Critical Missing Features**

#### **P1.1: Client Dashboard - My Appointments**
- **What**: Add appointments section to `/account` page
- **Files**: `src/app/account/page.tsx`
- **API**: Create `GET /api/appointments/me` (or use existing with clientId filter)
- **Components**: Create `AppointmentCard`, `AppointmentList`
- **Shows**: Upcoming (next 7 days) + Past (last 30 days)
- **Actions**: View details, Cancel

#### **P1.2: Barber Dashboard - My Appointments**
- **What**: Add persistent appointment list to `/barber` page
- **Files**: `src/app/barber/page.tsx`
- **API**: Create `GET /api/appointments/barber/me` (filter by logged-in barber)
- **Components**: Reuse `AppointmentCard`, `AppointmentList`
- **Shows**: Today + Next 7 days
- **Actions**: Confirm, Complete, View client info

#### **P1.3: Appointment Status Management**
- **What**: UI to change appointment status
- **API**: `PATCH /api/appointments/[id]/status`
- **Components**: Status badge, Status update buttons
- **Flows**:
  - Barber: BOOKED → CONFIRMED → COMPLETED
  - Client: Cancel (BOOKED → CANCELED)

---

### **P2: UX Improvements**

#### **P2.1: Appointment Detail View**
- **What**: Modal/page showing full appointment details
- **Shows**: Client info, notes, address, status history
- **Actions**: Status updates, Cancel, Reschedule

#### **P2.2: Empty States**
- **What**: Friendly empty states for client/barber dashboards
- **Components**: `EmptyState` component with CTA buttons

#### **P2.3: Status Display & Badges**
- **What**: Visual status indicators in appointment cards
- **Components**: `<StatusBadge>` with color coding
- **States**: BOOKED (gray), CONFIRMED (blue), COMPLETED (green), CANCELED (red)

#### **P2.4: Booking Confirmation Enhancement**
- **What**: Add "View Appointment" link after booking
- **Redirect**: To `/account` appointments section

---

### **P3: Nice-to-Have Features**

#### **P3.1: Real-Time Status Updates**
- **What**: Client-side Pusher updates for appointment status changes
- **Components**: In-app notifications, status badges update live

#### **P3.2: Appointment Filtering & Search**
- **What**: Filter by status, date range, barber (client view)
- **UI**: Tabs/filters in appointment list

#### **P3.3: Calendar View**
- **What**: Calendar grid view for barber appointments
- **Components**: Month/week view with appointment markers

#### **P3.4: Appointment Notifications**
- **What**: Email/SMS notifications for status changes
- **Integration**: Resend (email), Twilio (SMS) - already in codebase

---

## 📝 **Summary**

### **What Works**
✅ Booking creation (`POST /api/bookings`)  
✅ Weekly availability system (`BarberAvailability` model)  
✅ Slot generation based on availability + conflicts  
✅ Points system (`PointsLedger` model)  
✅ Admin appointments view  
✅ Real-time booking events (Pusher for barbers)  
✅ Authentication & role-based access

### **What's Missing**
❌ Client appointments display (`/account` page)  
❌ Barber appointments display (`/barber` dashboard - persistent list)  
❌ Status management UI (confirm, complete, cancel)  
❌ Appointment detail view  
❌ Empty states  
❌ Status badges/indicators  
❌ User-scoped appointment API routes

### **What's Partially Implemented**
⚠️ `RealtimeBookingsPanel` - Shows events but not persistent appointments  
⚠️ `GET /api/bookings` - Returns all active, not user-scoped  
⚠️ Status enum - Defined but not used in UI

### **Next Steps**
1. **P1.1**: Client appointments on `/account` page
2. **P1.2**: Barber appointments on `/barber` page
3. **P1.3**: Status management API + UI
4. **P2**: Polish with empty states, status badges, detail view

---

**End of Functionality Map**



