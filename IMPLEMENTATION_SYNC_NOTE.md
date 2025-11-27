# Barber Availability & Client Booking — Implementation Sync Note

**Date:** 2025-01-XX  
**Status:** ✅ Complete  
**Ready for:** Migration & Testing

---

## Quick Summary

Implemented a complete weekly availability system for barbers and updated client booking to use real-time slot generation from weekly ranges. All code is type-safe, role-protected, and backward-compatible.

---

## Files Touched

### Schema
- `web/prisma/schema.prisma` — Added `BarberAvailability` model, relation to `User`

### New Files
- `web/src/app/barber/actions.ts` — Server actions for saving/getting weekly availability
- `web/src/app/barber/_components/WeeklyAvailabilityForm.tsx` — UI component for barber to set weekly hours
- `web/src/lib/availability.ts` — Helper functions for slot generation from ranges
- `web/src/app/api/barbers/route.ts` — API endpoint to fetch all barbers

### Modified Files
- `web/src/app/signup/actions.ts` — Added comment about CLIENT role default
- `web/src/app/barber/page.tsx` — Added WeeklyAvailabilityForm component
- `web/src/app/api/availability/route.ts` — **Major refactor**: Uses weekly ranges instead of date-specific slots
- `web/src/app/booking/_components/BookingForm.tsx` — Fetches barbers dynamically, uses barberId
- `web/src/app/api/bookings/route.ts` — Updated to use barberId (with legacy fallback)

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

### Updated: `User` model
- Added relation: `weeklyAvailability BarberAvailability[] @relation("BarberAvailability")`

---

## Behavior Changes

### 1. Signup & Roles
- ✅ New signups explicitly set `role: "CLIENT"` (with comment explaining BARBER/OWNER are manual)
- ✅ No public "become a barber" UI (as requested)

### 2. Barber Availability
**Before:** Date-specific slots (one slot = one date + one time)  
**After:** Weekly ranges (e.g., Monday 10:00–14:00, 16:00–19:00)

**How it works:**
1. Barber logs in → `/barber` dashboard
2. Sees "Weekly Availability" card
3. For each day, adds/removes time ranges
4. Clicks "Save Availability" → replaces all existing availability atomically
5. Stored in `BarberAvailability` table

### 3. Client Booking
**Before:** Hardcoded barber name, pre-created slots  
**After:** Dynamic barber selection, real-time slot generation

**How it works:**
1. Client goes to `/booking`
2. Sees list of barbers (fetched from `/api/barbers`)
3. Selects barber + date
4. API generates slots from barber's weekly ranges for that day of week
5. Excludes slots that conflict with existing `Appointment` records
6. Returns available slots in 12-hour format (e.g., "10:00 AM")
7. Client books → creates `Appointment` record
8. Future queries automatically exclude this appointment

---

## How to Test

### 1. Make Someone a Barber
```bash
# Option A: Prisma Studio
cd web
pnpm prisma studio
# → User table → Edit role to "BARBER"

# Option B: Seed script
# Update web/prisma/seed.ts to create barber users
```

### 2. Set Weekly Availability (as Barber)
1. Log in as barber → `/barber`
2. Scroll to "Weekly Availability" card
3. For each day, click "Add Range"
4. Set start/end times (e.g., 09:00–17:00)
5. Click "Save Availability"
6. Verify success message

**Verify in DB:**
```bash
pnpm prisma studio
# → BarberAvailability table → Should see rows with barberId, dayOfWeek, startTime, endTime
```

### 3. Book Appointment (as Client)
1. Log in as client → `/booking`
2. Select barber from dropdown
3. Select date
4. See available time slots (generated from weekly ranges)
5. Select time slot
6. Fill form → Submit
7. Verify success

**Verify in DB:**
```bash
pnpm prisma studio
# → Appointment table → Should see new appointment
# → Try booking same slot again → Should be excluded from availability
```

---

## Migration Steps

```bash
cd web

# 1. Generate migration
pnpm prisma migrate dev --name add_barber_availability

# 2. Generate Prisma client (if needed)
pnpm prisma generate

# 3. Restart dev server
pnpm dev
```

---

## Assumptions / TODOs

### Timezone
- **Current:** All times in UTC
- **TODO:** Consider per-barber timezone support

### Slot Duration
- **Fixed:** 30 minutes per appointment
- **TODO:** Make configurable per barber

### Known Limitations
1. No rescheduling UI (must be done manually in DB)
2. No recurring exceptions (holidays, special dates)
3. Legacy `Availability` model still exists (not deleted, not used)
4. Single timezone assumption

---

## Code Quality

- ✅ Type-safe (TypeScript)
- ✅ Role-protected (`requireRole()`)
- ✅ Error handling (try/catch, clear messages)
- ✅ Validation (time ranges, dayOfWeek)
- ✅ Atomic updates (transaction for availability save)
- ✅ Backward compatible (supports both barberId and barberName)
- ✅ Consistent styling (shadcn/ui components)

---

## Next Steps

1. **Run migration:** `pnpm prisma migrate dev --name add_barber_availability`
2. **Test the flow:**
   - Make a user a barber
   - Set weekly availability
   - Book an appointment as client
   - Verify slots are generated correctly
3. **Optional cleanup:** Remove legacy `Availability` model if not needed elsewhere

---

## Questions / Issues?

- Check `web/BARBER_AVAILABILITY_IMPLEMENTATION.md` for detailed documentation
- Check `web/src/lib/availability.ts` for slot generation logic
- Check `web/src/app/barber/actions.ts` for server action implementation




