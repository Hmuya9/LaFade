// src/lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";
import { env } from "./env";
// Import centralized auth utilities
import { verifyCredentials } from "./auth-utils";

// Normalize barber email for case-insensitive comparison
const BARBER_EMAIL = (env.BARBER_EMAIL ?? "").trim().toLowerCase();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", // best with Credentials
  },
  providers: [
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: {
          user: "resend",
          pass: env.RESEND_API_KEY,
        },
      },
      from: env.EMAIL_FROM || "no-reply@lafade.com",
      async sendVerificationRequest({ identifier, url }) {
        // Use Resend API directly instead of Nodemailer
        const { Resend } = await import("resend");
        const resend = new Resend(env.RESEND_API_KEY);
        
        try {
          const res = await resend.emails.send({
            from: env.EMAIL_FROM || "no-reply@lafade.com",
            to: identifier,
            subject: "Your LaFade magic sign-in link",
            html: `
              <div style="font-family:system-ui,sans-serif">
                <h2>Sign in to LaFade</h2>
                <p><a href="${url}">Click here to sign in</a></p>
                <p style="color:#666">This link expires in 24 hours.</p>
              </div>
            `,
            text: `Sign in: ${url}`,
          });

          if (res?.error) {
            throw new Error(res.error.message || "Failed to send Resend email");
          }
        } catch (err) {
          console.error("[auth][resend] sendVerificationRequest error", err);
          throw err;
        }
      },
    }),
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
    signIn: "/login",          // credentials & magic link UI
    verifyRequest: "/signin",  // magic link "check your email" page
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
      if (!user?.email) return true;

      // For Credentials provider, user already exists in DB (they registered)
      // Skip user creation/update logic
      if (account?.provider === "credentials") {
        return true;
      }

      // For Email provider, handle user creation/role assignment
      const email = user.email.toLowerCase();
      const isBarber = email === BARBER_EMAIL;
      const assignedRole = isBarber ? "BARBER" : "CLIENT";

      console.info(`[auth][signIn] ${user.email} -> ${assignedRole}`, { 
        email, 
        barberEmail: BARBER_EMAIL, 
        isBarber 
      });

      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (!existing) {
        await prisma.user.create({
          data: { email: user.email, role: assignedRole },
        });
        console.info(`[auth][signIn] Created new user: ${user.email} as ${assignedRole}`);
      } else if (isBarber && existing.role !== "BARBER") {
        await prisma.user.update({ where: { email: user.email }, data: { role: "BARBER" } });
        console.info(`[auth][signIn] Promoted existing user: ${user.email} to BARBER`);
      }
      return true;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

