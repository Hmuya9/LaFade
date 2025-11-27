# Complete LaFade Repository Audit
**Date**: 2025-01-27  
**Scope**: Full codebase analysis for authentication, roles, database, middleware, and client/server boundaries

---

## 1. AUTH ANALYSIS

### 1.1 How Signup Works

**File**: `web/src/app/signup/actions.ts`

✅ **CORRECT**: 
- Uses `bcryptjs` to hash passwords (10 rounds)
- Normalizes email to lowercase
- Sets role to `"CLIENT"` by default (line 41)
- Uses `upsert` to handle existing users
- Redirects to login after signup

**Issues Found**:
- ⚠️ **MINOR**: Uses `upsert` which could update existing users if they don't have a passwordHash. This is actually fine for password reset scenarios.

### 1.2 How Login Works

**Files**: 
- `web/src/app/login/LoginForm.tsx` (client component)
- `web/src/lib/auth-options.ts` (NextAuth config)

✅ **CORRECT**:
- Supports both credentials (email/password) and magic link (email provider)
- Credentials provider:
  - Normalizes email to lowercase
  - Finds user by email
  - Compares password with `bcryptjs.compare`
  - Returns user object with `id`, `email`, `name`, `role`
- Magic link provider:
  - Uses Resend API for email delivery
  - Handles user creation/role assignment in `signIn` callback

**Issues Found**:
- ✅ Password hashing is correct (bcryptjs with 10 rounds)
- ✅ Credential provider matches database (queries by email, checks passwordHash)
- ⚠️ **ISSUE**: Role propagation works, but see section 1.5

### 1.3 Password Hashing

✅ **CORRECT**: 
- Signup: `await hash(password, 10)` - correct bcrypt usage
- Login: `await compare(password, user.passwordHash)` - correct verification
- Both use `bcryptjs` package

### 1.4 Credential Provider vs Database

✅ **MATCHES**:
- Provider queries: `prisma.user.findUnique({ where: { email } })`
- Checks: `user.passwordHash` exists
- Verifies: `compare(password, user.passwordHash)`
- Returns: `{ id, email, name, role }` - role comes from DB

### 1.5 Role Storage & Propagation

**Database**:
- ✅ Prisma schema has `Role` enum: `CLIENT | BARBER | OWNER`
- ✅ User model has `role Role @default(CLIENT)`
- ✅ Role is stored in database

**JWT Token** (auth-options.ts lines 103-111):
```typescript
async jwt({ token, user }) {
  if (user) {
    token.userId = (user as any).id;
    token.role = (user as any).role ?? "CLIENT"; // ✅ Gets role from user
  }
  return token;
}
```

**Session** (auth-options.ts lines 113-119):
```typescript
async session({ session, token }) {
  if (session.user) {
    (session.user as any).id = token.userId;
    (session.user as any).role = token.role ?? "CLIENT"; // ✅ Propagates from token
  }
  return session;
}
```

✅ **ROLE PROPAGATION IS CORRECT**: DB → JWT → Session

### 1.6 Login Flows for CLIENT/BARBER/OWNER

**Current State**:
- ✅ All roles use the same login flow (`/login` page)
- ✅ Credentials provider works for all roles
- ✅ Magic link provider works for all roles
- ⚠️ **ISSUE**: Barber login page (`/barber/login`) only allows magic link, but uses same auth system
- ⚠️ **ISSUE**: Client login page (`/client/login`) only allows magic link

**Role Assignment**:
- Signup: Always `CLIENT` (correct)
- Magic link: 
  - If email matches `BARBER_EMAIL` env var → `BARBER`
  - Otherwise → `CLIENT`
  - (No automatic `OWNER` assignment - must be manual DB update)

**Issues Found**:
- ⚠️ **INCONSISTENCY**: Three login pages (`/login`, `/barber/login`, `/client/login`) but they all use the same NextAuth system. The separation is only UI-level.
- ✅ **CORRECT**: All roles can use the same `/login` page with credentials

---

## 2. PRISMA ANALYSIS

### 2.1 Schema Matches App

✅ **SCHEMA IS CORRECT**:
- `Role` enum exists: `CLIENT | BARBER | OWNER`
- User model has `role Role @default(CLIENT)`
- All relations are properly defined
- Database provider is SQLite

### 2.2 Relations

✅ **ALL RELATIONS CORRECT**:
- User → Accounts (OAuth)
- User → Sessions (NextAuth)
- User → Subscriptions
- User → Appointments (as client and barber)
- User → Payouts
- User → PointsLedger
- User → PasswordResetTokens
- User → Photos

### 2.3 Role Enum

