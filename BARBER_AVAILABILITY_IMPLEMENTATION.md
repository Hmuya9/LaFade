# Barber Availability & Client Booking Implementation

## Summary

Implemented a complete end-to-end flow for barber weekly availability and client booking, replacing the legacy date-specific slot system with a flexible weekly range system.

---

## Files Touched

### Schema Changes
- **`web/prisma/schema.prisma`**
  - Added `BarberAvailability` model for weekly availability ranges
  - Added relation to `User` model
  - Kept legacy `Availability` model for backward compatibility

### New Files
- **`web/src/app/barber/actions.ts`** (NEW)
  - Server actions: `saveBarberAvailability()`, `getBarberAvailability()`
  - Role-based access control (BARBER/OWNER only)
  - Validation for time ranges and dayOfWeek

- **`web/src/app/barber/_components/WeeklyAvailabilityForm.tsx`** (NEW)
  - Client component for setting weekly availability
  - UI: Day-by-day time range management
  - Add/remove ranges per day
  - Real-time save with error handling

- **`web/src/lib/availability.ts`** (NEW)
  - Helper functions for slot generation from weekly ranges
  - `getAvailableSlotsForDate()`: Main function to get available slots
  - Excludes booked appointments automatically
  - Time format conversion (24-hour ↔ 12-hour)

- **`web/src/app/api/barbers/route.ts`** (NEW)
  - API endpoint to fetch all barbers (for client booking page)
  - Returns users with role BARBER or OWNER

### Modified Files
- **`web/src/app/signup/actions.ts`**
  - Added comment clarifying that new signups are CLIENT by default
  - Note: BARBER and OWNER roles are set manually

- **`web/src/app/barber/page.tsx`**
  - Added `WeeklyAvailabilityForm` component
  - Integrated into barber dashboard

- **`web/src/app/api/availability/route.ts`**
  - **Major refactor**: Now uses `BarberAvailability` model instead of legacy `Availability`
  - Supports both `barberId` (preferred) and `barberName` (legacy)
  - Generates slots from weekly ranges using `getAvailableSlotsForDate()`
  - Automatically excludes booked appointments

- **`web/src/app/booking/_components/BookingForm.tsx`**
  - Fetches barbers from `/api/barbers` instead of hardcoded list
  - Uses `barberId` instead of `barberName` for availability queries
  - Dynamic barber selection UI

- **`web/src/app/api/bookings/route.ts`**
  - Updated to accept `barberId` (with legacy `barberName` fallback)
  - Removed legacy availability marking logic
  - Uses Appointment model for conflict detection

---

## Schema Changes

### New Model: `BarberAvailability`

```prisma
model BarberAvailability {
  id        String   @id @default(cuid())
  barberId  String
  dayOfWeek Int      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime String   // "10:00" (24-hour format)
  endTime   String   // "14:00" (24-hour format)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  barber    User     @relation("BarberAvailability", fields: [barberId], references: [id], onDelete: Cascade)

  @@unique([barberId, dayOfWeek, startTime, endTime])
  @@index([barberId, dayOfWeek])
}
```

### Updated Model: `User`

```prisma
model User {
  // ... existing fields ...
  weeklyAvailability BarberAvailability[] @relation("BarberAvailability")
}
```

---

## Behavior Changes

### 1. Signup & Roles

**Before:**
- Signup created users with `role: "CLIENT"` (implicit via schema default)

**After:**
- Signup explicitly sets `role: "CLIENT"` with a comment explaining that BARBER and OWNER are set manually
- No public UI for becoming a barber (as requested)

### 2. Barber Availability

**Before:**
- Barbers added individual date-specific slots via `/api/barber/availability`
- Each slot was a single date + time combination
- Stored in `Availability` model with `barberName`, `date`, `timeSlot`, `isBooked`

**After:**
- Barbers set **weekly availability ranges** via `/barber` dashboard
- Example: Monday 10:00–14:00, 16:00–19:00
- Stored in `BarberAvailability` model with `dayOfWeek`, `startTime`, `endTime`
- Multiple ranges per day supported
- UI: Clean form with day-by-day range management

**How it works:**
1. Barber logs in → goes to `/barber`
2. Sees "Weekly Availability" card
3. For each day, can add/remove time ranges
4. Clicks "Save Availability" → calls `saveBarberAvailability()` server action
5. All existing availability for that barber is replaced atomically

### 3. Client Booking

**Before:**
- Client booking used hardcoded barber name or `BARBER_NAME` env var
- Availability came from legacy `Availability` table (date-specific slots)
- Slots were pre-created by barber

**After:**
- Client booking fetches barbers dynamically from `/api/barbers`
- Shows dropdown/list of all barbers (role = BARBER or OWNER)
- Availability is **generated on-the-fly** from weekly ranges:
  1. Client selects barber + date
  2. API calculates `dayOfWeek` for that date
  3. Queries `BarberAvailability` for that barber + dayOfWeek
  4. Generates 30-minute slots from ranges
  5. Excludes slots that conflict with existing `Appointment` records
  6. Returns available slots in 12-hour format (e.g., "10:00 AM")

