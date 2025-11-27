# 🔍 Login Diagnostic Guide

## Enhanced Logging Added

I've added comprehensive logging to diagnose why UI login fails while test script succeeds.

## What Was Added

### 1. **`authorize()` Function Logging**
- Logs raw input from NextAuth (email, password types, lengths)
- Logs normalized email before passing to `verifyCredentials()`
- Logs success/failure with user details
- **Try/catch** to catch unexpected errors

### 2. **`verifyCredentials()` Function Logging**
- Logs input parameters (email, password lengths, types)
- Logs user lookup results
- **Logs all available emails in DB** if user not found
- Logs password verification details
- **Try/catch** to catch DB connection errors

### 3. **`findUserByEmailInsensitive()` Enhanced Logging**
- Logs normalized available emails for comparison
- Shows exact mismatch details

## How to Diagnose

### Step 1: Restart Dev Server
```powershell
# Stop current server (Ctrl+C)
cd web
pnpm dev
```

### Step 2: Try Login in Browser
1. Go to `http://localhost:3000/login`
2. Enter email: `hussemuya.hm.hm@gmail.com`
3. Enter password: `LaFadeOwner123`
4. Click "Sign in"

### Step 3: Watch Terminal Logs

You should see a detailed log sequence. Here's what to look for:

#### ✅ **Success Flow** (Expected):
```
[auth] authorize() called { hasEmail: true, hasPassword: true, emailType: 'string', ... }
[auth] authorize() normalized email { original: '...', normalized: 'hussemuya.hm.hm@gmail.com', ... }
[auth] verifyCredentials: starting verification { email: 'hussemuya.hm.hm@gmail.com', ... }
[auth] findUserByEmailInsensitive: looking for hussemuya.hm.hm@gmail.com
[auth] findUserByEmailInsensitive: checked 3 users
[auth] findUserByEmailInsensitive: matched DB email Hussemuya.hm.hm@gmail.com
[auth] verifyCredentials: user found { userId: '...', dbEmail: '...', ... }
[auth] verifyCredentials: verifying password { userId: '...', ... }
[auth] verifyPassword: result true
[auth] verifyCredentials: SUCCESS { userId: '...', email: '...', role: 'OWNER' }
[auth] authorize() SUCCESS: returning user { userId: '...', email: '...', role: 'OWNER' }
```

#### ❌ **Failure Scenarios**:

**Scenario A: User Not Found**
```
[auth] verifyCredentials: user not found for email hussemuya.hm.hm@gmail.com
[auth] verifyCredentials: available emails in DB [ 'user1@example.com', 'user2@example.com', ... ]
[auth] findUserByEmailInsensitive: normalized available emails [ 'user1@example.com', ... ]
```
→ **Fix**: Check if your email exists in DB. Email casing might be different.

**Scenario B: Password Mismatch**
```
[auth] verifyCredentials: user found { userId: '...', dbEmail: '...', ... }
[auth] verifyPassword: result false
[auth] verifyCredentials: password mismatch { userId: '...', email: '...', ... }
```
→ **Fix**: Password hash in DB doesn't match. Regenerate hash or check password.

**Scenario C: Database Lock**
```
[auth] verifyCredentials: ERROR { error: 'Error code 14: Unable to open the database file', ... }
```
→ **Fix**: Close Prisma Studio, restart dev server.

**Scenario D: Missing Credentials**
```
[auth] authorize() called { hasEmail: false, hasPassword: false, ... }
[auth] authorize() FAILED: missing credentials
```
→ **Fix**: Check login form is sending email and password correctly.

**Scenario E: Type Mismatch**
```
[auth] authorize() called { emailType: 'undefined', passwordType: 'undefined', ... }
```
→ **Fix**: NextAuth not receiving credentials. Check `signIn("credentials", ...)` call.

## Route Verification

The route is correctly wired:
```typescript
// web/src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

✅ **This is correct** - it imports `authOptions` from the same file we're editing.

## Login Form Verification

The login form sends:
```typescript
await signIn("credentials", {
  email: email.trim().toLowerCase(),  // ✅ Normalized
  password,                            // ✅ Plain text
  redirect: false,
  callbackUrl,
});
```

✅ **This is correct** - matches the test script format.

## Common Issues & Fixes

### Issue 1: Email Casing Mismatch
**Symptom**: "user not found" but email exists in DB
**Fix**: The case-insensitive lookup should handle this, but check logs to see normalized emails.

### Issue 2: Password Hash Mismatch
**Symptom**: "password mismatch" even with correct password
**Fix**: Regenerate password hash:
```powershell
cd web
pnpm hash:generate
# Then update in Prisma Studio
```

### Issue 3: Database Lock
**Symptom**: "Error code 14: Unable to open the database file"
**Fix**: Close Prisma Studio, wait 2-3 seconds, restart dev server.

### Issue 4: NextAuth Not Receiving Credentials
**Symptom**: "missing credentials" in logs
**Fix**: Check browser network tab - is POST to `/api/auth/callback/credentials` sending email/password?

## Next Steps

1. **Restart dev server** (required for new logging)
2. **Try login** in browser
3. **Copy all `[auth]` logs** from terminal
4. **Compare with expected success flow** above
5. **Identify where it fails** and apply appropriate fix

## Expected Log Sequence

When login works, you'll see this exact sequence:
1. `[auth] authorize() called` - NextAuth received request
2. `[auth] authorize() normalized email` - Email normalized
3. `[auth] verifyCredentials: starting verification` - Verification started
4. `[auth] findUserByEmailInsensitive: looking for` - Looking up user
5. `[auth] findUserByEmailInsensitive: matched DB email` - User found
6. `[auth] verifyCredentials: user found` - User confirmed
7. `[auth] verifyPassword: result true` - Password valid
8. `[auth] verifyCredentials: SUCCESS` - Verification complete
9. `[auth] authorize() SUCCESS` - Returning user to NextAuth

If any step is missing or shows an error, that's where the problem is!




