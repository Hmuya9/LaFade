# ⚡ Quick Test Checklist

## Before Testing

- [ ] Close Prisma Studio (if open)
- [ ] Dev server is running (`pnpm dev`)
- [ ] Database file exists (`web/prisma/dev.db`)

---

## Test 1: Database Access ✅

```powershell
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```

**Expected**: `🎉 ALL TESTS PASSED!`

**If fails with "Error code 14"**: Database locked → Close Prisma Studio, restart dev server

---

## Test 2: Browser Login ✅

1. Go to `http://localhost:3000/login`
2. Email: `hussemuya.hm.hm@gmail.com`
3. Password: `LaFadeOwner123`
4. Click "Sign in"

**Expected**: 
- ✅ Redirects to home or `/post-login`
- ✅ NO "Invalid email or password" error
- ✅ Terminal shows success logs

**Watch Terminal**: Should see `[auth] verifyCredentials: SUCCESS`

---

## Test 3: Role Verification ✅

After login, check:

- [ ] Navbar shows **"Admin"** link (OWNER role)
- [ ] Navbar shows **"Barber Dashboard"** link
- [ ] Can access `/admin` (no redirect)
- [ ] Can access `/barber` (no redirect)

---

## Test 4: Case-Insensitive Email ✅

Try logging in with:
- `Hussemuya.hm.hm@gmail.com` (capital H)
- `hussemuya.hm.hm@gmail.com` (lowercase)

**Expected**: Both should work!

---

## Test 5: Error Handling ✅

### Wrong Password
- Enter correct email, wrong password
- **Expected**: "Invalid email or password" error

### Wrong Email  
- Enter non-existent email
- **Expected**: "Invalid email or password" error

---

## Success Indicators

✅ Test script passes  
✅ Browser login works  
✅ Terminal shows `[auth] verifyCredentials: SUCCESS`  
✅ Session has role: `OWNER`  
✅ Navbar shows Admin link  
✅ `/admin` route accessible  

---

## If Tests Fail

1. **Check terminal logs** - they show exactly where it fails
2. **Compare with expected logs** in `TESTING_GUIDE.md`
3. **Most common issue**: Database locked → Close Prisma Studio, restart dev server

---

## Quick Commands

```powershell
# Test database access
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123

# Check database file
Test-Path prisma/dev.db

# Check DATABASE_URL
Get-Content .env.local | Select-String DATABASE_URL

# Restart dev server
pnpm dev
```

---

**Start with Test 1** - if that passes, Test 2 should work! 🚀




