# KPI Alert System - Fix Summary

## Issues Fixed

1. ✅ **Runtime Guard Added** - Cron endpoint now detects missing `AlertLog` table and returns clear error
2. ✅ **Documentation Created** - Migration setup and testing guides
3. ✅ **Schema Validated** - `AlertLog` model is correctly defined

## What You Need to Do

### Step 1: Set DIRECT_URL

**In `web/.env.local` (or Vercel env for production):**

```bash
# Your existing pooler URL
DATABASE_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# NEW: Direct URL (remove "-pooler" from hostname)
DIRECT_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

**Key difference:** Remove `-pooler` from the hostname in `DIRECT_URL`.

### Step 2: Run Migration

**Local:**
```bash
cd web

# Validate (should pass now with DIRECT_URL set)
npx prisma validate

# Create and apply migration
npx prisma migrate dev --name add_alert_log

# Generate client
npx prisma generate
```

**Production (Vercel):**
```bash
cd web

# Deploy migration
npx prisma migrate deploy

# Generate client  
npx prisma generate
```

### Step 3: Verify Vercel.json Location

**Check Vercel Dashboard:**
- Settings → General → Root Directory
- If root = `/web` → `web/vercel.json` is correct ✅
- If root = `/` → Move `web/vercel.json` to repo root

**Current:** `web/vercel.json` exists (correct if Vercel root is `/web`)

## Testing Commands

### 1. Test KPI Health Endpoint

**As OWNER (browser session):**
```
GET http://localhost:3000/api/admin/kpi-health
```

**Expected:** JSON with `krs`, `breaches`, `ok` status

### 2. Test Cron Endpoint

```bash
# Set CRON_SECRET in .env.local first
export CRON_SECRET="your-secret-here"

# Test cron
curl -i "http://localhost:3000/api/cron/kpi-alert" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Expected responses:**
- `{ "sent": false, "reason": "ok" }` - No breaches
- `{ "sent": true, "date": "YYYY-MM-DD" }` - Breaches exist, email sent
- `{ "sent": false, "reason": "already_sent" }` - Second call same day
- `{ "error": "AlertLog not migrated..." }` - Table missing (500)

### 3. Verify Idempotency

```bash
# First call
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/kpi-alert

# Second call (should return already_sent)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/kpi-alert
```

### 4. Check Database

```bash
cd web
npx prisma studio
```

Navigate to `AlertLog` table - should see entries after cron runs.

## Files Modified

1. ✅ `web/src/app/api/cron/kpi-alert/route.ts` - Added runtime guard
2. ✅ `web/MIGRATION_SETUP.md` - Migration documentation
3. ✅ `web/KPI_ALERT_SETUP.md` - Complete setup guide

## Next Steps

1. **Set DIRECT_URL** in `.env.local` and Vercel
2. **Run migration** (`npx prisma migrate dev --name add_alert_log`)
3. **Test endpoints** using commands above
4. **Deploy to production** and verify cron runs

## Runtime Guard Behavior

The cron endpoint now checks if `AlertLog` table exists before processing:

- ✅ **Table exists:** Normal processing
- ❌ **Table missing:** Returns 500 with clear message: "AlertLog not migrated. Run prisma migrate deploy."

This prevents silent failures and makes it obvious when migration hasn't run.