**How it works:**
1. Client goes to `/booking`
2. Sees list of barbers (fetched from DB)
3. Selects a barber
4. Selects a date
5. Sees available time slots (generated from barber's weekly ranges, minus booked appointments)
6. Selects a time slot
7. Submits booking → creates `Appointment` record
8. Future availability queries automatically exclude this appointment

---

## How to Test

### As Admin/Dev: Make Someone a Barber

1. Open Prisma Studio: `cd web && pnpm prisma studio`
2. Go to `User` table
3. Find the user you want to make a barber
4. Edit the `role` field: change from `CLIENT` to `BARBER` (or `OWNER`)
5. Save changes

**Alternative (via seed script):**
- Update `web/prisma/seed.ts` to create barber users with `role: "BARBER"`

### As Barber: Set Weekly Hours

1. Log in as a barber (role = BARBER or OWNER)
2. Navigate to `/barber`
3. Scroll to "Weekly Availability" card
4. For each day:
   - Click "Add Range"
   - Set start time (e.g., "09:00")
   - Set end time (e.g., "17:00")
   - Add multiple ranges if needed (e.g., 09:00–12:00, 14:00–17:00)
5. Click "Save Availability"
6. Verify success message appears

**Verify it's saved:**
- Check Prisma Studio → `BarberAvailability` table
- Should see rows with `barberId`, `dayOfWeek`, `startTime`, `endTime`

### As Client: Book an Appointment

1. Log in as a client (or sign up → automatically becomes CLIENT)
2. Navigate to `/booking`
3. **Barber Selection:**
   - Should see dropdown/list of barbers (fetched from DB)
   - Select a barber
4. **Date Selection:**
   - Select a date (must be in the future)
5. **Time Slots:**
   - Should see available time slots based on:
     - Barber's weekly availability for that day of week
     - Excluding already-booked appointments
   - Slots are in 12-hour format (e.g., "10:00 AM", "2:00 PM")
6. **Select a time slot**
7. Fill in customer info (name, email, phone)
8. Select plan (standard/deluxe/trial)
9. Click "Confirm Booking"
10. Verify success message

**Verify booking:**
- Check Prisma Studio → `Appointment` table
- Should see new appointment with `clientId`, `barberId`, `startAt`, `endAt`
- Try booking the same slot again → should be excluded from availability

---

## Assumptions / TODOs

### Timezone Assumptions
- **Current**: All times are stored and processed in UTC
- **Date selection**: Client selects date in local timezone, converted to UTC for storage
- **Time slots**: Generated in UTC, displayed in 12-hour format
- **TODO**: Consider adding timezone support per barber or per location

### Slot Duration
- **Fixed**: 30 minutes per appointment
- **TODO**: Make slot duration configurable per barber or per appointment type

### Known Limitations

1. **No rescheduling UI yet**
   - Clients can't reschedule appointments via UI
   - Barbers can't reschedule via UI
   - Must be done manually in DB or via future feature

2. **No recurring availability exceptions**
   - Can't set "closed on holidays" or "special hours on specific dates"
   - Must manually adjust availability

3. **Legacy Availability model still exists**
   - `Availability` model (date-specific slots) is kept for backward compatibility
   - Not used by new system, but not deleted
   - Can be removed in future cleanup

4. **No barber selection in legacy flows**
   - Some parts of the app may still use `BARBER_NAME` env var
   - New booking flow uses dynamic barber selection

5. **Single timezone assumption**
   - All times are UTC
   - No per-barber timezone support yet

---

## Migration Steps

To apply these changes:

1. **Generate Prisma migration:**
   ```bash
   cd web
   pnpm prisma migrate dev --name add_barber_availability
   ```

2. **Generate Prisma client:**
   ```bash
   pnpm prisma generate
   ```

3. **Restart dev server:**
   ```bash
   pnpm dev
   ```

4. **Test the flow:**
   - Make a user a barber (via Prisma Studio)
   - Set weekly availability as barber
   - Book an appointment as client
   - Verify slots are generated correctly

---

## Code Quality Notes

- ✅ Type-safe: All functions use TypeScript with proper types
- ✅ Error handling: Try/catch blocks with clear error messages
- ✅ Role-based access: `requireRole()` ensures only BARBER/OWNER can set availability
- ✅ Validation: Time ranges validated (start < end, valid format)
- ✅ Atomic updates: Availability saved in transaction (delete all + create new)
- ✅ Backward compatible: API supports both `barberId` and `barberName`
- ✅ Consistent styling: Uses shadcn/ui components matching existing design

---

## Future Enhancements (Not Implemented)

- [ ] Rescheduling UI for clients and barbers
- [ ] Recurring availability exceptions (holidays, special dates)
- [ ] Per-barber timezone support
- [ ] Configurable slot duration per barber
- [ ] Availability templates (e.g., "Standard Week", "Weekend Only")
- [ ] Public "become a barber" signup flow
- [ ] Barber availability calendar view
- [ ] Client booking calendar view with multiple barbers




