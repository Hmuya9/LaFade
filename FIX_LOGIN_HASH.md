# Fix Login Hash Issue

## Problem
Login says "Invalid email or password" even though:
- ✅ User exists in database
- ✅ passwordHash field exists
- ✅ Code is correct

**Root cause**: The hash in the database doesn't match the password (usually extra characters).

## Solution

### Step 1: Generate a Clean Hash

```powershell
cd web
pnpm hash:generate YourPassword123
```

This will output:
- A clean 60-character hash
- No quotes, no spaces, no extra dots
- Ready to paste into Prisma Studio

### Step 2: Update Hash in Prisma Studio

1. **Open Prisma Studio**:
   ```powershell
   pnpm prisma studio
   ```

2. **Go to User table**

3. **Find your user** (the one you want to log in as)

4. **Check current passwordHash**:
   - Should be exactly 60 characters
   - Should start with `$2b$10$`
   - No trailing dots
   - No spaces before/after

5. **Replace with new hash**:
   - Copy the hash from Step 1 (just the hash, no quotes)
   - Paste into `passwordHash` field
   - **Make sure it's exactly 60 characters**

6. **Save changes**

### Step 3: Test Login

1. Go to your app: `http://localhost:3000/login`
2. Enter:
   - **Email**: The user's email (exactly as stored in DB)
   - **Password**: The password you used in Step 1
3. Click "Sign in"

### Step 4: Check Logs

If it still fails, check your dev terminal. You'll see:

```
[auth] DB user: {
  id: '...',
  email: '...',
  role: '...',
  passwordHashLength: 60,  // ← Should be 60
  passwordHashSnippet: '$2b$10$...'
}
[auth] compare input: {
  inputPassword: 'YourPassword123',
  isValid: true  // ← Should be true
}
```

## Common Issues

### ❌ Hash has trailing dot
```
$2b$10$...rWi.  ← Extra dot at end
```
**Fix**: Remove the trailing dot, hash should be exactly 60 chars

### ❌ Hash has spaces
```
$2b$10$...rWi   ← Space at end
```
**Fix**: Remove all spaces, hash should be exactly 60 chars

### ❌ Hash length is wrong
```
passwordHashLength: 61  ← Should be 60
```
**Fix**: Regenerate hash and copy it exactly

### ❌ Email mismatch
```
Searched: barber@example.com
DB has:   BARBER@example.com  ← Case mismatch
```
**Fix**: The code normalizes to lowercase, but check Prisma Studio shows the email correctly

## Quick Test

After updating the hash, you can test it manually:

```powershell
cd web
pnpm tsx scripts/test-login.ts
```

This will show you exactly where the login flow is failing.

## Success Indicators

✅ `passwordHashLength: 60`  
✅ `isValid: true`  
✅ Login works in browser  
✅ User is redirected to correct page based on role