✅ **ROLE EXISTS**: 
```prisma
enum Role { 
  CLIENT 
  BARBER 
  OWNER 
}
```

### 2.4 Database Path

**Current Schema**:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Expected Path**: `file:./prisma/dev.db` (relative to `web/` directory)

**Issues Found**:
- 🔴 **CRITICAL**: Found duplicate database files:
  - `web/prisma/dev.db` ✅ (correct location)
  - `web/prisma/prisma/dev.db` ❌ (nested incorrectly)
- ⚠️ **UNCLEAR**: Which database is actually being used?
- ⚠️ **RISK**: Prisma Studio and dev server might be using different databases

**Recommendation**: 
- Ensure `DATABASE_URL=file:./prisma/dev.db` (relative to `web/`)
- Remove `web/prisma/prisma/dev.db` if it's a duplicate
- Verify Prisma Studio uses the same path

### 2.5 Dev Server vs Prisma Studio Sync

**Package.json scripts**:
```json
"db:studio": "prisma studio --schema prisma/schema.prisma"
```

**Issue**:
- ⚠️ **POTENTIAL MISMATCH**: If `DATABASE_URL` in `.env.local` is different from what Prisma Studio uses, they'll show different data
- Need to verify both use `file:./prisma/dev.db`

---

## 3. NAVBAR & DASHBOARD ANALYSIS

### 3.1 How Navbar Decides What to Show

**File**: `web/src/components/Navbar.tsx`

🔴 **CRITICAL ISSUE**: Navbar shows ALL links to EVERYONE, regardless of role!

**Current Implementation**:
```tsx
// Shows to everyone:
<Link href="/barber">Barber Login</Link>
<Link href="/admin">Admin</Link>
```

**Missing**:
- ❌ No `useSession()` hook to get user role
- ❌ No conditional rendering based on `session.user.role`
- ❌ Admin link visible to clients
- ❌ Barber link visible to everyone

**Expected Behavior**:
- `/admin` link: Only visible to `OWNER` role
- `/barber` link: Only visible to `BARBER` or `OWNER` roles
- `/booking` link: Visible to all authenticated users
- `/plans` link: Visible to everyone (public)

### 3.2 Role-Based UI Logic Gaps

**Files Needing Role Checks**:

1. **Navbar.tsx**:
   - ❌ No role-based link hiding
   - ❌ Shows admin/barber links to everyone

2. **Barber Dashboard** (`web/src/app/barber/page.tsx`):
   - ✅ Checks role client-side: `session.user?.role !== "BARBER"`
   - ⚠️ **ISSUE**: Only client-side check, no server-side protection
   - Redirects to `/barber/login` if not barber

3. **Admin Dashboard** (`web/src/app/admin/page.tsx`):
   - ✅ Uses `requireAdmin()` which checks `OWNER` role
   - ✅ Server-side protection exists

### 3.3 Missing Server-Side Protections

**Protected Routes**:
- ✅ `/admin` - Protected by `requireAdmin()` (server-side)
- ⚠️ `/barber` - Only client-side check, middleware redirects but page doesn't use server component protection
- ✅ `/booking` - Middleware requires auth, but no role check (correct - all authenticated users can book)
- ✅ `/account` - Middleware requires auth

**Missing Protections**:
- ⚠️ `/barber` page should use server-side role check similar to admin

---

## 4. MIDDLEWARE ANALYSIS

### 4.1 Route Protections

**File**: `web/src/middleware.ts`

**Current Implementation**:

✅ **PUBLIC ROUTES** (lines 19-24):
- `/`, `/plans` - accessible to everyone

✅ **AUTH ROUTES** (lines 20, 30-37):
- `/login`, `/signup`, `/signin`, `/forgot-password`, `/reset-password`
- Redirects logged-in users to `/post-login`

✅ **PROTECTED ROUTES** (lines 21, 40-49):
- `/booking`, `/account`, `/admin`, `/barber`
- Redirects unauthenticated users to `/login?redirectTo=...`

✅ **RBAC** (lines 51-64):
- `/admin` - Only `OWNER` role allowed
- `/barber` - Only `BARBER` or `OWNER` roles allowed
- Redirects unauthorized roles to `/booking`

### 4.2 Missing Guards

✅ **MIDDLEWARE IS COMPREHENSIVE**: All routes are properly protected

**One Potential Issue**:
- ⚠️ `/barber/login` is not in the `authRoutes` array, so logged-in users can still access it. This might be intentional (to allow switching accounts), but could be confusing.

### 4.3 Redirect Loops

✅ **NO REDIRECT LOOPS DETECTED**:
- Auth routes redirect logged-in users to `/post-login`
- Protected routes redirect unauthenticated users to `/login`
- RBAC redirects unauthorized roles to `/booking`
- `/post-login` redirects based on role (no loop)

