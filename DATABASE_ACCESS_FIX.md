# 🔧 Database Access Fix - Complete Solution

## Problem Confirmed

✅ **Test script works** - CLI can access database  
❌ **Browser login fails** - Dev server cannot access database  
**Error**: `Error code 14: Unable to open the database file`

## Root Cause

SQLite database is **locked** or **path misconfigured** when accessed from Next.js dev server context.

## Complete Fix Steps

### Step 1: Close Everything
```powershell
# Close Prisma Studio (if open)
# Stop dev server (Ctrl+C)
```

### Step 2: Remove Lock Files
```powershell
cd web

# Remove SQLite lock files (if they exist)
Remove-Item prisma/dev.db-journal -ErrorAction SilentlyContinue
Remove-Item prisma/dev.db-wal -ErrorAction SilentlyContinue
Remove-Item prisma/dev.db-shm -ErrorAction SilentlyContinue
```

### Step 3: Verify DATABASE_URL
Check `web/.env.local`:
```env
DATABASE_URL="file:./prisma/dev.db"
```

**Important**: Use **relative path** (`file:./prisma/dev.db`), not absolute path!

❌ **Wrong**: `DATABASE_URL="file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db"`  
✅ **Correct**: `DATABASE_URL="file:./prisma/dev.db"`

### Step 4: Regenerate Prisma Client
```powershell
cd web
pnpm prisma generate
```

### Step 5: Push Database Schema
```powershell
cd web
pnpm prisma db push
```

### Step 6: Restart Dev Server
```powershell
cd web
pnpm dev
```

### Step 7: Test Login
1. Go to `http://localhost:3000/login`
2. Email: `hussemuya.hm.hm@gmail.com`
3. Password: `LaFadeOwner123`
4. Watch terminal for `[auth] verifyCredentials: SUCCESS`

## Automated Fix Script

I've created a script that does all of this automatically:

```powershell
cd web
.\scripts\fix-database-access.ps1
```

This script will:
- ✅ Remove lock files
- ✅ Verify/update DATABASE_URL
- ✅ Check database file exists
- ✅ Stop processes that might lock DB
- ✅ Regenerate Prisma Client
- ✅ Push database schema

## Manual Verification

### Check DATABASE_URL
```powershell
cd web
Get-Content .env.local | Select-String DATABASE_URL
```

Should show: `DATABASE_URL="file:./prisma/dev.db"`

### Check Database File
```powershell
cd web
Test-Path prisma/dev.db
```

Should return: `True`

### Check for Lock Files
```powershell
cd web
Test-Path prisma/dev.db-journal
Test-Path prisma/dev.db-wal
```

Both should return: `False` (no lock files)

## Why This Happens

1. **SQLite Lock**: Only one process can write to SQLite at a time
2. **Prisma Studio**: Keeps database locked while open
3. **Path Issues**: Absolute paths can break when Next.js resolves paths differently
4. **Lock Files**: SQLite creates `.db-journal` or `.db-wal` files that can linger

## Prevention

1. **Always close Prisma Studio** before running dev server
2. **Use relative paths** in DATABASE_URL (`file:./prisma/dev.db`)
3. **Stop dev server** before opening Prisma Studio
4. **Don't run multiple scripts** that access database simultaneously

## Expected Behavior After Fix

### Test Script
```powershell
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```
**Expected**: `🎉 ALL TESTS PASSED!`

### Browser Login
1. Go to `http://localhost:3000/login`
2. Enter credentials
3. **Terminal logs**:
   ```
   [auth] authorize() called { hasEmail: true, hasPassword: true, ... }
   [auth] verifyCredentials: starting verification
   [auth] findUserByEmailInsensitive: matched DB email
   [auth] verifyCredentials: SUCCESS
   [auth] authorize() SUCCESS: returning user
   ```
4. **Browser**: Should redirect and log in successfully

## Troubleshooting

### Still Getting "Error code 14"

1. **Check if Prisma Studio is open**:
   ```powershell
   Get-Process -Name "node" -ErrorAction SilentlyContinue
   ```
   Close any Prisma Studio processes

2. **Check if dev server is running**:
   Stop it completely (Ctrl+C), wait 2-3 seconds

3. **Verify DATABASE_URL is relative**:
   Should be `file:./prisma/dev.db`, not absolute path

4. **Remove all lock files**:
   ```powershell
   Remove-Item prisma/dev.db-* -ErrorAction SilentlyContinue
   ```

5. **Regenerate and restart**:
   ```powershell
   pnpm prisma generate
   pnpm prisma db push
   pnpm dev
   ```

### Database File Missing

If `prisma/dev.db` doesn't exist:
```powershell
cd web
pnpm prisma db push
```

This will create the database file.

## Summary

✅ **Close Prisma Studio**  
✅ **Use relative path** in DATABASE_URL (`file:./prisma/dev.db`)  
✅ **Remove lock files** (if they exist)  
✅ **Regenerate Prisma Client** (`pnpm prisma generate`)  
✅ **Push schema** (`pnpm prisma db push`)  
✅ **Restart dev server** (`pnpm dev`)  

**The login code is correct - it's just a database access issue!** 🔓




