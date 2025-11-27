# 🔒 Database Lock Fix - Complete Guide

## Problem

**Error**: `Error code 14: Unable to open the database file`

This means SQLite cannot access the database file because it's locked by another process.

## Root Cause

SQLite allows only **one process** to write to the database at a time. Common causes:

1. **Prisma Studio is open** - It locks the database file
2. **Dev server is running** - May have the DB locked
3. **Another script/process** - Accessing the database

## Quick Fix Steps

### Step 1: Close Prisma Studio
If you have Prisma Studio open (`pnpm prisma studio`), **close it completely**:
- Close the browser window
- Press `Ctrl+C` in the terminal running Prisma Studio

### Step 2: Stop Dev Server
Stop the dev server (if running):
- Press `Ctrl+C` in the terminal running `pnpm dev`

### Step 3: Wait 2-3 Seconds
Let file locks release completely.

### Step 4: Verify Database File
```powershell
cd web
Test-Path prisma/dev.db
# Should return: True
```

### Step 5: Verify DATABASE_URL
```powershell
cd web
Get-Content .env.local | Select-String DATABASE_URL
# Should show: DATABASE_URL="file:./prisma/dev.db"
```

### Step 6: Recreate Database (if needed)
```powershell
cd web
pnpm prisma db push
```

### Step 7: Restart Dev Server
```powershell
cd web
pnpm dev
```

## Automated Fix Script

I've created a diagnostic script:

```powershell
cd web
.\scripts\fix-database-lock.ps1
```

This script will:
- ✅ Check if database file exists
- ✅ Verify DATABASE_URL configuration
- ✅ Detect Prisma Studio processes
- ✅ Detect Node.js processes (dev server)
- ✅ Optionally recreate the database

## Manual Verification

### Check Database File Exists
```powershell
cd web
Test-Path prisma/dev.db
```

### Check DATABASE_URL
```powershell
cd web
Get-Content .env.local | Select-String DATABASE_URL
```

Should be:
```env
DATABASE_URL="file:./prisma/dev.db"
```

### Check for Locking Processes
```powershell
# Check for Prisma Studio
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*prisma studio*" }

# Check for Node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue
```

## If Database File is Missing

If `prisma/dev.db` doesn't exist:

```powershell
cd web

# 1. Push schema to create database
pnpm prisma db push

# 2. Generate Prisma client
pnpm prisma generate

# 3. Seed database (if you have seed script)
pnpm prisma:seed
# Or manually add your user in Prisma Studio
```

## If Database is Corrupted

If the database file exists but seems corrupted:

```powershell
cd web

# 1. Backup (optional)
Copy-Item prisma/dev.db prisma/dev.db.backup

# 2. Delete corrupted file
Remove-Item prisma/dev.db

# 3. Recreate
pnpm prisma db push

# 4. Re-seed data
# Add your user back with password hash
```

## Verify User Exists

After fixing the database lock, verify your user exists:

```powershell
cd web

# Open Prisma Studio
pnpm prisma studio
```

Check the `User` table:
- ✅ Email: `hussemuya.hm.hm@gmail.com` (any casing)
- ✅ `passwordHash`: 60 characters, starts with `$2b$`
- ✅ Role: `OWNER`

## Expected Behavior After Fix

Once the database is accessible:

1. **Test script should work**:
   ```powershell
   cd web
   pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
   ```

2. **Browser login should work**:
   - Go to `http://localhost:3000/login`
   - Enter credentials
   - Should see success logs in terminal

## Terminal Logs (After Fix)

When login works, you'll see:
```
[auth] authorize() called { hasEmail: true, hasPassword: true, ... }
[auth] verifyCredentials: starting verification { email: 'hussemuya.hm.hm@gmail.com', ... }
[auth] findUserByEmailInsensitive: looking for hussemuya.hm.hm@gmail.com
[auth] findUserByEmailInsensitive: checked 3 users
[auth] findUserByEmailInsensitive: matched DB email Hussemuya.hm.hm@gmail.com
[auth] verifyCredentials: SUCCESS { userId: '...', email: '...', role: 'OWNER' }
[auth] authorize() SUCCESS: returning user
```

## Prevention

To prevent database locks:

1. **Always close Prisma Studio** before running dev server
2. **Stop dev server** before opening Prisma Studio
3. **Don't run multiple scripts** that access the database simultaneously
4. **Use `pnpm prisma db push`** instead of migrations for development

## Summary

✅ **Database file exists**: `web/prisma/dev.db`  
✅ **DATABASE_URL configured**: `"file:./prisma/dev.db"`  
⚠️ **Issue**: Database is locked by another process  

**Fix**: Close Prisma Studio, stop dev server, wait 2-3 seconds, restart dev server.

The login code is correct - it's just a database access issue! 🔓




