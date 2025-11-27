# 🔒 Database Lock Issue - Login Fix

## Problem

The error `Error code 14: Unable to open the database file` means the SQLite database is locked by another process.

## Common Causes

1. **Prisma Studio is open** - It locks the database file
2. **Dev server is running** - It may have the DB locked
3. **Another process** - Script or tool accessing the DB

## Solution

### Step 1: Close Prisma Studio
If you have Prisma Studio open (`pnpm prisma studio`), **close it completely**.

### Step 2: Check Dev Server
Make sure your dev server is running with the correct `DATABASE_URL`.

### Step 3: Verify Database File Location

Check your `web/.env.local`:
```env
DATABASE_URL="file:./prisma/dev.db"
```

Or if using the root:
```env
DATABASE_URL="file:./dev.db"
```

### Step 4: Restart Everything

1. **Stop dev server** (Ctrl+C)
2. **Close Prisma Studio** (if open)
3. **Wait 2-3 seconds** (let file locks release)
4. **Start dev server again**:
   ```powershell
   cd web
   pnpm dev
   ```

### Step 5: Test Login

1. Go to `http://localhost:3000/login`
2. Enter credentials
3. **Watch the terminal** - you should see:
   ```
   [auth] authorize() called with missing credentials  ← Only if missing
   [auth] verifyCredentials: starting verification for ...
   [auth] findUserByEmailInsensitive: looking for ...
   [auth] findUserByEmailInsensitive: checked X users
   [auth] findUserByEmailInsensitive: matched DB email ...
   [auth] verifyPassword: result true
   [auth] verifyCredentials: SUCCESS
   ```

## If Still Not Working

### Check Database File Exists

```powershell
cd web
# Check if file exists
Test-Path prisma/dev.db
# Or
Test-Path dev.db
```

### Check DATABASE_URL in .env.local

```powershell
cd web
Get-Content .env.local | Select-String DATABASE_URL
```

Should show:
```
DATABASE_URL="file:./prisma/dev.db"
```

### Verify User Exists in Database

1. **Close dev server and Prisma Studio**
2. **Open Prisma Studio**:
   ```powershell
   cd web
   pnpm prisma studio
   ```
3. **Check User table** - verify your user exists with:
   - Email: `hussemuya.hm.hm@gmail.com` (any casing)
   - `passwordHash` field is set (60 characters, starts with `$2b$`)
   - Role: `OWNER`

4. **Close Prisma Studio** before starting dev server

## Quick Fix Script

Run this to check everything:

```powershell
cd web

# 1. Check DATABASE_URL
Write-Host "Checking DATABASE_URL..."
Get-Content .env.local | Select-String DATABASE_URL

# 2. Check if DB file exists
$dbPath = "prisma/dev.db"
if (Test-Path $dbPath) {
    Write-Host "✅ Database file exists: $dbPath"
} else {
    Write-Host "❌ Database file NOT found: $dbPath"
    Write-Host "Run: pnpm prisma db push"
}

# 3. Check for locked file (can't directly check, but you can try)
Write-Host "`n⚠️  Make sure Prisma Studio is CLOSED"
Write-Host "⚠️  Make sure dev server is STOPPED"
Write-Host "`nThen restart dev server: pnpm dev"
```

## Expected Behavior

When login works, you'll see in terminal:
```
[auth] verifyCredentials: starting verification for hussemuya.hm.hm@gmail.com
[auth] findUserByEmailInsensitive: looking for hussemuya.hm.hm@gmail.com
[auth] findUserByEmailInsensitive: checked 3 users
[auth] findUserByEmailInsensitive: matched DB email Hussemuya.hm.hm@gmail.com
[auth] verifyPassword: result true
[auth] verifyCredentials: SUCCESS { userId: '...', email: '...', role: 'OWNER' }
```

If you see "NO MATCH" or "password mismatch", that's a different issue (data problem, not lock).

## Summary

**Most likely fix**: Close Prisma Studio, restart dev server, try login again.

The database lock prevents the auth code from reading users, so `authorize()` returns `null` → 401 error → "Invalid email or password".




