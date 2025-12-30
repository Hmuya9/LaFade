# Timezone Bug Fix - Root Cause & Solution

## Problem

Client books 9:00 AM (America/Los_Angeles) but UI shows 1:00 AM.

## Root Cause Analysis

### Issue 1: Buggy `parseLocalDateTimeToUTC` Function
**File:** `web/src/lib/time-utils.ts` (lines 49-99)

**Problem:**
- Used complex manual offset calculation based on a reference date at noon UTC
- Offset calculation was incorrect: `utcHour = hour24 - offsetHours` should be `hour24 + offsetHours` (when offset is negative)
- Doesn't properly handle DST transitions (PST vs PDT)
- The reference date approach is fragile and error-prone

**Example of bug:**
- Input: "2025-01-15", "9:00 AM" (9am LA time)
- Expected UTC: `2025-01-15T17:00:00.000Z` (9am PST = 5pm UTC)
- Actual (buggy): Calculated wrong offset, resulting in incorrect UTC time

### Issue 2: `TimeRangeClient` Uses Browser Timezone
**File:** `web/src/components/TimeRangeClient.tsx`

**Problem:**
- Uses `format()` from `date-fns` which formats in browser's local timezone
- Should format in business timezone (America/Los_Angeles)
- If user is in a different timezone, times display incorrectly

**Example:**
- UTC stored: `2025-01-15T17:00:00.000Z` (9am LA time)
- User in EST: Browser shows 12:00 PM (wrong - should show 9:00 AM LA time)

## Solution

### Fix 1: Replace `parseLocalDateTimeToUTC` with Proper Implementation

**Before:**
```typescript
// Complex manual offset calculation (buggy)
const referenceUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
const offsetHours = laHour - 12;
const utcHour = hour24 - offsetHours; // BUG: Should be +
```

**After:**
```typescript
// Use date-fns-tz's fromZonedTime (correct, handles DST)
const localDate = new Date(year, month - 1, day, hour24, minute, 0, 0);
return fromZonedTime(localDate, BUSINESS_TIMEZONE);
```

**Why this works:**
- `fromZonedTime` properly handles DST transitions
- Correctly converts LA time to UTC regardless of system timezone
- No manual offset calculations needed

### Fix 2: Fix `TimeRangeClient` to Use Business Timezone

**Before:**
```typescript
// Uses browser's local timezone (wrong)
const timeText = format(start, timeFormat);
```

**After:**
```typescript
// Uses business timezone (correct)
const timeText = formatInTimeZone(start, BUSINESS_TIMEZONE, timeFormat);
```

**Why this works:**
- All appointments are in America/Los_Angeles timezone
- Users should see LA time, not their local timezone
- Consistent display across all users

## Database Schema

**Current:** Prisma `DateTime` maps to PostgreSQL `timestamp` (without timezone)

**Status:** ✅ **No migration needed**
- Prisma handles timezone conversion correctly when storing UTC ISO strings
- As long as we always store UTC, `timestamp` vs `timestamptz` doesn't matter for our use case
- Prisma's `DateTime` type stores as UTC internally

**Note:** If we wanted to be more explicit, we could use `@db.Timestamptz`, but it's not necessary for correctness.

## Files Changed

1. **`web/src/lib/time-utils.ts`**
   - Fixed `parseLocalDateTimeToUTC` to use `fromZonedTime`
   - Removed buggy manual offset calculation

2. **`web/src/components/TimeRangeClient.tsx`**
   - Changed from `format()` to `formatInTimeZone()` with `BUSINESS_TIMEZONE`
   - Updated comments to reflect business timezone usage

## Test Checklist

### Test 1: Basic Conversion (9am PT → UTC → 9am PT)
1. Book appointment for "2025-01-15", "9:00 AM"
2. **Check database:** `startAt` should be `2025-01-15T17:00:00.000Z` (or equivalent UTC)
   - 9am PST = UTC-8, so 9am + 8 hours = 5pm UTC ✓
3. **Check UI:** Should display "9:00 AM" (not 1:00 AM or any other time)

### Test 2: DST Edge Case - Spring Forward (March)
1. Book appointment for "2025-03-09", "9:00 AM" (daylight saving starts)
2. **Check database:** Should store correct UTC accounting for PDT (UTC-7)
   - 9am PDT = UTC-7, so 9am + 7 hours = 4pm UTC ✓
3. **Check UI:** Should display "9:00 AM"

