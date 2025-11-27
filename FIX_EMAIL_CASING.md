# Fix Email Casing Issue - Complete Solution

## ✅ Problem Identified

- **Test script passes** (has case-insensitive lookup)
- **Browser login fails** (401 error)
- **Root cause**: Email casing mismatch
  - DB has: `Hussemuya.hm.hm@gmail.com` (capital H)
  - Code searches: `hussemuya.hm.hm@gmail.com` (lowercase)
  - SQLite `findUnique` is case-sensitive → user not found → 401

## ✅ Fix Applied

### 1. Updated `authorize()` Function

The `authorize()` function in `auth-options.ts` now:
- ✅ Tries exact lowercase match first (fast path)
- ✅ Falls back to case-insensitive search if not found
- ✅ Works with SQLite (no `mode: "insensitive"` needed)
- ✅ Logs when it finds user with different casing

### 2. Created Email Normalization Script

Run this to normalize ALL emails in database to lowercase:

```powershell
cd web
# Close Prisma Studio first!
pnpm normalize:emails
```

This will:
- Find all users
- Normalize emails to lowercase
- Update database
- Show what was changed

## 🚀 Two Ways to Fix (Choose One)

### Option A: Quick Fix (Manual - 2 minutes)

1. **Open Prisma Studio**: `pnpm prisma studio`
2. **Go to User table**
3. **Find your user** (Hussemuya...)
4. **Click email cell** → Change to: `hussemuya.hm.hm@gmail.com` (all lowercase)
5. **Click "Save changes"**
6. **Try login again**

### Option B: Permanent Fix (Automated - 1 minute)

1. **Close Prisma Studio** (database must be unlocked)
2. **Run normalization script**:
   ```powershell
   cd web
   pnpm normalize:emails
   ```
3. **Try login again**

**Option B is recommended** - it fixes all users at once and prevents future issues.

## ✅ Test It

After fixing (either option):

1. **Try login in browser**: `http://localhost:3000/login`
2. **Enter credentials**
3. **Should work now!**

**Check dev terminal** - you should see:
```
[auth] credentials login attempt: hussemuya.hm.hm@gmail.com
[auth] Found user with different casing: Hussemuya.hm.hm@gmail.com
[auth] DB user: { id: '...', role: 'OWNER', passwordHashLength: 60 }
[auth] password valid: true
```

## 🔒 Prevent Future Issues

### 1. Normalize on Signup

The signup action already normalizes emails:
```typescript
const email = String(formData.get("email") || "").trim().toLowerCase();
```

✅ This is correct - new signups will have lowercase emails.

### 2. Normalize Existing Emails

Run the normalization script to fix existing users:
```powershell
pnpm normalize:emails
```

### 3. Add Validation (Optional)

Add email validation to prevent mixed-case emails:
```typescript
// In signup/email validation
if (email !== email.toLowerCase()) {
  // Warn or auto-normalize
}
```

## 📋 Summary

**What was wrong:**
- Email in DB: `Hussemuya.hm.hm@gmail.com` (capital H)
- Code searches: `hussemuya.hm.hm@gmail.com` (lowercase)
- SQLite case-sensitive lookup → user not found → 401

**What we fixed:**
- ✅ Added case-insensitive fallback in `authorize()`
- ✅ Created email normalization script
- ✅ Signup already normalizes emails

**What to do now:**
1. Run: `pnpm normalize:emails` (close Prisma Studio first)
2. Try login again
3. Should work!

---

**The authorize() function now handles both lowercase and mixed-case emails, so login should work regardless of how the email is stored in the database.**




