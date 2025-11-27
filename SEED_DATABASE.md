# Seeding the Database

## ⚠️ Important: Close Prisma Studio First!

The database file is **locked** while Prisma Studio is running. You must close Prisma Studio before running seed scripts.

## What Should Be in the Database?

After seeding, you should have:

1. **Users**:
   - At least 1 barber user (from `BARBER_EMAIL` env var)
   - Or 2 barbers (Mike, Alex) if running seed-reviews

2. **Availability**:
   - Time slots for the barber(s) on specific dates

3. **Reviews** (optional):
   - 5 sample reviews if running seed-reviews script

## How to Seed

### Step 1: Close Prisma Studio
- Close the Prisma Studio window/tab
- Make sure the process is fully stopped

### Step 2: Run Seed Script

**Option A: Basic Seed (barber + availability)**
```powershell
cd web
pnpm prisma:seed
```

**Option B: Seed with Reviews (barbers + reviews)**
```powershell
cd web
pnpm seed:reviews
```

### Step 3: Verify in Prisma Studio

1. Open Prisma Studio again:
   ```powershell
   pnpm prisma studio
   ```

2. Check the tables:
   - **User** table should have at least 1 barber
   - **Availability** table should have time slots
   - **Review** table should have 5 reviews (if you ran seed-reviews)

## Troubleshooting

### Error: "Unable to open the database file"
- **Cause**: Prisma Studio or another process has the database locked
- **Fix**: Close Prisma Studio completely, then try again

### Error: "DATABASE_URL not found"
- **Cause**: Environment variable not set
- **Fix**: Make sure `.env.local` exists with `DATABASE_URL="file:./prisma/dev.db"`

### Database Still Empty After Seed
- Check seed script output for errors
- Verify DATABASE_URL is correct
- Make sure you're looking at the right database file

## Current Status

Your database is currently **empty** because:
- Seed scripts haven't been run yet, OR
- Database was reset/recreated

**Next Step**: Close Prisma Studio and run the seed script!




