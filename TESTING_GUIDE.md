# 🧪 Complete Testing Guide - Login Fix Verification

## Pre-Test Checklist

Before testing, ensure:

✅ **Database is accessible** (not locked)
✅ **Dev server is running** (`pnpm dev`)
✅ **Prisma Studio is closed** (if it was open)
✅ **User exists in database** with correct password hash

---

## Test 1: Verify Database Access

### Step 1.1: Check Database File
```powershell
cd web
Test-Path prisma/dev.db
# Should return: True
```

### Step 1.2: Test Database Connection
```powershell
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```

**Expected Output:**
```
✅ PASS: verifyCredentials() returned user
✅ PASS: JWT token created
✅ PASS: Session created
🎉 ALL TESTS PASSED!
```

**If you see "Error code 14"**: Database is locked → Close Prisma Studio, restart dev server

---

## Test 2: Browser Login Flow

### Step 2.1: Open Login Page
1. Go to `http://localhost:3000/login`
2. You should see the login form

### Step 2.2: Enter Credentials
- **Email**: `hussemuya.hm.hm@gmail.com` (any casing should work)
- **Password**: `LaFadeOwner123`

### Step 2.3: Watch Terminal Logs

**Expected Success Logs:**
```
[auth] authorize() called { hasEmail: true, hasPassword: true, emailType: 'string', ... }
[auth] authorize() normalized email { original: 'hussemuya.hm.hm@gmail.com', normalized: 'hussemuya.hm.hm@gmail.com' }
[auth] verifyCredentials: starting verification { email: 'hussemuya.hm.hm@gmail.com', ... }
[auth] findUserByEmailInsensitive: looking for hussemuya.hm.hm@gmail.com
[auth] findUserByEmailInsensitive: checked 3 users
[auth] findUserByEmailInsensitive: matched DB email Hussemuya.hm.hm@gmail.com
[auth] verifyCredentials: user found { userId: '...', dbEmail: '...', hasPasswordHash: true, ... }
[auth] verifyPassword: result true
[auth] verifyCredentials: SUCCESS { userId: '...', email: '...', role: 'OWNER' }
[auth] authorize() SUCCESS: returning user { userId: '...', email: '...', role: 'OWNER' }
```

### Step 2.4: Verify Success
- ✅ Should redirect to `/post-login` or home page
- ✅ Should NOT show "Invalid email or password" error
- ✅ Should be logged in

---

## Test 3: Session & Role Verification

### Step 3.1: Check Session in Browser
1. After successful login, open browser DevTools (F12)
2. Go to **Application** tab → **Cookies**
3. Look for `next-auth.session-token` cookie
4. Should exist and have a value

### Step 3.2: Check Role in Navbar
1. After login, check the navbar
2. Should see:
   - ✅ **"Admin"** link (visible because role is OWNER)
   - ✅ **"Barber Dashboard"** link (visible because OWNER can access)
   - ✅ **"Sign Out"** button

### Step 3.3: Verify Role-Based Access
1. Try accessing `/admin` → Should work (OWNER role)
2. Try accessing `/barber` → Should work (OWNER can access)
3. Check URL - should not redirect to `/login`

---

## Test 4: Case-Insensitive Email

### Step 4.1: Test Different Email Casings
Try logging in with different casings:
- `Hussemuya.hm.hm@gmail.com` (capital H)
- `HUSSEMUYA.HM.HM@GMAIL.COM` (all caps)
- `hussemuya.hm.hm@gmail.com` (all lowercase)

**Expected**: All should work! The case-insensitive lookup should find the user regardless of casing.

**Watch logs**: Should see `matched DB email` with the actual DB email (which might have different casing).

---

## Test 5: Error Scenarios

### Test 5.1: Wrong Password
1. Go to login page
2. Enter correct email, wrong password
3. Click "Sign in"

**Expected Logs:**
```
[auth] verifyCredentials: user found { ... }
[auth] verifyPassword: result false
[auth] verifyCredentials: password mismatch { ... }
[auth] authorize() FAILED: verifyCredentials returned null
```

**Expected UI**: "Invalid email or password" error message

### Test 5.2: Wrong Email
1. Go to login page
2. Enter non-existent email, any password
3. Click "Sign in"

**Expected Logs:**
```
[auth] findUserByEmailInsensitive: NO MATCH for ...
[auth] verifyCredentials: available emails in DB [ '...', '...', ... ]
[auth] verifyCredentials: user not found for email ...
```

**Expected UI**: "Invalid email or password" error message

### Test 5.3: Missing Credentials
1. Go to login page
2. Leave email or password empty
3. Click "Sign in"

**Expected Logs:**
```
[auth] authorize() called { hasEmail: false, hasPassword: false, ... }
[auth] authorize() FAILED: missing credentials
```

**Expected UI**: Browser validation should prevent submission, or "Invalid email or password"

---

## Test 6: Test Script vs Browser Comparison

### Step 6.1: Run Test Script
```powershell
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```

**Note the logs** - especially:
- Email normalization
- User lookup result
- Password verification result

### Step 6.2: Try Browser Login
1. Use same credentials in browser
2. Compare terminal logs with test script logs

**Expected**: Logs should be **identical** (same flow, same results)

**If different**: There's a mismatch between test script and browser flow

---

## Test 7: Role Propagation

### Step 7.1: Check Server-Side Role
1. After login, go to `/admin` or `/barber`
2. Should load successfully (not redirect to `/login`)

### Step 7.2: Check Client-Side Role
1. Open browser DevTools → Console
2. Run:
```javascript
fetch('/api/dev/session').then(r => r.json()).then(console.log)
```

**Expected Output:**
```json
{
  "user": {
    "id": "...",
    "email": "hussemuya.hm.hm@gmail.com",
    "role": "OWNER"
  }
}
```

---

## Common Issues & Solutions

### Issue 1: "Error code 14: Unable to open the database file"
**Solution**: Close Prisma Studio, restart dev server

### Issue 2: "user not found" but email exists
**Solution**: Check logs for "available emails in DB" - compare normalized emails

### Issue 3: "password mismatch" with correct password
**Solution**: Regenerate password hash:
```powershell
cd web
pnpm hash:generate
# Then update in Prisma Studio
```

### Issue 4: Test script works but browser doesn't
**Solution**: 
- Check if dev server restarted after code changes
- Compare logs between test script and browser
- Verify `authorize()` is using same `verifyCredentials()` function

### Issue 5: Login works but role is wrong
**Solution**: Check JWT/session callbacks in `auth-options.ts` - should propagate role correctly

---

## Success Criteria

✅ Test script passes  
✅ Browser login works  
✅ Terminal logs show success flow  
✅ Session contains correct role  
✅ Navbar shows correct links (Admin, Barber Dashboard)  
✅ Role-based routes accessible (`/admin`, `/barber`)  
✅ Case-insensitive email works  
✅ Error messages show for wrong credentials  

---

## Quick Test Checklist

- [ ] Database accessible (test script passes)
- [ ] Browser login works
- [ ] Terminal shows success logs
- [ ] Session has correct role (OWNER)
- [ ] Navbar shows Admin link
- [ ] `/admin` route accessible
- [ ] Case-insensitive email works
- [ ] Wrong password shows error
- [ ] Wrong email shows error

---

## Next Steps After Testing

If all tests pass:
✅ **Login is fixed!** You can now use the application normally.

If any test fails:
1. **Check the logs** - they'll tell you exactly where it fails
2. **Compare with expected logs** above
3. **Apply the appropriate fix** from "Common Issues & Solutions"

The comprehensive logging we added will make it easy to identify any remaining issues! 🔍




