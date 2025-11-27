# 🔧 Login Database Path Fix

## Issue Description

**WHAT**: Browser login fails with `Error code 14: Unable to open the database file` when `authorize()` calls `prisma.user.findMany()` in `findUserByEmailInsensitive()`.

**WHERE**: 
- Route: `/api/auth/callback/credentials` (NextAuth)
- Function: `authorize()` in `web/src/lib/auth-options.ts`
- Helper: `findUserByEmailInsensitive()` in `web/src/lib/auth-utils.ts`
- Database call: `prisma.user.findMany()` in `web/src/lib/db.ts`

**SINCE WHEN**: This is a path resolution issue - CLI scripts work because they run from `web/` directory, but Next.js server resolves relative paths differently.

## Root Cause

**Expected**: `DATABASE_URL="file:./prisma/dev.db"` should resolve to the same absolute path in both CLI and Next.js contexts.

**Actual**: 
- CLI scripts (running from `web/`): `file:./prisma/dev.db` → `C:\dev\La Fade\h\LeFade\web\prisma\dev.db` ✅
- Next.js server: `file:./prisma/dev.db` → might resolve relative to a different working directory → wrong path ❌

**Where it diverges**: PrismaClient initialization in `web/src/lib/db.ts` uses `process.env.DATABASE_URL` directly without normalizing relative paths. When Next.js server runs, `process.cwd()` might differ, causing SQLite to look for the database in the wrong location.

## Fix

### Code Changes

**File**: `web/src/lib/db.ts`

```typescript
import { PrismaClient } from "@prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Normalizes DATABASE_URL to absolute path for SQLite.
 * Fixes "Error code 14: Unable to open the database file" when
 * relative paths resolve differently in CLI vs Next.js server context.
 */
function normalizeDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Only normalize SQLite file: URLs with relative paths
  if (dbUrl.startsWith("file:./") || dbUrl.startsWith("file:../")) {
    // Extract the relative path (e.g., "./prisma/dev.db")
    const relativePath = dbUrl.replace(/^file:/, "");
    
    // Resolve relative to project root (web/ directory)
    // process.cwd() in Next.js should be the project root
    const absolutePath = path.resolve(process.cwd(), relativePath);
    
    // Convert Windows backslashes to forward slashes for SQLite
    const normalizedPath = absolutePath.replace(/\\/g, "/");
    
    console.log("[db] Normalized DATABASE_URL:", {
      original: dbUrl,
      absolute: `file:${normalizedPath}`,
    });
    
    return `file:${normalizedPath}`;
  }

  // Return as-is for absolute paths or PostgreSQL URLs
  return dbUrl;
}

// Normalize DATABASE_URL before creating PrismaClient
const normalizedDbUrl = normalizeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: normalizedDbUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### What This Does

1. **Normalizes relative paths**: Converts `file:./prisma/dev.db` to absolute path `file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db`
2. **Works in both contexts**: CLI and Next.js server both get the same absolute path
3. **Preserves other URLs**: PostgreSQL URLs and absolute paths pass through unchanged
4. **Logs the normalization**: Helps debug path resolution issues

## Test Steps

1. **Restart dev server** (required for code changes):
   ```powershell
   # Stop current server (Ctrl+C)
   cd web
   pnpm dev
   ```

2. **Watch terminal logs** - should see:
   ```
   [db] Normalized DATABASE_URL: { original: 'file:./prisma/dev.db', absolute: 'file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db' }
   ```

3. **Test browser login**:
   - Go to `http://localhost:3000/login`
   - Email: `hussemuya.hm.hm@gmail.com`
   - Password: `LaFadeOwner123`
   - Should work now!

4. **Verify logs** - should see:
   ```
   [auth] authorize() called { hasEmail: true, hasPassword: true, ... }
   [auth] verifyCredentials: starting verification
   [auth] findUserByEmailInsensitive: looking for hussemuya.hm.hm@gmail.com
   [auth] findUserByEmailInsensitive: checked X users
   [auth] findUserByEmailInsensitive: matched DB email ...
   [auth] verifyCredentials: SUCCESS
   ```

## Files Touched

- `web/src/lib/db.ts` - Added `normalizeDatabaseUrl()` function and used normalized URL in PrismaClient initialization

## Sync Note for ChatGPT

**Files touched**: `web/src/lib/db.ts`

**Bug description**: Browser login fails with "Error code 14: Unable to open the database file" because `DATABASE_URL="file:./prisma/dev.db"` (relative path) resolves differently in CLI scripts vs Next.js server context. CLI works because it runs from `web/` directory, but Next.js server might resolve the path relative to a different working directory, causing SQLite to look for the database file in the wrong location.

**Fix description**: Added `normalizeDatabaseUrl()` function that converts relative SQLite paths to absolute paths using `path.resolve(process.cwd(), relativePath)`. This ensures both CLI and Next.js server use the same absolute path. The normalized URL is passed to PrismaClient via `datasources.db.url` option. The function only normalizes relative `file:` URLs, leaving absolute paths and PostgreSQL URLs unchanged.

**Assumptions**: `process.cwd()` in Next.js server context is the project root (`web/` directory). This is standard Next.js behavior.




