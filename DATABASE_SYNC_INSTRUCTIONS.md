# Database Sync Instructions

## Step 1: Fix DATABASE_URL in Both Env Files

### In `web/.env.local` (or `web/.env`):
```env
DATABASE_URL="file:./prisma/dev.db"
```

### In `web/prisma/.env` (create if it doesn't exist):
```env
DATABASE_URL="file:./prisma/dev.db"
```

**Important**: 
- No `postgresql://` anywhere
- No second `DATABASE_URL` line hiding below
- Path is relative to `web/` directory

## Step 2: Regenerate + Push Once

From `web/` directory:

```bash
pnpm prisma generate
pnpm prisma db push
pnpm prisma studio
```

## Step 3: Verify Sync

1. With Prisma Studio open, sign up a brand-new user in the app
2. Refresh Prisma Studio → you should see a row appear in the User table
3. If you don't see it, the app is still using a different DATABASE_URL

## Step 4: Remove Duplicate Database

If you see `web/prisma/prisma/dev.db`, remove it:
```bash
rm -rf web/prisma/prisma/dev.db
```

Only keep `web/prisma/dev.db`.

## Troubleshooting

If the app and Prisma Studio show different data:
1. Check `web/.env.local` has `DATABASE_URL="file:./prisma/dev.db"`
2. Check `web/prisma/.env` has `DATABASE_URL="file:./prisma/dev.db"`
3. Restart dev server after changing env files
4. Verify no duplicate `DATABASE_URL` lines in env files




