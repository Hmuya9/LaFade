# Test Login Right Now - Step by Step

## Quick Test

### 1. Run Complete Test Script (Tests Everything)

```powershell
cd web
pnpm tsx scripts/test-full-login.ts
```

Or with your credentials:
```powershell
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```

**Expected Output:**
- ✅ User found
- ✅ passwordHash exists (60 chars)
- ✅ Password matches
- ✅ All fields present
- ✅ JWT/Session would work

### 2. Test in Browser (Real Login)

**Prerequisites:**
- Dev server must be running: `pnpm dev`
- You should see: `Local: http://localhost:3000`

**Steps:**
1. Open browser: `http://localhost:3000/login`
2. Enter email: `hussemuya.hm.hm@gmail.com` (or your email)
3. Enter password: `LaFadeOwner123` (or your password)
4. Click "Sign in"

**Check Dev Terminal:**
You should see logs like:
```
[auth] credentials login attempt: hussemuya.hm.hm@gmail.com
[auth] Found user with different casing: Hussemuya.hm.hm@gmail.com
[auth] DB user: { id: '...', email: '...', role: '...', passwordHashLength: 60 }
[auth] compare input: { inputPassword: '...', isValid: true }
[auth] password valid: true
```

**Expected Result:**
- ✅ No "Invalid email or password" error
- ✅ Redirects to `/post-login`
- ✅ Then redirects based on role:
  - `CLIENT` → `/booking`
  - `BARBER` → `/barber`
  - `OWNER` → `/admin`

### 3. Verify Session Has Role

After successful login:

1. **Check Navbar:**
   - If `OWNER`: Should see "Admin" and "Barber Dashboard" links
   - If `BARBER`: Should see "Barber Dashboard" link (no Admin)
   - If `CLIENT`: Should see neither

2. **Check Browser Console:**
   ```javascript
   // In browser console
   fetch('/api/auth/session').then(r => r.json()).then(console.log)
   ```
   
   Should show:
   ```json
   {
     "user": {
       "id": "...",
       "email": "...",
       "name": "...",
       "role": "OWNER" // or BARBER or CLIENT
     }
   }
   ```

### 4. Test Role-Based Access

**As OWNER:**
- ✅ Can access `/admin`
- ✅ Can access `/barber`
- ✅ Can access `/booking`

**As BARBER:**
- ❌ Cannot access `/admin` (redirects to `/`)
- ✅ Can access `/barber`
- ✅ Can access `/booking`

**As CLIENT:**
- ❌ Cannot access `/admin` (redirects to `/`)
- ❌ Cannot access `/barber` (redirects to `/`)
- ✅ Can access `/booking`

## Quick Troubleshooting

### If Test Script Fails

**"User not found":**
- Check email casing in Prisma Studio
- Run: `pnpm tsx scripts/list-users.ts` (close Prisma Studio first)

**"No passwordHash":**
- Generate: `pnpm hash:generate YourPassword`
- Update in Prisma Studio → User table → scroll right → passwordHash

**"Password doesn't match":**
- Regenerate hash: `pnpm hash:generate YourPassword`
- Make sure hash is exactly 60 characters (no trailing dot, no spaces)
- Update in Prisma Studio

### If Browser Login Fails

**Check dev terminal logs:**
- Look for `[auth]` prefixed messages
- Check `passwordHashLength` - should be 60
- Check `isValid` - should be true

**Common issues:**
- Hash has extra characters (length ≠ 60)
- Email casing mismatch
- PasswordHash is null/empty

## Success Checklist

- [ ] Test script passes all 6 steps
- [ ] Browser login works (no error)
- [ ] Redirects to correct page based on role
- [ ] Navbar shows correct links for role
- [ ] Session contains role in browser console
- [ ] Role-based routes work (admin/barber protected)

## Next Steps After Success

1. **Set your role to OWNER** in Prisma Studio
2. **Test admin dashboard** at `/admin`
3. **Test barber dashboard** at `/barber`
4. **Create test clients** by signing up new accounts




