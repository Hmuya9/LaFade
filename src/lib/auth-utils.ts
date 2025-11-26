// web/src/lib/auth-utils.ts
// Centralized authentication utilities for NextAuth Credentials Provider
// Production-ready helpers for case-insensitive email lookup and password verification

import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { compare } from "bcryptjs";

/**
 * Normalizes email address for consistent storage and lookup.
 * Trims whitespace and converts to lowercase.
 * 
 * @param email - Raw email address from user input
 * @returns Normalized email (trimmed, lowercase)
 * 
 * @example
 * normalizeEmail("  John@Example.COM  ") // "john@example.com"
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Case-insensitive email lookup for SQLite compatibility.
 * 
 * SQLite's default string comparison is case-sensitive, so we:
 * 1. Fetch all users with emails
 * 2. Filter in memory using case-insensitive comparison
 * 
 * This ensures compatibility with SQLite while maintaining correctness.
 * For production with PostgreSQL, consider adding an indexed `emailLower` field.
 * 
 * @param email - Email address (any casing)
 * @returns User with passwordHash, or null if not found
 * 
 * @example
 * const user = await findUserByEmailInsensitive("John@Example.COM");
 * // Will find user with email "john@example.com" or "John@Example.COM"
 */
export async function findUserByEmailInsensitive(
  email: string
): Promise<User | null> {
  const target = normalizeEmail(email);

  console.log("[auth] findUserByEmailInsensitive: looking for", target);

  // Fetch all users with emails (SQLite case-sensitivity workaround)
  // In production with many users, consider adding emailLower field with index
  const users = await prisma.user.findMany({
    where: {
      email: {
        not: null,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  });

  console.log("[auth] findUserByEmailInsensitive: checked", users.length, "users");

  // Case-insensitive match
  const user = users.find(
    (u) => u.email && normalizeEmail(u.email) === target
  );

  if (!user) {
    console.log("[auth] findUserByEmailInsensitive: NO MATCH for", target);
    const availableEmails = users.map((u) => u.email).filter(Boolean);
    console.log("[auth] findUserByEmailInsensitive: available emails in DB", availableEmails);
    console.log("[auth] findUserByEmailInsensitive: normalized available emails", 
      availableEmails.map(e => normalizeEmail(e || ""))
    );
    return null;
  }

  console.log("[auth] findUserByEmailInsensitive: matched DB email", user.email);
  
  // Cast to full User | null – we selected a subset of fields above
  return user as unknown as User | null;
}

/**
 * Verifies a plain text password against a bcrypt hash.
 * 
 * Uses bcrypt.compare() which is timing-safe to prevent timing attacks.
 * 
 * @param plainPassword - Plain text password from user input
 * @param hash - Bcrypt hash from database (should start with $2b$)
 * @returns true if password matches, false otherwise
 * 
 * @example
 * const isValid = await verifyPassword("myPassword123", user.passwordHash);
 * if (isValid) {
 *   // User authenticated
 * }
 */
export async function verifyPassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  // Validate hash format before comparing
  if (!hash || hash.length !== 60 || !hash.startsWith("$2b$")) {
    console.log("[auth] verifyPassword: invalid hash format", {
      length: hash?.length,
      prefix: hash?.slice(0, 4),
    });
    return false;
  }

  try {
    const isValid = await compare(plainPassword, hash);
    console.log("[auth] verifyPassword: result", isValid);
    return isValid;
  } catch (error) {
    console.error("[auth] verifyPassword: error during comparison", error);
    return false;
  }
}

/**
 * Verifies user credentials (email + password).
 * 
 * This is the main function used by NextAuth's authorize() callback.
 * It combines email lookup and password verification in a single call.
 * 
 * @param email - User email (any casing)
 * @param password - Plain text password
 * @returns User object for NextAuth if valid, null otherwise
 * 
 * @example
 * const user = await verifyCredentials("user@example.com", "password123");
 * if (user) {
 *   // User authenticated, return to NextAuth
 * }
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<{
  id: string;
  email: string;
  name: string | undefined;
  role: string;
} | null> {
  try {
    console.log("[auth] verifyCredentials: starting verification", {
      email,
      emailLength: email.length,
      passwordLength: password.length,
      emailType: typeof email,
      passwordType: typeof password,
    });

    // 1. Find user by email (case-insensitive)
    const user = await findUserByEmailInsensitive(email);

    if (!user) {
      console.log("[auth] verifyCredentials: user not found for email", email);
      // Log all available emails for debugging
      try {
        const allUsers = await prisma.user.findMany({
          where: { email: { not: null } },
          select: { email: true },
        });
        console.log("[auth] verifyCredentials: available emails in DB", 
          allUsers.map(u => u.email).filter(Boolean)
        );
      } catch (dbError) {
        console.error("[auth] verifyCredentials: error fetching users for debug", dbError);
      }
      return null;
    }

    console.log("[auth] verifyCredentials: user found", {
      userId: user.id,
      dbEmail: user.email,
      hasPasswordHash: !!user.passwordHash,
      passwordHashLength: user.passwordHash?.length,
    });

    // 2. Check password hash exists
    if (!user.passwordHash) {
      console.log("[auth] verifyCredentials: user has no passwordHash", {
        userId: user.id,
        email: user.email,
      });
      return null;
    }

    // 3. Verify password
    console.log("[auth] verifyCredentials: verifying password", {
      userId: user.id,
      passwordLength: password.length,
      hashPrefix: user.passwordHash.slice(0, 10),
    });

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      console.log("[auth] verifyCredentials: password mismatch", {
        userId: user.id,
        email: user.email,
        passwordLength: password.length,
      });
      return null;
    }

    // 4. Return user object for NextAuth
    const result = {
      id: user.id,
      email: user.email!,
      name: user.name ?? undefined,
      role: user.role,
    };

    console.log("[auth] verifyCredentials: SUCCESS", {
      userId: result.id,
      email: result.email,
      role: result.role,
    });

    return result;
  } catch (error) {
    // Catch any unexpected errors (DB connection, etc.)
    console.error("[auth] verifyCredentials: ERROR", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email,
      hasPassword: !!password,
    });
    return null;
  }
}