### 4.4 Safe Use of NextResponse.redirect and getToken

✅ **SAFE USAGE**:
- Uses `req.nextUrl.clone()` before redirecting (prevents mutation)
- Uses `getToken({ req, secret: process.env.NEXTAUTH_SECRET })` correctly
- Handles missing token gracefully

---

## 5. ENV ANALYSIS

### 5.1 env.ts Validation

**File**: `web/src/lib/env.ts`

✅ **VALIDATION IS CORRECT**:
- Uses Zod schemas
- Fails fast on critical vars: `DATABASE_URL`, `NEXTAUTH_SECRET`
- Gracefully handles optional vars in development
- Separates server vs client env vars

### 5.2 Client vs Server Env Usage

✅ **CORRECT SEPARATION**:
- Server env: Uses `env` object (imported from `env.ts` which has `"server-only"`)
- Client env: Uses `process.env.NEXT_PUBLIC_*` directly

**Files Checked**:
- ✅ `Navbar.tsx` - Client component, doesn't import server env
- ✅ `LoginForm.tsx` - Client component, doesn't import server env
- ✅ `PlansPage.tsx` - Client component, uses `process.env.NEXT_PUBLIC_*`
- ✅ `auth-options.ts` - Server file, uses `env` object

### 5.3 Missing Optional Env Vars

✅ **NO CRASHES ON MISSING OPTIONAL VARS**:
- `env.ts` uses `safeParse` and handles failures gracefully
- Development mode logs warnings but continues
- Production mode fails fast only on critical vars

### 5.4 Client Component Imports

✅ **NO CLIENT COMPONENTS IMPORT SERVER-ONLY ENV**:
- All client components use `process.env.NEXT_PUBLIC_*` directly
- No client components import from `@/lib/env`

---

## 6. CLIENT/SERVER BOUNDARY AUDIT

### 6.1 Files with "use client"

**Found 26 files with `"use client"`**:
- ✅ All are appropriate (interactive components, forms, hooks)
- ✅ No server-only code in client components

### 6.2 Files with "use server"

**Found server actions**:
- ✅ `web/src/app/signup/actions.ts` - Correctly marked
- ✅ `web/src/app/account/actions.ts` - Correctly marked
- ✅ `web/src/app/forgot-password/actions.ts` - Correctly marked
- ✅ `web/src/app/reset-password/actions.ts` - Correctly marked

### 6.3 Boundary Violations

✅ **NO VIOLATIONS FOUND**:
- Client components don't import server-only modules
- Server actions are properly marked
- No server code in client components

**One Potential Issue**:
- ⚠️ `web/src/components/Navbar.tsx` is a client component but could benefit from server-side role checking for initial render. However, this is acceptable for a navbar that needs interactivity.

---

## 7. REQUIRED FIX PLAN

### 7.1 Roles & Permissions

**Issues**:
1. Navbar shows admin/barber links to everyone
2. `/barber` page only has client-side role check

**Fixes Needed**:
1. Update `Navbar.tsx` to use `useSession()` and conditionally render links based on role
2. Add server-side role check to `/barber` page (similar to admin)

### 7.2 Login Not Working

**Status**: ✅ Login appears to work correctly based on code analysis

**Potential Issues**:
- Need to verify `DATABASE_URL` is set correctly
- Need to verify `NEXTAUTH_SECRET` is set
- Need to verify database has users with `passwordHash`

### 7.3 Session.role Propagation

**Status**: ✅ Role propagation is correct (DB → JWT → Session)

**Verification Needed**:
- Test that role actually appears in session after login
- Check browser DevTools for JWT token contents

### 7.4 Navbar Hiding Admin/Barber Pages

**Status**: ❌ Navbar does NOT hide links based on role

**Fix Required**: Add role-based conditional rendering

### 7.5 Middleware Protection

**Status**: ✅ Middleware protection is comprehensive

**No fixes needed**

### 7.6 Prisma Studio Syncing

**Issues**:
1. Duplicate database file: `web/prisma/prisma/dev.db`
2. Need to verify `DATABASE_URL` matches Prisma Studio path

**Fixes Needed**:
1. Remove duplicate database file
2. Verify `DATABASE_URL=file:./prisma/dev.db` in `.env.local`
3. Ensure Prisma Studio uses same path

### 7.7 Database Path Issues

**Current State**:
- Schema expects: `env("DATABASE_URL")`
- Expected value: `file:./prisma/dev.db` (relative to `web/`)

