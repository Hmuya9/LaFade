# Comprehensive Login Issue Analysis & Action Plan

## 🔍 Current Issue: 401 Unauthorized on Login

### What's Happening

When you try to log in at `http://localhost:3000/login`, you get:
- **Browser Console**: `401 (Unauthorized)` from `api/auth/callback/credentials`
- **Login Form**: "Invalid email or password" error message
- **Result**: Login fails, user cannot authenticate

### Root Cause Analysis

The 401 error means NextAuth's `authorize()` function in `auth-options.ts` is returning `null`. This happens when ANY of these conditions are true:

1. ❌ User not found in database
2. ❌ User found but `passwordHash` is `null` or empty
3. ❌ Password comparison fails (hash doesn't match password)
4. ❌ Email lookup fails due to case sensitivity

---

## 🔬 Deep Dive: What Could Be Wrong

### Issue #1: Email Lookup Failure (Case Sensitivity)

**Problem:**
- SQLite is case-sensitive for string comparisons
- Email in DB: `Hussemuya.hm.hm@gmail.com` (capital H)
- Code searches for: `hussemuya.hm.hm@gmail.com` (lowercase)
- `findUnique({ where: { email } })` might not find it

**Current Fix:**
- We added case-insensitive fallback search
- But if the email format is different, it still might fail

**Potential Future Issues:**
- If email has extra spaces: `" Hussemuya.hm.hm@gmail.com "`
- If email has different casing in multiple places
- If email was stored with special characters

**What I Need:**
- Exact email as stored in Prisma Studio (copy-paste it)
- Output from: `pnpm tsx scripts/list-users.ts` (shows all emails)

---

### Issue #2: PasswordHash Missing or Invalid

**Problem:**
- `passwordHash` field is `null` or empty
- Hash exists but has wrong format
- Hash has extra characters (trailing dot, spaces)

**Current State:**
- Hash should be exactly 60 characters
- Format: `$2b$10$...` (starts with `$2b$10$`)
- No trailing dots, no spaces

**Potential Future Issues:**
- Hash copied with trailing newline
- Hash copied with quotes around it
- Hash truncated (less than 60 chars)
- Hash has extra characters (more than 60 chars)

**What I Need:**
- Screenshot of `passwordHash` field in Prisma Studio (blur some chars for security)
- Output showing hash length: `passwordHashLength: XX`
- The actual hash value (first 10 and last 5 characters)

---

### Issue #3: Password Mismatch

**Problem:**
- Hash was generated with different password
- Hash was generated with different salt rounds
- Hash is for a different password entirely

**Current State:**
- We use `bcryptjs.compare(password, user.passwordHash)`
- This should work if hash matches password

**Potential Future Issues:**
- User changed password but hash wasn't updated
- Hash was generated with wrong password
- Multiple hashes exist and wrong one was copied

**What I Need:**
- The exact password you're typing in the login form
- The password that was used to generate the hash
- Confirmation they match

---

### Issue #4: Database Connection Issues

**Problem:**
- Prisma can't connect to database
- Database file is locked (Prisma Studio open)
- Wrong DATABASE_URL path

**Current State:**
- Database at: `web/prisma/dev.db`
- DATABASE_URL should be: `file:./prisma/dev.db` (relative to `web/`)

**Potential Future Issues:**
- Prisma Studio locks database file
- Multiple Prisma instances trying to access same DB
- Database file permissions issue
- Database file corrupted

**What I Need:**
- Is Prisma Studio currently open? (Close it before testing)
- DATABASE_URL value from `.env.local`
- Error messages from dev server terminal

---

## 🛠️ What We've Fixed So Far

### ✅ Fixed: Case-Insensitive Email Lookup
- Added fallback search if exact match fails
- Searches by email prefix, then filters case-insensitively

### ✅ Fixed: Defensive JWT/Session Callbacks
- Added try/catch blocks
- Default role to "CLIENT" if missing
- Always return token/session (never crash)

### ✅ Fixed: Enhanced Logging
- Logs user lookup attempts
- Logs passwordHash length
- Logs password comparison results

### ⚠️ Still Need: Actual Data Verification
- Need to verify email exists in DB
- Need to verify passwordHash is correct
- Need to verify password matches hash

---

## 📋 Information I Need From You

### Critical Information (Required)

1. **Dev Server Terminal Output**
   ```
   When you try to login, what do you see in the terminal where `pnpm dev` is running?
   
   Look for lines starting with [auth]:
   - [auth] credentials login attempt: ...
   - [auth] user not found or no passwordHash
   - [auth] password valid: true/false
   - [auth] DB user: { ... }
   ```

2. **Test Script Output**
   ```powershell
   cd web
   pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
   ```
   
   Share the complete output - it will show exactly what's failing.

3. **Prisma Studio Data**
   - Open User table
   - Find the user you're trying to log in as
   - Scroll RIGHT to find `passwordHash` column
   - Tell me:
     - Exact email (copy-paste it)
     - passwordHash length (should be 60)
     - First 10 chars of hash: `$2b$10$...`
     - Last 5 chars of hash: `...rWi.` (or whatever)

4. **Environment Variables**
   - What's in `web/.env.local`?
   - Specifically: `DATABASE_URL` value
   - Is `NEXTAUTH_SECRET` set?

### Helpful Information (Optional but Useful)

5. **When Did This Start?**
   - Did login ever work before?
   - What changed recently?
   - Did you just add the passwordHash?

6. **Database State**
   - How many users in database?
   - Which users have passwordHash set?
   - Are there any users that CAN log in?

---

## 🎯 Action Plan to Fix

### Step 1: Gather Diagnostic Information

**Run these commands and share output:**

```powershell
# 1. List all users
cd web
pnpm tsx scripts/list-users.ts

# 2. Test login flow
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123

# 3. Test bcrypt comparison
pnpm tsx scripts/test-bcrypt.ts
# (Edit the script first with your password and hash)
```

**Check these files:**
- `web/.env.local` - Share DATABASE_URL value
- Dev server terminal - Share [auth] logs
- Prisma Studio - Share email and passwordHash info

### Step 2: Identify the Exact Failure Point

Based on the diagnostics, we'll know:
- ✅ User lookup works? (test script will show)
- ✅ passwordHash exists? (test script will show)
- ✅ Password matches? (test script will show)

### Step 3: Apply Targeted Fix

**If user not found:**
- Fix email casing in database
- Or improve case-insensitive lookup

**If passwordHash missing:**
- Generate new hash: `pnpm hash:generate YourPassword`
- Update in Prisma Studio

**If password doesn't match:**
- Regenerate hash with correct password
- Update in Prisma Studio
- Verify hash is exactly 60 characters

### Step 4: Verify Fix

1. Run test script again - should pass all steps
2. Try login in browser - should work
3. Check dev terminal - should show `isValid: true`
4. Verify session has role - check browser console

---

## 🚨 Potential Future Issues & Improvements

### Issue #1: Email Normalization Inconsistency

**Current Problem:**
- Emails stored with different casing in database
- Code normalizes to lowercase but DB might have mixed case
- Case-insensitive lookup is a workaround, not a solution

**Better Solution:**
- Normalize ALL emails to lowercase on signup
- Add database constraint or migration to normalize existing emails
- Store emails as lowercase in database from the start

**Implementation:**
```typescript
// In signup action
const email = String(formData.get("email") || "").trim().toLowerCase();

// In authorize
const email = credentials.email.trim().toLowerCase();

// In signIn callback (email provider)
const email = user.email.toLowerCase();
```

**Action Needed:**
- Add migration to normalize all existing emails to lowercase
- Update all code paths to store emails as lowercase
- Add validation to prevent mixed-case emails

---

### Issue #2: PasswordHash Validation Missing

**Current Problem:**
- No validation that hash is correct format
- No check that hash length is 60
- No verification that hash can be used for comparison

**Better Solution:**
- Add validation function to check hash format
- Validate on signup/update
- Log warnings if hash format is wrong

**Implementation:**
```typescript
function isValidBcryptHash(hash: string | null): boolean {
  if (!hash) return false;
  return hash.length === 60 && hash.startsWith("$2b$10$");
}

// In authorize
if (!isValidBcryptHash(user.passwordHash)) {
  console.error("[auth] Invalid passwordHash format");
  return null;
}
```

**Action Needed:**
- Add hash validation function
- Add validation in authorize()
- Add validation in signup action

---

### Issue #3: Error Messages Not User-Friendly

**Current Problem:**
- All failures show "Invalid email or password"
- User doesn't know if email is wrong or password is wrong
- Makes debugging harder

**Better Solution:**
- Different error messages for different failures
- Log detailed errors server-side
- Show generic error to user (security)

**Implementation:**
```typescript
// In authorize
if (!user) {
  console.log("[auth] User not found:", email);
  return null; // Generic error to user
}

if (!user.passwordHash) {
  console.error("[auth] User has no passwordHash:", email);
  return null; // Generic error to user
}

if (!isValid) {
  console.log("[auth] Password mismatch for:", email);
  return null; // Generic error to user
}
```

**Action Needed:**
- Keep generic error to user (security best practice)
- Improve server-side logging
- Add error codes for internal tracking

---

### Issue #4: No Password Reset Flow Integration

**Current Problem:**
- If user forgets password, they're stuck
- No way to update passwordHash
- No password reset functionality

**Better Solution:**
- Implement password reset flow
- Allow users to set password if they don't have one
- Add "Forgot Password" functionality

**Action Needed:**
- Implement password reset tokens
- Add "Set Password" flow for users without passwordHash
- Add "Change Password" flow for logged-in users

---

### Issue #5: Database Locking Issues

**Current Problem:**
- Prisma Studio locks database file
- Can't run scripts while Studio is open
- Can cause "database locked" errors

**Better Solution:**
- Use connection pooling
- Add retry logic for locked database
- Better error handling

**Action Needed:**
- Add database connection retry logic
- Document that Prisma Studio must be closed
- Consider using PostgreSQL in production (no file locking)

---

### Issue #6: No Integration Tests

**Current Problem:**
- No automated tests for login flow
- Manual testing required
- Easy to break login without noticing

**Better Solution:**
- Add integration tests for login
- Test with different email formats
- Test with different password scenarios

**Action Needed:**
- Write integration tests
- Add to CI/CD pipeline
- Test email normalization
- Test password hashing

---

## 🏗️ Structural Improvements

### Improvement #1: Centralized Auth Utilities

**Current:**
- Auth logic scattered across files
- Email normalization in multiple places
- Hash validation logic missing

**Better:**
```typescript
// src/lib/auth-utils.ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidBcryptHash(hash: string | null): boolean {
  if (!hash) return false;
  return hash.length === 60 && hash.startsWith("$2b$10$");
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  // Case-insensitive lookup logic
}
```

**Action Needed:**
- Create `auth-utils.ts`
- Move email normalization there
- Move user lookup logic there
- Use in all auth-related code

---

### Improvement #2: Better Error Handling

**Current:**
- Generic "Invalid email or password" for all failures
- No distinction between different error types
- Hard to debug

**Better:**
```typescript
// Internal error types (not exposed to user)
enum AuthError {
  USER_NOT_FOUND = "USER_NOT_FOUND",
  NO_PASSWORD_HASH = "NO_PASSWORD_HASH",
  PASSWORD_MISMATCH = "PASSWORD_MISMATCH",
  INVALID_HASH_FORMAT = "INVALID_HASH_FORMAT",
}

// Log specific error, return generic to user
```

**Action Needed:**
- Define error types
- Log specific errors server-side
- Return generic error to user (security)

---

### Improvement #3: Environment Variable Validation

**Current:**
- DATABASE_URL might be wrong
- No validation that env vars are correct
- Silent failures

**Better:**
```typescript
// Validate DATABASE_URL format
if (process.env.DATABASE_URL?.startsWith("file:")) {
  const path = process.env.DATABASE_URL.replace("file:", "");
  if (!fs.existsSync(path)) {
    throw new Error(`Database file not found: ${path}`);
  }
}
```

**Action Needed:**
- Add env var validation on startup
- Check database file exists
- Validate hash format if provided

---

## 📝 Immediate Next Steps

### For You (Right Now):

1. **Run Test Script:**
   ```powershell
   cd web
   pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
   ```
   Share the complete output.

2. **Check Dev Server Terminal:**
   - Try logging in
   - Copy all `[auth]` prefixed logs
   - Share them

3. **Check Prisma Studio:**
   - Open User table
   - Find your user
   - Scroll right to passwordHash
   - Tell me:
     - Exact email
     - passwordHash length
     - First/last few chars of hash

4. **Check .env.local:**
   - Share DATABASE_URL value
   - Share NEXTAUTH_SECRET (just confirm it exists, don't share the value)

### For Me (After You Share Info):

1. Analyze the test output
2. Identify exact failure point
3. Provide targeted fix
4. Implement improvements
5. Verify everything works

---

## 🎯 Success Criteria

Login will be "fixed" when:

- ✅ Test script passes all 6 steps
- ✅ Browser login works (no 401 error)
- ✅ User is redirected correctly based on role
- ✅ Session contains correct role
- ✅ Navbar shows correct links
- ✅ Role-based routes work

---

## 💡 Long-Term Recommendations

1. **Switch to PostgreSQL in Production**
   - No file locking issues
   - Better for concurrent access
   - More reliable

2. **Add Password Reset Flow**
   - Users can reset forgotten passwords
   - Better UX

3. **Add Integration Tests**
   - Prevent regressions
   - Catch issues early

4. **Normalize All Emails**
   - Migration to lowercase all emails
   - Prevent case sensitivity issues

5. **Add Monitoring**
   - Log failed login attempts
   - Track authentication errors
   - Alert on suspicious activity

---

## 📞 What I Need From You

**Priority 1 (Critical):**
1. Test script output
2. Dev server [auth] logs
3. Prisma Studio email and passwordHash info

**Priority 2 (Helpful):**
4. .env.local DATABASE_URL
5. When did this start?
6. Any other users that can log in?

**Priority 3 (Nice to Have):**
7. Screenshots of Prisma Studio
8. Full error stack traces
9. Any other relevant info

Once I have this information, I can:
- Identify the exact problem
- Provide a targeted fix
- Implement improvements
- Get login working

---

**The key is: I need to see what's actually happening, not just the symptom (401 error). The test script and dev logs will show me the root cause.**




