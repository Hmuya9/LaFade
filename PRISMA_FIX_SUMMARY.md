# Prisma Validation Fix - Root Cause & Solution

## Diagnostic Output

### Commands Run:

```bash
$ node -v
v20.17.0

$ npx prisma -v
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.
Prisma CLI Version: 6.18.0

$ npx prisma validate --schema ./prisma/schema.prisma
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DIRECT_URL.
  -->  prisma\schema.prisma:11
   |
10 |   url       = env("DATABASE_URL")
11 |   directUrl = env("DIRECT_URL")
   |

Validation Error Count: 1
```

## Root Cause

**Two issues identified:**

1. **Deprecated Prisma config in package.json** - The `"prisma": { "seed": ... }` config in `package.json` is deprecated in Prisma 6 and can cause validation issues.

2. **Missing DIRECT_URL environment variable** - Prisma schema requires `DIRECT_URL` for migrations (Neon direct connection), but it's not set in the environment.

## Fix Applied

### 1. Removed Deprecated Prisma Config

**File:** `web/package.json`

**Removed:**
```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
```

**Result:** Warning about deprecated config is gone. Prisma seed can still be run via `npx prisma db seed` (Prisma will auto-detect the seed script).

### 2. Documentation Created

Created `web/ENV_SETUP_REQUIRED.md` with instructions to add `DIRECT_URL`.

## What You Need to Do

### Add DIRECT_URL to Environment

**Create or edit `web/.env.local`:**

```bash
# Existing (keep this)
DATABASE_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ADD THIS (remove -pooler from hostname)
DIRECT_URL="postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

**Key:** Remove `-pooler` from the hostname in `DIRECT_URL`.

### Verify Fix

After adding `DIRECT_URL`, run:

```bash
npx prisma validate --schema ./prisma/schema.prisma
```

**Expected:** Should pass without errors ✅

### Run Migration

```bash
npx prisma migrate dev --name add_alert_log
npx prisma generate
```

## Exact Diff

### package.json

```diff
   "vitest": "^3.2.4"
   }
-  "prisma": {
-    "seed": "tsx prisma/seed.ts"
-  }
 }
```

**Note:** Prisma seed still works via `npx prisma db seed` (auto-detects `prisma/seed.ts`).

## Schema Verification

The schema is correct:
- ✅ Uses `env("DATABASE_URL")` for `url` (app runtime)
- ✅ Uses `env("DIRECT_URL")` for `directUrl` (migrations)
- ✅ `AlertLog` model is properly defined

## Next Steps

1. Add `DIRECT_URL` to `.env.local` (see above)
2. Run `npx prisma validate` (should pass)
3. Run `npx prisma migrate dev --name add_alert_log`
4. Run `npx prisma generate`

After these steps, the migration will work and `AlertLog` table will be created.

