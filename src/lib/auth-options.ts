// src/lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";
// Import centralized auth utilities
import { verifyCredentials } from "./auth-utils";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", // best with Credentials
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /**
       * Authorize function for NextAuth Credentials Provider.
       * 
       * This function delegates all authentication logic to verifyCredentials(),
       * which handles:
       * - Email normalization (normalizeEmail)
       * - Case-insensitive user lookup (findUserByEmailInsensitive)
       * - Password verification (verifyPassword)
       * - Comprehensive logging at each step
       * 
       * Returns null on any failure (invalid email, wrong password, etc.)
       * NextAuth will respond with 401 Unauthorized if null is returned.
       * 
       * @param credentials - Email and password from login form
       * @returns User object with { id, email, name, role } or null
       */
      async authorize(credentials) {
        try {
          // Log raw input received from NextAuth
          console.log("[auth] authorize() called", {
            hasEmail: !!credentials?.email,
            hasPassword: !!credentials?.password,
            emailType: typeof credentials?.email,
            passwordType: typeof credentials?.password,
            emailLength: credentials?.email?.length,
            passwordLength: credentials?.password?.length,
            emailPreview: credentials?.email ? `${credentials.email.slice(0, 10)}...` : "none",
          });

          // Validate input
          if (!credentials?.email || !credentials?.password) {
            console.log("[auth] authorize() FAILED: missing credentials", {
              email: credentials?.email || "MISSING",
              password: credentials?.password ? "***" : "MISSING",
            });
            return null;
          }

          // Log normalized values before passing to verifyCredentials
          const normalizedEmail = credentials.email.trim().toLowerCase();
          console.log("[auth] authorize() normalized email", {
            original: credentials.email,
            normalized: normalizedEmail,
            passwordLength: credentials.password.length,
          });

          // Delegate to centralized verifyCredentials() helper
          // All detailed logging happens inside verifyCredentials() and its helpers
          const user = await verifyCredentials(normalizedEmail, credentials.password);

          if (!user) {
            console.log("[auth] authorize() FAILED: verifyCredentials returned null");
            return null;
          }

          console.log("[auth] authorize() SUCCESS: returning user", {
            userId: user.id,
            email: user.email,
            role: user.role,
          });

          // Return user object if valid, null otherwise
          // NextAuth will handle the rest (JWT/session callbacks)
          return user;
        } catch (error) {
          // Catch any unexpected errors that might be swallowed
          console.error("[auth] authorize() ERROR: unexpected exception", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            credentials: {
              hasEmail: !!credentials?.email,
              hasPassword: !!credentials?.password,
            },
          });
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",          // email + password login
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        // `user` is only defined on first sign-in (login)
        // On subsequent requests, only `token` is available
        if (user) {
          // Attach user data to token on first sign-in
          // IMPORTANT: Always set id for consistency with booking API
          token.id = (user as any)?.id ?? null;
          token.userId = (user as any)?.id ?? null; // Keep both for compatibility
          token.email = user.email ?? null;
          token.name = user.name ?? null;
          token.role = (user as any)?.role ?? "CLIENT";
        }
        
        // Ensure role always has a default value
        if (!token.role) {
          token.role = "CLIENT";
        }
        
        return token;
      } catch (error) {
        console.error("[auth][jwt] Callback error:", error);
        // Always return token even on error to prevent NextAuth crash
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          // Read user data from token into session
          // IMPORTANT: Set id from token.id or token.userId (prefer token.id)
          const anyToken = token as any;
          const anyUser = session.user as any;
          
          anyUser.id = anyToken.id ?? anyToken.userId ?? null;
          anyUser.role = (token.role as string) ?? "CLIENT";
          
          // Preserve name from token if available, otherwise keep existing
          if (anyToken.name) {
            session.user.name = anyToken.name;
          }
          
          // Ensure email is set
          if (anyToken.email && !session.user.email) {
            session.user.email = anyToken.email;
          }
        }
        
        return session;
      } catch (error) {
        console.error("[auth][session] Callback error:", error);
        // Always return session even on error to prevent NextAuth crash
        return session;
      }
    },
    async redirect({ url, baseUrl }) {
      // Keep redirects on same origin
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      const urlObj = new URL(url);
      if (urlObj.origin === baseUrl) return url;
      return baseUrl;
    },
    async signIn({ user, account }) {
      // For Credentials provider, user already exists in DB (they registered)
      // No additional user creation needed
      if (account?.provider === "credentials") {
        return true;
      }
      // Should not reach here since we only have Credentials provider
      return false;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

