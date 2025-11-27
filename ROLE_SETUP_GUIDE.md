# Role Setup Guide

## Overview

After implementing role-based access control, you need to manually set roles in the database.

## Role Types

- **CLIENT**: Default role for all new signups
- **BARBER**: For barbers who can manage appointments
- **OWNER**: For admin/owner who can access admin dashboard

## Setting Roles in Prisma Studio

1. Open Prisma Studio:
   ```bash
   cd web
   pnpm prisma studio
   ```

2. Navigate to the `User` table

3. For each user:
   - **Your own account**: Set `role` to `OWNER`
   - **Barber accounts**: Set `role` to `BARBER`
   - **All other users**: Keep as `CLIENT` (default)

## Role Behavior

### CLIENT
- Can see: Plans, Booking (when logged in)
- Cannot see: Admin link, Barber Dashboard link
- Can access: `/booking`, `/account`
- Cannot access: `/admin`, `/barber`

### BARBER
- Can see: Plans, Booking, Barber Dashboard
- Cannot see: Admin link
- Can access: `/booking`, `/account`, `/barber`
- Cannot access: `/admin`

### OWNER
- Can see: Plans, Booking, Barber Dashboard, Admin
- Can access: All routes including `/admin` and `/barber`

## Verification

After setting roles:

1. Log out and log back in (to refresh session)
2. Check navbar - links should appear/disappear based on role
3. Try accessing `/admin` as CLIENT - should redirect to `/`
4. Try accessing `/barber` as CLIENT - should redirect to `/`
5. Try accessing `/admin` as BARBER - should redirect to `/`
6. OWNER should be able to access both `/admin` and `/barber`

## Important Notes

- **Signup always creates CLIENT**: No one can self-sign-up as BARBER or OWNER
- **Roles are stored in database**: Changes require database update + re-login
- **Middleware enforces access**: Even if navbar shows link, middleware blocks unauthorized access




