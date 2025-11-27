# BarberAvailability P2021 Fix - Implementation Summary

## ✅ **IMPLEMENTATION COMPLETE**

All fixes have been implemented to eliminate P2021 errors and ensure the BarberAvailability table is properly accessible.

---

## 📋 **What Was Fixed**

### 1. **Schema & Migrations Verified** ✅
- Confirmed `BarberAvailability` model in `schema.prisma` matches migration
- Migration `20251123111417_add_barber_availability_table` creates table correctly
- Schema includes all required fields, indexes, and foreign keys

### 2. **Database Path Made Unambiguous** ⚠️ **ACTION REQUIRED**

**IMPORTANT:** You must manually update `.env` because it's git-ignored:

**Change this line in `web/.env`:**
```bash
# OLD (relative path):
DATABASE_URL="file:./prisma/dev.db"

# NEW (absolute path):
DATABASE_URL="file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db"
```

**Verify `.env.local` does NOT set DATABASE_URL:**
- Should have comment: `# DATABASE_URL - removed to use .env value instead`
- ✅ Already confirmed correct

### 3. **Runtime Self-Check Added** ✅

**File:** `src/lib/db.ts`

Added `devCheckDatabaseTables()` function that:
- Runs on startup (development only)
- Queries SQLite `sqlite_master` to list all tables
- Logs: `[db][devcheck] SQLite tables: User, Appointment, BarberAvailability, ...`
- Logs: `[db][devcheck] BarberAvailability present: true/false`
- Warns if table is missing (includes DB path)

### 4. **P2021 Auto-Recovery Added** ✅

**File:** `src/app/barber/actions.ts`

Added two helper functions:

1. **`ensureBarberAvailabilityTable()``**:
   - Creates table if missing (dev mode only)
   - Creates indexes and constraints
   - Uses SQLite `CREATE TABLE IF NOT EXISTS`

2. **`withBarberAvailabilityRecovery()`**:
   - Wraps database operations
   - Detects P2021 errors for BarberAvailability
   - Auto-creates table and retries operation
   - Logs: `[barber][auto-recover] Created BarberAvailability table on the fly after P2021. Retrying...`

**Applied to:**
- `saveBarberAvailability()` - wrapped transaction in recovery
- `getBarberAvailability()` - wrapped findMany in recovery

### 5. **Weekly Header UX Improved** ✅

**File:** `src/app/barber/_components/WeeklyAvailabilityForm.tsx`

Enhanced header:
- Responsive layout (stacks on mobile, side-by-side on desktop)
- Added helper text: "Hours repeat weekly" (subtle gray, italic)
- Right-aligned on desktop, left-aligned on mobile
- Improved spacing and visual hierarchy

---

## 🚀 **Next Steps (YOU MUST DO)**

### Step 1: Update `.env` File

Edit `web/.env` and change:
```bash
DATABASE_URL="file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db"
```

### Step 2: Stop Dev Server

**CRITICAL:** Stop the Next.js dev server completely:
```powershell
# Press CTRL+C in the terminal where pnpm dev is running
# Or kill the process if needed
```

### Step 3: Clear Build Cache

```powershell
cd "C:\dev\La Fade\h\LeFade\web"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

### Step 4: Regenerate Prisma Client

```powershell
pnpm prisma generate
```

### Step 5: Restart Dev Server

```powershell
pnpm dev
```

### Step 6: Verify Fix

**Check server logs for:**

1. **Database check:**
   ```
   [db][devcheck] SQLite tables: Account, Appointment, Availability, BarberAvailability, ...
   [db][devcheck] BarberAvailability present: true
   ```

2. **No P2021 errors** when visiting `/barber`

3. **Test saving availability:**
   - Go to `/barber`
   - Set Friday 09:00-17:00
   - Click "Save Availability"
   - Should see: `[barber][saveAvailability] Successfully saved availability`
   - No red error banner

4. **Test fetching availability:**
   - Page should load without errors
   - Should see: `[barber][getAvailability] Loaded availability: { rangesCount: ... }`

---

## 🔍 **How It Works**

### Problem
Next.js dev server was using a cached Prisma client that didn't include BarberAvailability, even though:
- Table exists in database
- Migrations were applied
- Prisma Studio shows the table

### Solution
1. **Absolute DB path** - Eliminates path resolution differences
2. **Runtime self-check** - Detects table missing on startup
3. **Auto-recovery** - Creates table on-the-fly if P2021 detected
4. **Clean cache** - Forces Next.js to use fresh Prisma client

### Recovery Flow
```
User tries to save availability
  ↓
P2021 error detected (table missing)
  ↓
Auto-recovery creates table (dev only)
  ↓
Operation retries
  ↓
Success! ✅
```

---

## 📊 **Verification Checklist**

- [ ] `.env` updated with absolute path
- [ ] `.env.local` does NOT set DATABASE_URL
- [ ] Dev server stopped
- [ ] `.next` cache deleted
- [ ] Prisma client regenerated
- [ ] Dev server restarted
- [ ] Server logs show `[db][devcheck] BarberAvailability present: true`
- [ ] No P2021 errors in logs
- [ ] Can save availability without errors
- [ ] Can fetch availability without errors
- [ ] Weekly header shows "Week of [date] – [date]" with "Hours repeat weekly" helper text

---

## 🐛 **If Still Getting P2021**

1. **Check server logs:**
   ```
   [db][devcheck] SQLite tables: ...
   [db][devcheck] BarberAvailability present: false
   ```

2. **Verify database path:**
   - Check `[db] Normalized DATABASE_URL:` log
   - Confirm file exists: `fileExists: true`

3. **Run manual check:**
   ```powershell
   pnpm tsx scripts/check-barber-availability-table.ts
   ```

4. **If table still missing:**
   ```powershell
   pnpm prisma migrate reset
   pnpm prisma generate
   ```

5. **Force table creation (dev only):**
   - The auto-recovery should create it automatically
   - Or run: `pnpm prisma db push`

---

## 📝 **Files Modified**

1. `src/lib/db.ts` - Added runtime self-check
2. `src/app/barber/actions.ts` - Added P2021 auto-recovery
3. `src/app/barber/_components/WeeklyAvailabilityForm.tsx` - Improved header UX

---

## ✅ **Expected Behavior After Fix**

1. **On server startup:**
   - Logs: `[db][devcheck] SQLite tables: ... BarberAvailability ...`
   - Logs: `[db][devcheck] BarberAvailability present: true`

2. **When visiting `/barber`:**
   - No P2021 errors
   - Weekly Availability card loads successfully
   - Header shows: "Week of [date] – [date] / Hours repeat weekly"

3. **When saving availability:**
   - Logs: `[barber][saveAvailability] Deleted existing ranges: X`
   - Logs: `[barber][saveAvailability] Created new ranges: Y`
   - Success message appears
   - No red error banner

4. **When fetching availability:**
   - Logs: `[barber][getAvailability] Loaded availability: { rangesCount: X }`
   - Form pre-fills with saved ranges

---

## 🎯 **Summary**

All code changes are complete. The fix includes:
- ✅ Runtime database table verification
- ✅ Automatic table creation on P2021 errors (dev only)
- ✅ Improved error handling and logging
- ✅ Enhanced UX for weekly header

**You just need to:**
1. Update `.env` with absolute path
2. Stop dev server
3. Clear `.next` cache
4. Regenerate Prisma client
5. Restart dev server

The P2021 error should be completely eliminated! 🎉



