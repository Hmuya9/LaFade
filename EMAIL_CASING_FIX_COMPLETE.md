# ✅ Email Casing Fix - Complete

## What Was Fixed

### 1. `authorize()` Function in `auth-options.ts`

**Before:**
- Only tried exact lowercase match
- Failed if email in DB had different casing
- Returned `null` → 401 error

**After:**
- ✅ Tries exact lowercase match first (fast path)
- ✅ Falls back to case-insensitive search
- ✅ Works with SQLite (uses `contains` + filter)
- ✅ Logs when it finds user with different casing

**Code:**
```typescript
// 1️⃣ Try exact lowercase match first
let user = await prisma.user.findUnique({
  where: { email: normalizedEmail },
});

// 2️⃣ Fallback: case-insensitive search
if (!user) {
  const emailPrefix = normalizedEmail.split("@")[0];
  const users = await prisma.user.findMany({
    where: {
      email: { contains: emailPrefix },
    },
  });
  user = users.find(u => u.email?.toLowerCase() === normalizedEmail) || null;
}
```

### 2. Email Normalization Script

Created `scripts/normalize-emails.ts` to:
- Find all users with mixed-case emails
- Normalize them to lowercase
- Update database
- Prevent future issues

## 🚀 How to Fix Right Now

### Option A: Restart Dev Server (Required)

**The code is fixed, but Next.js needs to reload it:**

1. **Stop dev server**: Press `Ctrl+C` in terminal where `pnpm dev` is running
2. **Start again**: `pnpm dev`
3. **Try login**: Should work now!

The `authorize()` function now has case-insensitive lookup, so it will find `Hussemuya.hm.hm@gmail.com` even when searching for `hussemuya.hm.hm@gmail.com`.

### Option B: Normalize Emails (Recommended)

**To prevent this issue permanently:**

1. **Close Prisma Studio** (database must be unlocked)
2. **Run normalization**:
   ```powershell
   cd web
   pnpm normalize:emails
   ```
3. **Restart dev server**: `pnpm dev`
4. **Try login**: Should work!

This normalizes all emails to lowercase, so the fast path (exact match) will work.

## ✅ What Should Happen Now

### After Restarting Dev Server:

1. **Try login** at `http://localhost:3000/login`
2. **Enter credentials**:
   - Email: `hussemuya.hm.hm@gmail.com` (or any casing)
   - Password: `LaFadeOwner123`

3. **Check dev terminal** - you should see:
   ```
   [auth] credentials login attempt: hussemuya.hm.hm@gmail.com
   [auth] exact match not found, trying case-insensitive search
   [auth] Found user with different casing: Hussemuya.hm.hm@gmail.com
   [auth] DB user: { id: '...', role: 'OWNER', passwordHashLength: 60 }
   [auth] password valid: true
   ```

4. **Result**: ✅ Login succeeds, redirects to `/post-login`, then to `/admin` (for OWNER)

## 🔍 Why This Works

**The Problem:**
- DB email: `Hussemuya.hm.hm@gmail.com` (capital H)
- Code searches: `hussemuya.hm.hm@gmail.com` (lowercase)
- SQLite `findUnique` is case-sensitive → `null` → 401

**The Solution:**
- First try: Exact lowercase match (fast, works for normalized emails)
- Fallback: Search by email prefix (`hussemuya`), then filter case-insensitively
- Result: Finds user regardless of casing → login works

## 📋 Next Steps

1. **Restart dev server** (required for code changes to take effect)
2. **Try login** - should work now
3. **Optional**: Run `pnpm normalize:emails` to fix all emails permanently

## 🎯 Success Indicators

- ✅ No 401 error
- ✅ Login succeeds
- ✅ Redirects to correct page based on role
- ✅ Dev terminal shows `password valid: true`
- ✅ Session contains role

---

**The code fix is complete. Just restart your dev server and try logging in!**




