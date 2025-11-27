# ⚡ Quick Database Lock Fix

## The Problem

Your database file exists (`web/prisma/dev.db`) and DATABASE_URL is correct (`"file:./prisma/dev.db"`), but it's **locked by another process**.

## Immediate Fix (3 Steps)

### 1. Close Everything
```powershell
# Close Prisma Studio (if open)
# Stop dev server (Ctrl+C in terminal)
```

### 2. Wait 2-3 Seconds
Let file locks release.

### 3. Restart Dev Server
```powershell
cd web
pnpm dev
```

## Verify It's Fixed

Try logging in again. You should see logs like:
```
[auth] verifyCredentials: starting verification
[auth] findUserByEmailInsensitive: matched DB email
[auth] verifyCredentials: SUCCESS
```

## If Still Locked

Run the diagnostic script:
```powershell
cd web
.\scripts\fix-database-lock.ps1
```

Or manually recreate:
```powershell
cd web
# Stop everything first!
pnpm prisma db push
pnpm dev
```

## Why This Happens

SQLite only allows **one process** to access the database at a time. If Prisma Studio or dev server has it open, the auth code can't read users → `authorize()` returns `null` → 401 error.

**The login code is correct - it's just a file lock issue!** 🔓




