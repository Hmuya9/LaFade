# Debugging 401 Unauthorized Error

## What 401 Means

A **401 Unauthorized** error from `api/auth/callback/credentials` means:
- The `authorize()` function in `auth-options.ts` returned `null`
- NextAuth treats this as "invalid credentials"

## Where to Look

### ❌ Browser Console (What you're seeing)
- Shows: `401 (Unauthorized)` from `api/auth/callback/credentials`
- This is just the result, not the cause

### ✅ Dev Server Terminal (What you need)
- Shows: `[auth]` prefixed logs with the actual reason
- This tells you WHY it failed

## Check Dev Server Logs

Look in your terminal where `pnpm dev` is running. You should see logs like:

**If user not found:**
```
[auth] credentials login attempt: hussemuya.hm.hm@gmail.com
[auth] user not found or no passwordHash
```

**If passwordHash missing:**
```
[auth] credentials login attempt: hussemuya.hm.hm@gmail.com
[auth] user not found or no passwordHash
```

**If password wrong:**
```
[auth] credentials login attempt: hussemuya.hm.hm@gmail.com
[auth] DB user: { id: '...', role: '...', passwordHashLength: 60 }
[auth] compare input: { inputPassword: '...', isValid: false }
[auth] password valid: false
```

## Quick Test

Run this to see exactly what's failing:

```powershell
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```

This will show you:
1. ✅/❌ User found?
2. ✅/❌ passwordHash exists?
3. ✅/❌ Password matches?

## Common Causes

### 1. User Not Found
**Symptom:** `[auth] user not found or no passwordHash`

**Fix:**
- Check email casing in Prisma Studio
- Run: `pnpm tsx scripts/list-users.ts` (close Prisma Studio first)
- Use exact email from database

### 2. No passwordHash
**Symptom:** `[auth] user not found or no passwordHash`

**Fix:**
- Generate hash: `pnpm hash:generate LaFadeOwner123`
- In Prisma Studio → User table → scroll RIGHT → passwordHash column
- Paste hash (exactly 60 chars, no quotes, no spaces)

### 3. Password Doesn't Match
**Symptom:** `[auth] password valid: false`

**Fix:**
- Regenerate hash: `pnpm hash:generate LaFadeOwner123`
- Make sure hash is exactly 60 characters
- No trailing dot, no spaces
- Update in Prisma Studio

### 4. Hash Length Wrong
**Symptom:** `passwordHashLength: 61` (should be 60)

**Fix:**
- Hash has extra character (usually trailing dot)
- Remove trailing dot in Prisma Studio
- Should be exactly 60 characters

## Step-by-Step Fix

1. **Check dev server terminal** for `[auth]` logs
2. **Run test script** to see what fails
3. **Fix the issue** based on test output
4. **Try login again** in browser

## What Success Looks Like

**Dev Server Terminal:**
```
[auth] credentials login attempt: hussemuya.hm.hm@gmail.com
[auth] Found user with different casing: Hussemuya.hm.hm@gmail.com
[auth] DB user: { id: '...', email: '...', role: 'OWNER', passwordHashLength: 60 }
[auth] compare input: { inputPassword: 'LaFadeOwner123', isValid: true }
[auth] password valid: true
```

**Browser:**
- ✅ No 401 error
- ✅ Redirects to `/post-login`
- ✅ Then redirects based on role

## Next Steps

1. **Check dev server terminal** - look for `[auth]` logs
2. **Run test script** - `pnpm tsx scripts/test-full-login.ts`
3. **Share the output** - I can help fix the specific issue




