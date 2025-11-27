# Login Issue: Diagnosis & Fix

## Issue Summary

**WHAT**: Browser login fails with `Error code 14: Unable to open the database file` when NextAuth's `authorize()` function tries to query the database via `prisma.user.findMany()`.

**WHERE**: 
- Route: `/api/auth/callback/credentials` (NextAuth endpoint)
- Component: `web/src/app/login/LoginForm.tsx` calls `signIn("credentials", ...)`
- Auth: `web/src/lib/auth-options.ts` → `authorize()` → `verifyCredentials()`
- Helper: `web/src/lib/auth-utils.ts` → `findUserByEmailInsensitive()` → `prisma.user.findMany()`
- Database: `web/src/lib/db.ts` → PrismaClient initialization

**SINCE WHEN**: Path resolution issue - CLI scripts work, browser doesn't. This is a working directory context problem.

## Root Cause Explanation

### Expected Behavior
1. User submits login form → `signIn("credentials", { email, password })`
2. NextAuth calls `authorize()` in `auth-options.ts`
3. `authorize()` calls `verifyCredentials()` from `auth-utils.ts`
4. `verifyCredentials()` calls `findUserByEmailInsensitive()`
5. `findUserByEmailInsensitive()` calls `prisma.user.findMany()`
6. PrismaClient uses `DATABASE_URL="file:./prisma/dev.db"` to connect
7. Database query succeeds, user is authenticated

### Actual Behavior
Steps 1-5 work correctly. Step 6 fails:
- PrismaClient tries to open `file:./prisma/dev.db` (relative path)
- In CLI context: resolves to `C:\dev\La Fade\h\LeFade\web\prisma\dev.db` ✅
- In Next.js server context: resolves to wrong path (possibly `C:\dev\La Fade\h\LeFade\prisma\dev.db` or similar) ❌
- SQLite cannot find the file → `Error code 14: Unable to open the database file`
- `findUserByEmailInsensitive()` throws error → `authorize()` returns `null` → 401 error

### Where It Diverges
The issue is in `web/src/lib/db.ts` where PrismaClient is initialized. It uses `process.env.DATABASE_URL` directly without normalizing relative paths. When Next.js server runs, `process.cwd()` might be different from where CLI scripts run, causing the relative path `file:./prisma/dev.db` to resolve incorrectly.

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

1. **Normalizes relative paths**: Converts `file:./prisma/dev.db` → `file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db`
2. **Works in both contexts**: CLI and Next.js server both get the same absolute path
3. **Preserves other URLs**: PostgreSQL URLs and absolute paths pass through unchanged
4. **Logs normalization**: Helps debug path resolution issues

## Test Steps

1. **Restart dev server** (required):
   ```powershell
   # Stop current server (Ctrl+C)
   cd web
   pnpm dev
   ```

2. **Watch terminal** - should see:
   ```
   [db] Normalized DATABASE_URL: { original: 'file:./prisma/dev.db', absolute: 'file:C:/dev/La Fade/h/LeFade/web/prisma/dev.db' }
   ```

3. **Test browser login**:
   - Go to `http://localhost:3000/login`
   - Email: `hussemuya.hm.hm@gmail.com`
   - Password: `LaFadeOwner123`
   - Should work!

4. **Verify success logs**:
   ```
   [auth] authorize() called { hasEmail: true, hasPassword: true, ... }
   [auth] verifyCredentials: starting verification
   [auth] findUserByEmailInsensitive: matched DB email
   [auth] verifyCredentials: SUCCESS
   [auth] authorize() SUCCESS: returning user
   ```

## Files Touched

- `web/src/lib/db.ts` - Added `normalizeDatabaseUrl()` and used normalized URL in PrismaClient

## Sync Note for ChatGPT

**Files touched**: `web/src/lib/db.ts`

**Bug description**: Browser login fails with "Error code 14: Unable to open the database file" because `DATABASE_URL="file:./prisma/dev.db"` (relative path) resolves differently in CLI scripts vs Next.js server context. CLI works because it runs from `web/` directory, but Next.js server might resolve the path relative to a different working directory, causing SQLite to look for the database file in the wrong location.

**Fix description**: Added `normalizeDatabaseUrl()` function that converts relative SQLite paths to absolute paths using `path.resolve(process.cwd(), relativePath)`. This ensures both CLI and Next.js server use the same absolute path. The normalized URL is passed to PrismaClient via `datasources.db.url` option. The function only normalizes relative `file:` URLs, leaving absolute paths and PostgreSQL URLs unchanged.

**Assumptions**: `process.cwd()` in Next.js server context is the project root (`web/` directory). This is standard Next.js behavior.