**Fixes Needed**:
1. Verify `.env.local` has `DATABASE_URL=file:./prisma/dev.db`
2. Remove duplicate `web/prisma/prisma/dev.db` if it exists
3. Ensure all scripts use same database path

### 7.8 Mismatches in Code

**Found Mismatches**:

1. **Barber Email Env Var**:
   - `auth-options.ts` uses: `env.BARBER_EMAIL`
   - `BarberLoginForm.tsx` uses: `process.env.NEXT_PUBLIC_BARBER_EMAIL`
   - ⚠️ **INCONSISTENCY**: Server vs client env var names

2. **Three Login Pages**:
   - `/login` - Full login (credentials + magic link)
   - `/barber/login` - Magic link only
   - `/client/login` - Magic link only
   - ⚠️ **CONFUSION**: Multiple entry points, but all use same auth system

### 7.9 Leftover Breaking Bugs

**Potential Bugs**:

1. **Duplicate Database**:
   - `web/prisma/dev.db` and `web/prisma/prisma/dev.db` both exist
   - Could cause data inconsistency

2. **Barber Email Env Var Mismatch**:
   - Server uses `BARBER_EMAIL`
   - Client uses `NEXT_PUBLIC_BARBER_EMAIL`
   - Could cause barber login to fail

3. **Navbar Shows Protected Links**:
   - Users can see `/admin` and `/barber` links even if they can't access them
   - Poor UX (shows 404 or redirect)

---

## 8. COMPLETE PR GENERATION PLAN

### 8.1 Changes Required

1. **Navbar.tsx**:
   - Add `useSession()` hook
   - Conditionally render `/admin` link (only for `OWNER`)
   - Conditionally render `/barber` link (only for `BARBER` or `OWNER`)
   - Keep `/booking` visible to all authenticated users
   - Keep `/plans` visible to everyone

2. **Barber Page**:
   - Add server-side role check (similar to admin)
   - Keep client-side check as backup

3. **Database Path**:
   - Verify `DATABASE_URL=file:./prisma/dev.db`
   - Remove duplicate `web/prisma/prisma/dev.db` if exists
   - Document correct path

4. **Barber Email Env Var**:
   - Standardize on `BARBER_EMAIL` (server-only)
   - Remove `NEXT_PUBLIC_BARBER_EMAIL` usage from client
   - Update `BarberLoginForm.tsx` to fetch barber email from API or use server action

5. **Prisma Schema**:
   - ✅ Already has `Role` enum - no changes needed
   - ✅ Already has `role Role @default(CLIENT)` - no changes needed

6. **Auth Callbacks**:
   - ✅ Already propagate role correctly - no changes needed

7. **Middleware**:
   - ✅ Already protects routes correctly - no changes needed

8. **Signup**:
   - ✅ Already sets role to `CLIENT` - no changes needed

9. **Login**:
   - ✅ Already propagates role - no changes needed

### 8.2 Files to Modify

1. `web/src/components/Navbar.tsx` - Add role-based link rendering
2. `web/src/app/barber/page.tsx` - Add server-side role check
3. `web/src/app/barber/login/BarberLoginForm.tsx` - Fix env var usage
4. Remove `web/prisma/prisma/dev.db` if duplicate
5. Verify `.env.local` has correct `DATABASE_URL`

### 8.3 Testing Checklist

After PR:
- [ ] Sign up as new user → role should be `CLIENT`
- [ ] Login as client → navbar should NOT show `/admin` or `/barber` links
- [ ] Login as barber → navbar should show `/barber` link, NOT `/admin` link
- [ ] Login as owner → navbar should show both `/admin` and `/barber` links
- [ ] Try accessing `/admin` as client → should redirect to `/booking`
- [ ] Try accessing `/barber` as client → should redirect to `/booking`
- [ ] Prisma Studio should show same data as dev server
- [ ] Role should appear in session after login
- [ ] Barber login should work with `BARBER_EMAIL` env var

---

## SUMMARY

### ✅ What's Working
- Password hashing (bcryptjs)
- Role storage in database
- Role propagation (DB → JWT → Session)
- Middleware route protection
- Server-side admin protection
- Client/server boundaries
- Environment variable handling

### ❌ What Needs Fixing
1. **Navbar** - Shows all links to everyone (needs role-based rendering)
2. **Barber page** - Only client-side protection (needs server-side check)
3. **Database path** - Duplicate database file exists
4. **Barber email env var** - Inconsistent naming (server vs client)

### ⚠️ Potential Issues
1. Login might not work if `DATABASE_URL` or `NEXTAUTH_SECRET` not set
2. Prisma Studio might use different database than dev server
3. Barber login form uses wrong env var name

---

**Ready to generate PR?** All issues identified and fix plan created.




