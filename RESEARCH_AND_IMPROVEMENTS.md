# Research & Code Improvement Recommendations

## Answers to Your Three Questions

### 1. What stack and frameworks are you using?

**Current Stack:**
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Authentication**: NextAuth.js v4.24.13
- **Database**: Prisma ORM with SQLite (dev) / PostgreSQL (production-ready)
- **Password Hashing**: bcryptjs v3.0.3
- **Email**: Resend API
- **Payments**: Stripe
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **Form Handling**: React Hook Form + Zod validation
- **Real-time**: Pusher (for barber dashboard)

### 2. Are you specifically focused on the auth layer or surrounding functionality?

**Primary Focus: Authentication Layer** (based on current issues):
- ✅ Credentials provider (email + password)
- ✅ Email provider (magic links)
- ✅ Role-based access control (CLIENT, BARBER, OWNER)
- ✅ Password reset flow (forgot-password, reset-password)
- ✅ Session management (JWT strategy)
- ✅ Middleware route protection

**Secondary Focus:**
- Role-based UI rendering (Navbar)
- Server-side role checks
- Email normalization and case-insensitive lookups

### 3. Any specific features you want better implementations for?

**Critical Issues to Improve:**
1. **Case-insensitive email lookup** (SQLite compatibility) - ✅ Currently fixing
2. **Error handling in authorize()** - ✅ Currently improving
3. **Password hash validation** - ✅ Currently adding
4. **Session/JWT callback robustness** - ✅ Currently enhancing

**Features That Could Be Enhanced:**
- Magic link email templates (currently basic)
- Password reset token expiration handling
- Rate limiting for login attempts
- Two-factor authentication (future)
- Social auth providers (OAuth - future)

---

## Research-Backed Recommendations

### 1. NextAuth.js Best Practices (2024)

#### A. Enhanced Error Handling Pattern

**Current Issue**: Basic error handling in `authorize()`

**Recommended Pattern** (from NextAuth.js community best practices):

```typescript
// Better error handling with CredentialsSignin
import { CredentialsSignin } from "next-auth";

async authorize(credentials) {
  try {
    // ... validation logic
    
    if (!user) {
      throw new CredentialsSignin("Invalid email or password");
    }
    
    if (!isValid) {
      throw new CredentialsSignin("Invalid email or password");
    }
    
    return result;
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      throw error; // Re-throw to show user-friendly message
    }
    console.error("[auth] Unexpected error:", error);
    throw new CredentialsSignin("An error occurred during sign in");
  }
}
```

**Why**: `CredentialsSignin` provides better error messages to users vs returning `null`.

#### B. Rate Limiting for Login Attempts

**Recommended**: Add rate limiting to prevent brute force attacks:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
  analytics: true,
});

// In authorize():
const identifier = normalizeEmail(credentials.email);
const { success } = await loginRateLimit.limit(identifier);

if (!success) {
  throw new CredentialsSignin("Too many login attempts. Please try again later.");
}
```

**Why**: Prevents brute force attacks and improves security.

#### C. Email Normalization at Database Level

**Current**: Normalizing in application code (good, but can be better)

**Recommended**: Add a computed field or trigger:

```prisma
// In schema.prisma - add emailLower field
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  emailLower    String?   @unique // Normalized email for lookups
  // ... rest
}

// Migration to populate existing:
// UPDATE User SET emailLower = LOWER(email) WHERE email IS NOT NULL;
```

Then in `findUserByEmailInsensitive`:
```typescript
// Fast indexed lookup instead of fetching all users
const user = await prisma.user.findUnique({
  where: { emailLower: normalizeEmail(rawEmail) },
});
```

**Why**: O(1) lookup vs O(n) scan, much faster with many users.

---

### 2. Production-Ready Authentication Patterns

#### A. Structured Logging

**Current**: Basic `console.log` statements

**Recommended**: Use structured logging:

```typescript
// lib/logger.ts
type LogLevel = "info" | "warn" | "error" | "debug";

export function logAuth(level: LogLevel, message: string, meta?: object) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: "auth",
    message,
    ...meta,
  };
  
  if (process.env.NODE_ENV === "production") {
    // Send to logging service (e.g., Logtail, Datadog)
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(`[${level.toUpperCase()}]`, message, meta || "");
  }
}

