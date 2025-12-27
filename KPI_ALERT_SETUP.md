# KPI Alert System - Complete Setup Guide

## Prerequisites

### 1. Environment Variables

**Local (.env.local):**
```bash
# Database URLs (Neon)
DATABASE_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Cron Security
CRON_SECRET="your-strong-random-secret-here"

# Email (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="onboarding@resend.dev"  # or your verified domain
ADMIN_ALERT_EMAIL="admin@example.com"  # or use ADMIN_EMAIL
```

**Production (Vercel):**
Add the same variables in Vercel Dashboard → Settings → Environment Variables

**Key Point:** `DIRECT_URL` is the same as `DATABASE_URL` but with `-pooler` removed from the hostname.

### 2. Verify Prisma Schema

The `AlertLog` model should be in `web/prisma/schema.prisma`:

```prisma
model AlertLog {
  id          String   @id @default(cuid())
  key         String   // e.g. "kpi-health"
  date        String   // "YYYY-MM-DD" in LA timezone
  sentAt      DateTime @default(now())
  payloadJson Json     // Store alert payload for audit

  @@unique([key, date])
  @@index([key, date])
}
```

## Migration Steps

### Local Development

```bash
cd web

# 1. Validate schema (checks DIRECT_URL is set)
npx prisma validate

# 2. Create and apply migration
npx prisma migrate dev --name add_alert_log

# 3. Generate Prisma client
npx prisma generate
```

**Expected output:**
- Migration file created in `prisma/migrations/`
- Database table `AlertLog` created
- Prisma client regenerated

### Production (Vercel)

```bash
cd web

# 1. Deploy migration (uses DIRECT_URL from Vercel env)
npx prisma migrate deploy

# 2. Generate Prisma client
npx prisma generate
```

**Note:** In Vercel, migrations typically run during build. You can also run manually via Vercel CLI or dashboard.

## Vercel.json Placement

**Important:** The `vercel.json` file location depends on your Vercel project root:

### If Vercel project root = `/web` (current setup)
- ✅ Keep `web/vercel.json` (already correct)
- Cron config will be found automatically

### If Vercel project root = repo root (`/`)
- ❌ Move `web/vercel.json` → `vercel.json` (repo root)
- Or configure Vercel to use `/web` as root directory

**To check:** Go to Vercel Dashboard → Your Project → Settings → General → Root Directory

**Current setup:** `web/vercel.json` exists, so if your Vercel root is `/web`, you're good.

## Testing

### 1. Test KPI Health Endpoint (as OWNER)

**Browser (logged in as OWNER):**
```
GET http://localhost:3000/api/admin/kpi-health
```

**Expected Response:**
```json
{
  "window": {
    "startAtISO": "2024-01-15T00:00:00.000Z",
    "endAtISO": "2024-01-22T12:00:00.000Z"
  },
  "krs": {
    "freeCuts7d": 5,
    "secondCuts7d": 3,
    "newMembers7d": 2,
    "freeToMember7d": 40.0,
    "needsAttentionNow": 0
  },
  "thresholds": {
    "freeToMemberMin": 15,
    "needsAttentionMax": 0
  },
  "breaches": [],
  "ok": true
}
```

**Verify:**
- ✅ Returns 200
- ✅ All 5 KRs present
- ✅ `ok: true` if no breaches, `ok: false` if breaches exist
- ✅ `breaches` array shows threshold violations

### 2. Test Cron Endpoint (Simulation)

**First call (should process):**
```bash
curl -i "http://localhost:3000/api/cron/kpi-alert" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Expected if OK (no breaches):**
```json
{
  "sent": false,
  "reason": "ok",
  "date": "2024-01-22"
}
```

**Expected if breaches exist:**
```json
{
  "sent": true,
  "date": "2024-01-22",
  "breaches": 2
}
```

**Expected if already sent today:**
```json
{
  "sent": false,
  "reason": "already_sent",
  "date": "2024-01-22"
}
```

**Expected if missing/invalid secret:**
```json
{
  "error": "Missing or invalid authorization header"
}
```
Status: 401

**Expected if AlertLog table missing:**
```json
{
  "error": "AlertLog not migrated. Run prisma migrate deploy.",
  "message": "The AlertLog table does not exist. Please run the database migration."
}
```
Status: 500

### 3. Verify Idempotency (Duplicate Prevention)

```bash
# First call
curl -i "http://localhost:3000/api/cron/kpi-alert" \
  -H "Authorization: Bearer $CRON_SECRET"

# Second call immediately after (should return already_sent)
curl -i "http://localhost:3000/api/cron/kpi-alert" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Verify:**
- ✅ First call creates `AlertLog` row
- ✅ Second call returns `{ "sent": false, "reason": "already_sent" }`
- ✅ Only one `AlertLog` row per day (check database)

### 4. Verify Database

**Using Prisma Studio:**
```bash
cd web
npx prisma studio
```

Navigate to `AlertLog` table and verify:
- ✅ Table exists
- ✅ Columns: `id`, `key`, `date`, `sentAt`, `payloadJson`
- ✅ Unique constraint on `[key, date]` works

**Using SQL:**
```sql
SELECT * FROM "AlertLog" 
WHERE key = 'kpi-health' 
ORDER BY "sentAt" DESC 
LIMIT 10;
```

## Production Deployment Checklist

1. ✅ **Set Environment Variables in Vercel:**
   - `DATABASE_URL` (pooler)
   - `DIRECT_URL` (direct, no `-pooler`)
   - `CRON_SECRET` (strong random string)
   - `RESEND_API_KEY`
   - `ADMIN_ALERT_EMAIL`
   - `EMAIL_FROM`

2. ✅ **Run Migration:**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. ✅ **Verify Vercel.json:**
   - Check Vercel project root directory setting
   - Ensure `vercel.json` is in correct location
   - Cron schedule: `0 17 * * *` (9:00 AM Pacific)

4. ✅ **Test Cron Manually:**
   - Vercel Dashboard → Your Project → Cron Jobs
   - Click "Run Now" to test
   - Check logs for errors

5. ✅ **Monitor:**
   - Check `AlertLog` table daily
   - Verify emails arrive at `ADMIN_ALERT_EMAIL`
   - Check Vercel function logs for errors

## Troubleshooting

### Error: "Environment variable not found: DIRECT_URL"
**Fix:** Add `DIRECT_URL` to `.env.local` (local) or Vercel env vars (production)

### Error: "AlertLog not migrated. Run prisma migrate deploy."
**Fix:** Run migration commands above. The runtime guard detected missing table.

### Cron doesn't run
**Check:**
1. Vercel.json location matches project root
2. Cron schedule is correct (`0 17 * * *`)
3. Vercel project has cron jobs enabled
4. Check Vercel function logs

### Email not sending
**Check:**
1. `RESEND_API_KEY` is set and valid
2. `ADMIN_ALERT_EMAIL` is set
3. `EMAIL_FROM` is verified in Resend
4. Check Resend dashboard for delivery status

## Quick Reference

**Migration:**
```bash
npx prisma migrate dev --name add_alert_log  # Local
npx prisma migrate deploy                    # Production
npx prisma generate                          # Both
```

**Test Endpoints:**
```bash
# KPI Health (browser, as OWNER)
GET /api/admin/kpi-health

# Cron (curl)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/kpi-alert
```

**Database Check:**
```bash
npx prisma studio  # Visual
# Or SQL: SELECT * FROM "AlertLog";
```

