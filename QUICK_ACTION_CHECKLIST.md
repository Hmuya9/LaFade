# Quick Action Checklist - What I Need From You

## 🚨 Run These Right Now

### 1. Test Script (5 minutes)
```powershell
cd web
pnpm tsx scripts/test-full-login.ts hussemuya.hm.hm@gmail.com LaFadeOwner123
```
**Share:** Complete output (all lines)

### 2. Dev Server Logs (2 minutes)
- Open terminal where `pnpm dev` is running
- Try to log in at `http://localhost:3000/login`
- Copy all lines starting with `[auth]`
**Share:** All `[auth]` prefixed logs

### 3. Prisma Studio Check (3 minutes)
- Open Prisma Studio: `pnpm prisma studio`
- Go to User table
- Find user: `hussemuya.hm.hm@gmail.com` (or similar)
- Scroll RIGHT to find `passwordHash` column
**Share:**
- Exact email (copy-paste)
- passwordHash length (number)
- First 10 chars: `$2b$10$...`
- Last 5 chars: `...rWi.`

### 4. Environment Check (1 minute)
- Open `web/.env.local`
**Share:**
- DATABASE_URL value (the path)
- Does NEXTAUTH_SECRET exist? (yes/no, don't share value)

---

## 📋 Optional But Helpful

### 5. List All Users
```powershell
cd web
# Close Prisma Studio first!
pnpm tsx scripts/list-users.ts
```
**Share:** Complete output

### 6. When Did This Start?
- Did login ever work?
- What changed recently?
- Did you just add passwordHash?

---

## ✅ After You Share

I will:
1. Analyze the data
2. Identify exact problem
3. Provide targeted fix
4. Get login working

**The test script output is the most important - it will show exactly what's failing.**