// Usage:
logAuth("info", "Login attempt", { email: normalizedEmail });
logAuth("error", "User not found", { email: normalizedEmail, availableEmails: users.map(u => u.email) });
```

**Why**: Better debugging in production, easier to search logs.

#### B. Type-Safe Session Extensions

**Current**: Using `(session.user as any).role`

**Recommended**: Extend NextAuth types properly:

```typescript
// types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "CLIENT" | "BARBER" | "OWNER";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: "CLIENT" | "BARBER" | "OWNER";
  }
}
```

Then use without type assertions:
```typescript
// No more (session.user as any).role
const role = session.user.role; // TypeScript knows this exists!
```

**Why**: Type safety, better IDE autocomplete, fewer runtime errors.

#### C. Centralized Auth Utilities

**Current**: Helpers in `auth-options.ts` (good for self-contained, but could be shared)

**Recommended**: Create reusable auth utilities:

```typescript
// lib/auth/utils.ts
export async function verifyUserCredentials(
  email: string,
  password: string,
): Promise<{ user: User; error: null } | { user: null; error: string }> {
  // Centralized logic that can be reused in:
  // - NextAuth authorize()
  // - API routes
  // - Server actions
  // - Test scripts
}
```

**Why**: DRY principle, easier to test, consistent behavior everywhere.

---

### 3. Recommended Open-Source Projects to Study

#### A. NextAuth.js Examples Repository
**GitHub**: `nextauthjs/next-auth/tree/main/apps/examples`
- Production-ready examples
- Multiple database adapters
- Best practices for callbacks
- **Reusable**: Copy callback patterns, error handling

#### B. T3 Stack (create-t3-app)
**GitHub**: `t3-oss/create-t3-app`
- Next.js 14 + NextAuth + Prisma + TypeScript
- Type-safe auth patterns
- **Reusable**: Type extensions, middleware patterns

#### C. Next.js 14 Authentication Examples
**GitHub**: `vercel/next.js/tree/canary/examples`
- Look for `with-next-auth` example
- **Reusable**: Route protection patterns

#### D. Prisma + NextAuth Best Practices
**GitHub**: `prisma/prisma-examples/tree/latest/typescript/rest-nextjs-api-routes-auth`
- Prisma adapter patterns
- **Reusable**: User creation flows, role management

---

### 4. Immediate Actionable Improvements

#### Priority 1: Fix Current Issues (In Progress)
- ✅ Case-insensitive email lookup
- ✅ Self-contained authorize() function
- ✅ Enhanced logging

#### Priority 2: Add Type Safety
```typescript
// Create: types/next-auth.d.ts
// Extend Session and JWT interfaces
// Remove all `as any` type assertions
```

#### Priority 3: Add Rate Limiting
```typescript
// Install: @upstash/ratelimit @upstash/redis
// Add to authorize() function
// Prevents brute force attacks
```

#### Priority 4: Improve Error Messages
```typescript
// Use CredentialsSignin for better UX
// Add specific error messages (email not found vs password wrong)
```

#### Priority 5: Database Optimization
```typescript
// Add emailLower field to User model
// Create migration to populate existing data
// Update findUserByEmailInsensitive to use indexed lookup
```

---

### 5. Code Blocks You Can Reuse

#### A. Production-Ready authorize() Pattern

```typescript
async authorize(credentials) {
  // 1. Validate input
  if (!credentials?.email || !credentials?.password) {
    throw new CredentialsSignin("Email and password are required");
  }

  // 2. Normalize email
  const email = normalizeEmail(credentials.email);
  
  // 3. Rate limiting
  const { success } = await loginRateLimit.limit(email);
  if (!success) {
    throw new CredentialsSignin("Too many attempts. Please try again later.");
  }

  // 4. Find user (with indexed lookup if emailLower exists)
  const user = await findUserByEmailInsensitive(email);
  if (!user) {
    logAuth("warn", "Login attempt with unknown email", { email });
    throw new CredentialsSignin("Invalid email or password");
  }

  // 5. Validate password hash exists
  if (!user.passwordHash) {
    logAuth("error", "User missing passwordHash", { userId: user.id, email });
    throw new CredentialsSignin("Account setup incomplete. Please reset your password.");
  }

  // 6. Compare password
  const isValid = await compare(credentials.password, user.passwordHash);
  if (!isValid) {
    logAuth("warn", "Invalid password attempt", { userId: user.id, email });
    throw new CredentialsSignin("Invalid email or password");
  }

  // 7. Return user
  logAuth("info", "Successful login", { userId: user.id, email, role: user.role });
  return {
    id: user.id,
    email: user.email!,
    name: user.name ?? undefined,
    role: user.role,
  };
}
```

#### B. Type-Safe Session Hook

```typescript
// hooks/use-auth.ts
import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();
  
  return {
    user: session?.user,
    role: session?.user?.role ?? "CLIENT",
    isAuthenticated: status === "authenticated",
    isOwner: session?.user?.role === "OWNER",
    isBarber: session?.user?.role === "BARBER" || session?.user?.role === "OWNER",
    isClient: session?.user?.role === "CLIENT",
  };
}
```

**Usage**:
```typescript
const { isOwner, isBarber, user } = useAuth();
// No more (session?.user as any).role
```

---

## Summary

**Your Current Implementation**: Good foundation, but needs:
1. ✅ Better error handling (CredentialsSignin)
2. ✅ Rate limiting (security)
3. ✅ Type safety (remove `as any`)
4. ✅ Database optimization (emailLower field)
5. ✅ Structured logging (production-ready)

**Recommended Next Steps**:
1. Complete current fixes (case-insensitive lookup)
2. Add type extensions (`types/next-auth.d.ts`)
3. Implement rate limiting
4. Add emailLower field to database
5. Replace console.log with structured logging

**Reusable Code Sources**:
- NextAuth.js examples repository
- T3 Stack patterns
- Next.js official examples
- Prisma + NextAuth examples

All of these are production-tested and can be adapted to your codebase.




