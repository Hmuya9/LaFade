# How to Find and Fix passwordHash in Prisma Studio

## ⚠️ Important: passwordHash Column is Hidden!

Prisma Studio **hides long text fields** by default. You need to **scroll horizontally** to see the `passwordHash` column.

## Step-by-Step Instructions

### 1. Open Prisma Studio
```powershell
cd web
pnpm prisma studio
```

### 2. Navigate to User Table
- Click on **"User"** in the left sidebar (should show "3" records)

### 3. Scroll Right to Find passwordHash
- The table shows columns: `email`, `emailVerified`, `phone`, `name`, `image`, `clerkId`
- **Scroll horizontally to the right** using:
  - Mouse wheel (hold Shift)
  - Horizontal scrollbar at bottom
  - Arrow keys (right arrow)
- Keep scrolling until you see: **`passwordHash`** column

### 4. Check Current Hash
When you find `passwordHash`, verify:
- ✅ **Length**: Should be exactly **60 characters**
- ✅ **Format**: Should start with `$2b$10$`
- ✅ **No trailing dot**: Should NOT end with `.`
- ✅ **No spaces**: Should NOT have spaces before/after

### 5. If Hash is Wrong or Missing

**Generate a clean hash:**
```powershell
pnpm hash:generate YourPassword123
```

**Copy the hash** (exactly 60 characters, no quotes)

**In Prisma Studio:**
1. Click on the `passwordHash` cell for your user
2. Paste the hash (no quotes, no spaces)
3. Verify it's exactly 60 characters
4. Click **"Save 1 change"** button

### 6. Test the Hash

**Option A: Test with script**
```powershell
pnpm tsx scripts/test-bcrypt.ts
```

Edit the script to use your password and hash, then run it.

**Option B: Test full login flow**
```powershell
pnpm tsx scripts/test-login.ts your@email.com YourPassword123
```

## Common Issues

### ❌ Can't Find passwordHash Column
**Problem**: Column is hidden to the right  
**Solution**: Scroll horizontally in the table

### ❌ Hash Length is 61
**Problem**: Extra character (usually trailing dot)  
**Solution**: Remove the trailing dot, should be exactly 60

### ❌ Hash Length is Wrong
**Problem**: Hash has spaces or extra characters  
**Solution**: Regenerate hash and copy it exactly

### ❌ Hash is Empty/null
**Problem**: No hash set  
**Solution**: Generate hash and paste into passwordHash field

## Visual Guide

```
Prisma Studio Table View:
┌─────────┬──────────┬──────┬──────┬─────────┬─────────┬──────────────┐
│ email   │ name     │ role │ ...  │ clerkId │ [SCROLL]│ passwordHash │
├─────────┼──────────┼──────┼──────┼─────────┼─────────┼──────────────┤
│ user@...│ User     │ ...  │ ...  │ null    │   →     │ $2b$10$...   │
└─────────┴──────────┴──────┴──────┴─────────┴─────────┴──────────────┘
                                                      ↑
                                              Scroll here!
```

## Quick Verification

After updating the hash, verify it:

1. **Check length**: Should be 60 characters
2. **Check format**: Starts with `$2b$10$`
3. **Test comparison**: Run `pnpm tsx scripts/test-bcrypt.ts`
4. **Test login**: Try logging in with the password

## Success Indicators

✅ Hash is exactly 60 characters  
✅ Hash starts with `$2b$10$`  
✅ No trailing dot or spaces  
✅ `test-bcrypt.ts` shows "MATCH = true"  
✅ Login works in browser




