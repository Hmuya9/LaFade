# Database Migration Setup for KPI Alerts

## Problem

Prisma migrations with Neon require a **direct (non-pooler) connection** because migrations need transaction support that poolers don't provide.

## Solution

You need **two** database URLs:

1. **DATABASE_URL** - Pooler URL (for app runtime)
2. **DIRECT_URL** - Direct URL (for migrations)

## Configuration

### Local Development (.env.local)

```bash
# Pooler URL (for app)
DATABASE_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Direct URL (for migrations) - remove "-pooler" from hostname
DIRECT_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### Production (Vercel Environment Variables)

Add both variables in Vercel dashboard:
- `DATABASE_URL` = Pooler URL
- `DIRECT_URL` = Direct URL (same as above, without `-pooler`)

## How to Get Direct URL from Neon

1. Go to Neon Dashboard → Your Project
2. Click "Connection Details"
3. Look for "Connection string" section
4. Select "Direct connection" (not "Pooled connection")
5. Copy the connection string → This is your `DIRECT_URL`

**Key difference:**
- Pooler: `...-pooler.c-2.us-west-2.aws.neon.tech...`
- Direct: `...c-2.us-west-2.aws.neon.tech...` (no `-pooler`)

## Migration Commands

### Local Development

```bash
cd web

# Validate schema (checks DIRECT_URL is set)
npx prisma validate

# Create and apply migration
npx prisma migrate dev --name add_alert_log

# Generate Prisma client
npx prisma generate
```

### Production (Vercel)

```bash
cd web

# Deploy migration (uses DIRECT_URL)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

## Verification

After migration, verify the table exists:

```bash
# Using Prisma Studio
npx prisma studio

# Or using SQL
# Check that AlertLog table exists with columns: id, key, date, sentAt, payloadJson
```

## Troubleshooting

### Error: "Environment variable not found: DIRECT_URL"

**Fix:** Add `DIRECT_URL` to your `.env.local` (local) or Vercel env vars (production)

### Error: "relation 'AlertLog' does not exist"

**Fix:** Run `npx prisma migrate deploy` (production) or `npx prisma migrate dev` (local)

### Cron endpoint returns 500: "AlertLog not migrated"

**Fix:** The runtime guard detected missing table. Run the migration commands above.

## Notes

- **App runtime** uses `DATABASE_URL` (pooler) for better connection management
- **Migrations** use `DIRECT_URL` (direct) for transaction support
- Both URLs point to the same database, just different connection methods
- Never commit `.env.local` to git (already in `.gitignore`)