### Test 3: DST Edge Case - Fall Back (November)
1. Book appointment for "2025-11-02", "9:00 AM" (daylight saving ends)
2. **Check database:** Should store correct UTC accounting for PST (UTC-8)
   - 9am PST = UTC-8, so 9am + 8 hours = 5pm UTC ✓
3. **Check UI:** Should display "9:00 AM"

### Test 4: After Stripe Redirect
1. Complete booking/payment flow
2. Get redirected to `/account?justBooked=1`
3. **Check UI:** Appointment time should display correctly as "9:00 AM"

### Test 5: Different User Timezones
1. User in EST (UTC-5) books 9:00 AM appointment
2. **Check UI:** Should still show "9:00 AM" (LA time), not "12:00 PM" (EST time)

## Code Diffs

### `web/src/lib/time-utils.ts`

```diff
export function parseLocalDateTimeToUTC(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [time, period] = timeStr.split(" ");
  const [hh, mm] = time.split(":");
  let hour24 = parseInt(hh, 10);
  if (period === "PM" && hour24 !== 12) hour24 += 12;
  if (period === "AM" && hour24 === 12) hour24 = 0;
  
- // Complex manual offset calculation (buggy)
- const referenceUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
- const formatter = new Intl.DateTimeFormat('en-US', {
-   timeZone: BUSINESS_TIMEZONE,
-   hour: '2-digit',
-   minute: '2-digit',
-   hour12: false
- });
- const laTimeAtNoonUTC = formatter.format(referenceUTC);
- const [laHour, laMinute] = laTimeAtNoonUTC.split(':').map(Number);
- const offsetHours = laHour - 12;
- const utcHour = hour24 - offsetHours; // BUG: Wrong calculation
- // ... day rollover logic ...
- return new Date(Date.UTC(year, month - 1, finalDay, finalHour, parseInt(mm ?? "0", 10), 0));
+ // Use date-fns-tz's fromZonedTime (correct, handles DST)
+ const localDate = new Date(year, month - 1, day, hour24, parseInt(mm ?? "0", 10), 0, 0);
+ return fromZonedTime(localDate, BUSINESS_TIMEZONE);
}
```

### `web/src/components/TimeRangeClient.tsx`

```diff
-import { format } from "date-fns";
+import { formatInTimeZone } from "date-fns-tz";
+import { BUSINESS_TIMEZONE } from "@/lib/time-utils";

-    // Format dates in user's local timezone (browser automatically handles conversion)
-    // date-fns format() automatically uses the browser's local timezone
-    const dateText = showDate ? format(start, dateFormat) : null;
+    // Format dates in business timezone (America/Los_Angeles)
+    // All appointments are displayed in LA time, not user's local timezone
+    const dateText = showDate ? formatInTimeZone(start, BUSINESS_TIMEZONE, dateFormat) : null;
    
-    const timeText = (timeFormat && timeFormat !== "") 
-      ? `${format(start, timeFormat)} – ${format(end, timeFormat)}`
+    const timeText = (timeFormat && timeFormat !== "") 
+      ? `${formatInTimeZone(start, BUSINESS_TIMEZONE, timeFormat)} – ${formatInTimeZone(end, BUSINESS_TIMEZONE, timeFormat)}`
       : null;
```

## Expected Behavior After Fix

### Booking Flow
1. User selects "2025-01-15", "9:00 AM" in booking form
2. `parseLocalDateTimeToUTC("2025-01-15", "9:00 AM")` converts to UTC
3. Server stores: `2025-01-15T17:00:00.000Z` in database
4. UI displays: `formatInBusinessTimeZone(utcDate, "h:mm a")` → "9:00 AM" ✓

### DST Handling
- **March (PST → PDT):** Automatically handles spring forward
- **November (PDT → PST):** Automatically handles fall back
- No manual offset calculations needed

## Verification

After deploying:
1. Book a test appointment for 9:00 AM
2. Check database: `SELECT "startAt" FROM "Appointment" ORDER BY "createdAt" DESC LIMIT 1;`
3. Verify UTC time is correct (9am PST = 17:00 UTC, 9am PDT = 16:00 UTC)
4. Check UI displays "9:00 AM"

## Production Safety

- ✅ No schema changes required
- ✅ No breaking API changes
- ✅ Backward compatible (existing appointments still work)
- ✅ Uses existing `date-fns-tz` library (no new dependencies)
- ✅ Minimal code changes (only 2 files)

