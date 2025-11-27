# Prisma Environment Variables

**DO NOT create `prisma/.env` file.**

## Why?

Prisma CLI looks for `.env` files starting from the directory containing `schema.prisma`. If `prisma/.env` exists, Prisma will use it instead of `/web/.env`, which causes conflicts.

## Where to put DATABASE_URL

- ✅ **Use `/web/.env`** - This is the single source of truth for DATABASE_URL
- ❌ **Do NOT use `prisma/.env`** - It will override `/web/.env` and break Prisma CLI commands

## If you see "Environment variable not found: DATABASE_URL"

1. Check that `/web/.env` exists and contains `DATABASE_URL="file:./prisma/dev.db"`
2. Check that `prisma/.env` does NOT exist (delete it if it does)
3. Run Prisma commands from `/web` directory: `cd web && pnpm prisma migrate dev`

## Note about `.env.backup`

The file `prisma/.env.backup` exists as a backup but is NOT used by Prisma CLI. It's safe to leave it or delete it.




