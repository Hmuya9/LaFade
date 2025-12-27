# Required Environment Variables

## Issue

Prisma validation fails because `DIRECT_URL` is not set in your environment.

## Fix

Add `DIRECT_URL` to your environment file:

### If using `.env.local` (recommended for local dev):

Create or edit `web/.env.local` and add:

```bash
# Your existing DATABASE_URL (pooler)
DATABASE_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# NEW: DIRECT_URL (direct connection, remove -pooler from hostname)
DIRECT_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### If using `.env`:

Add `DIRECT_URL` to `web/.env` with the same value (direct URL without `-pooler`).

## Key Difference

- **DATABASE_URL**: Contains `-pooler` in hostname (for app runtime)
- **DIRECT_URL**: Same URL but **remove `-pooler`** from hostname (for migrations)

## After Adding DIRECT_URL

Run:
```bash
npx prisma validate --schema ./prisma/schema.prisma
```

Should now pass ✅

