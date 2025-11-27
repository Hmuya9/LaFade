# Environment Setup Fix - Sync Note

## Problem Summary

Prisma CLI was failing with:
```
Error: Environment variable not found: DATABASE_URL
Error code: P1012
```

The issue was that Prisma CLI looks for `.env` files starting from the directory containing `schema.prisma` (`prisma/.env`). If `prisma/.env` exists (or existed), Prisma would try to load from it instead of `/web/.env`, causing conflicts.

## BEFORE vs AFTER

### BEFORE
- `/web/.env` existed with `DATABASE_URL="file:./prisma/dev.db"`
- `/web/.env.local` existed with `DATABASE_URL` and other secrets
- `prisma/.env` may have existed or was being looked for (causing the error)
- Prisma CLI was loading from `prisma/.env` (or couldn't find DATABASE_URL)

### AFTER
- `/web/.env` contains `DATABASE_URL="file:./prisma/dev.db"` with clear documentation
- `/web/.env.local` contains secrets and overrides (unchanged)
- `prisma/.env` does NOT exist (only `prisma/.env.backup` exists as a backup)
- Prisma CLI now loads from `/web/.env` correctly
- Added `prisma/README_ENV.md` documenting the env file behavior

## What Was Fixed

1. **Updated `/web/.env` comments** to accurately explain Prisma CLI's behavior:
   - Prisma looks for `.env` files starting from the directory containing `schema.prisma`
   - If `prisma/.env` exists, it overrides `/web/.env` (which causes conflicts)
   - This file (`/web/.env`) is now the PRIMARY source for DATABASE_URL

2. **Created `prisma/README_ENV.md`** to document:
   - Why `prisma/.env` should NOT be created
   - Where to put DATABASE_URL (`/web/.env`)
   - How to troubleshoot "DATABASE_URL not found" errors

3. **Verified Prisma CLI behavior**:
   - `pnpm prisma validate` confirms it loads from `/web/.env`
   - Output shows: "Environment variables loaded from .env"

## Files Changed

- ✅ `/web/.env` - Updated comments for clarity
- ✅ `/web/prisma/README_ENV.md` - New documentation file
- ✅ No changes to `/web/.env.local` (unchanged)
- ✅ `prisma/.env.backup` - Left as-is (not used by Prisma CLI)

## Commands to Run

### Apply migrations:
```bash
cd web
pnpm prisma migrate dev --name add_barber_availability
```

Or use the package.json script:
```bash
cd web
pnpm prisma:migrate --name add_barber_availability
```

### Generate Prisma Client:
```bash
cd web
pnpm prisma generate
```

### Start dev server:
```bash
cd web
pnpm dev
```

## Important Notes

1. **Never create `prisma/.env`** - It will override `/web/.env` and break Prisma CLI commands. Use `/web/.env` instead.

2. **DATABASE_URL location**: Always defined in `/web/.env`. The path `"file:./prisma/dev.db"` is relative to `/web/` directory.

3. **Next.js vs Prisma**:
   - Next.js reads `.env` then `.env.local` (`.env.local` overrides `.env`)
   - Prisma CLI reads `.env` files starting from the `schema.prisma` directory, then walks up the tree
   - Both use `/web/.env` as the primary source

4. **Future Postgres migration**: When moving to Postgres, update `DATABASE_URL` in `/web/.env` (and Vercel env vars for production), NOT in `prisma/.env`.

5. **Schema drift**: The migration command may show schema drift warnings. That's a separate issue from the DATABASE_URL env loading, which is now fixed.

## Verification

To verify the fix works:
```bash
cd web
pnpm prisma validate
# Should show: "Environment variables loaded from .env"
# Should show: "The schema at prisma\schema.prisma is valid 🚀"
```




