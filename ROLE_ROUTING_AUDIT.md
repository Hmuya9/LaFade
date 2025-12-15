# Role-Based Routing Audit

**Date**: 2025-01-XX  
**Engineer**: Senior Full-Stack Engineer  
**Scope**: Role-based routing and navigation enforcement

---

## PHASE 1: READ-ONLY INVENTORY

### Dashboard Routes by Role

1. **CLIENT Dashboard**
   - Route: `/account`
   - Access: CLIENT only
   - Current Guard: Server-side check in `account/page.tsx` (redirects BARBER/OWNER to `/barber`)

2. **BARBER Dashboard**
   - Route: `/barber`
   - Access: BARBER and OWNER
   - Current Guard: Client-side check in `barber/page.tsx` (redirects to `/barber/login`)

3. **OWNER Dashboard**
   - Route: `/admin` (and sub-routes: `/admin/appointments`, `/admin/broadcast`, `/admin/barbers`)
   - Access: OWNER only
   - Current Guard: Middleware check (redirects non-OWNER to `/`)

### Role Determination

**Three sources of role:**
1. **Session (next-auth)**: `session.user.role` - from JWT token
2. **Database**: `user.role` - looked up by email from session
3. **Middleware token**: `(token as any)?.role` - from JWT in middleware

**Current flow:**
- Middleware reads role from JWT token
- Server components read role from database (after looking up user by email)
- Client components read role from `useSession()` hook

### Navbar Link Building

**Current implementation** (`Navbar.tsx`):
- ✅ Already role-aware
- CLIENT sees: "Dashboard" → `/account`
- BARBER/OWNER sees: "Dashboard" → `/barber`
- Logo link is role-aware (CLIENT → `/account`, BARBER → `/barber`, OWNER → `/admin/appointments`)

**Why barber might see wrong dashboard:**
- Middleware redirects wrong roles to `/` instead of their correct dashboard
- `requireRole()` helper redirects to `/login` instead of role-specific dashboard
- No centralized redirect logic

---

## PHASE 2: IDENTIFIED ISSUES

### Issue 1: Middleware Redirects to Wrong Place
**Location**: `middleware.ts` lines 78-92
**Problem**: Redirects wrong roles to `/` instead of their correct dashboard
**Fix**: Redirect to role-specific dashboard

### Issue 2: requireRole() Helper Not Role-Aware
**Location**: `lib/auth.ts` line 24-33
**Problem**: Redirects to `/login` instead of role-specific dashboard
**Fix**: Create `requireRoleWithRedirect()` that redirects to correct dashboard

### Issue 3: Barber Page Uses Client-Side Guard
**Location**: `barber/page.tsx` line 50-58
**Problem**: Client-side redirect (slow, flashes wrong content)
**Fix**: Convert to server component with server-side guard

### Issue 4: No Centralized Dashboard Route Helper
**Problem**: Each route calculates its own redirect destination
**Fix**: Create `getDashboardRouteForRole()` helper

---

## PHASE 3: IMPLEMENTATION PLAN

1. **Create centralized role guard helpers** (`lib/auth.ts`)
   - `getDashboardRouteForRole(role)` - returns correct dashboard route
   - `requireRoleWithRedirect(roles)` - redirects to correct dashboard if wrong role

2. **Update middleware** (`middleware.ts`)
   - Use centralized redirect logic
   - Redirect to correct dashboard instead of `/`

3. **Update account page** (`account/page.tsx`)
   - Use centralized `requireRoleWithRedirect()` helper
   - Remove duplicate role check logic

4. **Update barber page** (`barber/page.tsx`)
   - Convert to server component (or add server-side guard)
   - Use centralized `requireRoleWithRedirect()` helper
   - Remove client-side redirect

5. **Verify navbar** (`Navbar.tsx`)
   - Already correct, but verify consistency

---

## PHASE 4: TEST CHECKLIST

- [ ] Login as CLIENT → Dashboard goes to `/account`
- [ ] Login as BARBER → Dashboard goes to `/barber`
- [ ] Login as OWNER → Dashboard goes to `/admin` (or `/barber` if that's their primary)
- [ ] Paste `/account` while logged in as BARBER → redirected to `/barber`
- [ ] Paste `/account` while logged in as OWNER → redirected to `/barber`
- [ ] Paste `/barber` while logged in as CLIENT → redirected to `/account`
- [ ] Paste `/admin` while logged in as CLIENT → redirected to `/account`
- [ ] Paste `/admin` while logged in as BARBER → redirected to `/barber`
- [ ] Logout/login switching roles does not show wrong dashboard
- [ ] Navbar "Dashboard" link matches current role


