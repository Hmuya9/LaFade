# Safe Migration Fix - Step by Step

## Current Status
- **9 migrations found** in `prisma/migrations`
- **2 migrations not applied:**
  1. `20251226030326_add_user_isTest` (column already exists - drift)
  2. `20251226213728_add_alert_log` (needs to be applied)

## Safe Fix Procedure

### Step 1: Mark isTest Migration as Applied (Safe - Column Already Exists)

```powershell
npx prisma migrate resolve --schema ./prisma/schema.prisma --applied 20251226030326_add_user_isTest
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Migration 20251226030326_add_user_isTest marked as applied.
```

**What this does:** Tells Prisma that this migration was already applied (safe because the `isTest` column already exists in your database).

---

### Step 2: Deploy Remaining Migrations (Applies AlertLog)

```powershell
npx prisma migrate deploy --schema ./prisma/schema.prisma
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma

The following migration(s) have been applied:

migrations/
  └─ 20251226213728_add_alert_log/
    └─ migration.sql

All migrations have been successfully applied.
```

**What this does:** Applies the `AlertLog` table creation migration safely.

---

### Step 3: Verify AlertLog Table Exists

Create a temporary SQL file to check:

```powershell
echo "SELECT 1 FROM `"AlertLog`" LIMIT 1;" | Out-File -Encoding utf8 check_alertlog.sql
npx prisma db execute --file check_alertlog.sql --schema ./prisma/schema.prisma
Remove-Item check_alertlog.sql
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Executed SQL file.
```

**Alternative (if above doesn't work):**

```powershell
npx prisma studio --browser none
```

Then manually check the `AlertLog` table in Prisma Studio.

---

### Step 4: Verify Migration Status

```powershell
npx prisma migrate status --schema ./prisma/schema.prisma
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech"

9 migrations found in prisma/migrations
Database schema is up to date!

All migrations have been successfully applied.
```

---

## If Something Fails

### If Step 1 fails with "Migration not found":
- Check the exact folder name: `Get-ChildItem prisma\migrations | Select-Object Name`
- Use the exact folder name (without path)

### If Step 2 fails with "Migration already applied":
- This is safe - it means AlertLog already exists
- Skip to Step 3 to verify

### If Step 2 fails with connection/auth error:
- Check `DATABASE_URL` in `.env` matches your Neon project
- Ensure you're using the **pooler** URL (with `-pooler` in hostname)
- Verify credentials are correct

### If AlertLog verification fails:
- Check Prisma Studio: `npx prisma studio`
- Look for `AlertLog` table in the list
- If missing, re-run Step 2

---

## Environment Alignment Check

**Important:** Ensure Prisma CLI and Next.js app use the **same database**:

1. **Prisma CLI** reads from `web/.env`:
   - `DATABASE_URL` = pooler URL (for app)
   - `DIRECT_URL` = direct URL (for migrations)

2. **Next.js app** reads from `web/.env.local` (if exists, overrides `.env`):
   - Must have same `DATABASE_URL` as `.env`
   - Should point to same Neon project

**To verify alignment:**
```powershell
# Check .env DATABASE_URL
Select-String -Path .env -Pattern "DATABASE_URL"

# Check .env.local DATABASE_URL (if exists)
if (Test-Path .env.local) { Select-String -Path .env.local -Pattern "DATABASE_URL" }
```

**Both should point to the same Neon project** (same hostname, same database name).

---

## Complete Command Sequence

Run these in order:

```powershell
# 1. Mark isTest migration as applied
npx prisma migrate resolve --schema ./prisma/schema.prisma --applied 20251226030326_add_user_isTest

# 2. Deploy AlertLog migration
npx prisma migrate deploy --schema ./prisma/schema.prisma

# 3. Verify status
npx prisma migrate status --schema ./prisma/schema.prisma

# 4. Generate Prisma client
npx prisma generate
```

After these steps, `/api/cron/kpi-alert` should work correctly.

