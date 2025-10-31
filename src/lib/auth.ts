import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "@auth/core/adapters";
import { prisma } from "@/lib/db";
import NextAuth, { type NextAuthConfig } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Normalize barber email for case-insensitive comparison
const BARBER_EMAIL = (process.env.BARBER_EMAIL ?? '').trim().toLowerCase();

// Environment variable guards
if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️ RESEND_API_KEY is missing - authentication will not work");
}
if (!process.env.NEXTAUTH_SECRET) {
  console.warn("⚠️ NEXTAUTH_SECRET is missing - authentication will not work");
}
if (!BARBER_EMAIL) {
  console.warn("⚠️ BARBER_EMAIL is missing - no users will be assigned BARBER role");
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  debug: false, // Turn off for production
  session: { strategy: "jwt" },
  // Cast to the standard Adapter type so TS doesn't force app-specific fields
  adapter: PrismaAdapter(prisma) as Adapter,
  logger: { error: console.error, warn: console.warn },
  pages: {
    signIn: '/client/login', // Default to client login
    error: '/client/login', // Redirect errors to client login
  },
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      maxAge: 24 * 60 * 60,
      // Minimal server config to satisfy Nodemailer - we override in sendVerificationRequest
      server: {
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY ?? "",
        },
      },
      async sendVerificationRequest({ identifier, url }) {
        // Use Resend API directly instead of Nodemailer
        try {
          const res = await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
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
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Let NextAuth handle valid absolute callback URLs
      if (url.startsWith(baseUrl)) return url;
      // Default: go via post-login router (it will check role)
      return `${baseUrl}/post-login`;
    },
    async session({ session, token }) {
      // expose role on the session object for server/client checks
      if (session.user) {
        session.user.role = (token.role as "BARBER" | "CLIENT") || "CLIENT"
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // derive email from the freshest source available
      const email = (user?.email || token?.email || "").toLowerCase()
      const barberEmail = (process.env.BARBER_EMAIL || "").toLowerCase()

      // set role on the token deterministically on every sign-in / refresh
      token.role = email && email === barberEmail ? "BARBER" : "CLIENT"
      
      console.info(`[auth][jwt] ${email} -> ${token.role}`, { 
        email, 
        barberEmail, 
        isBarber: email === barberEmail 
      });
      
      return token;
    },
    async signIn({ user }) {
      if (!user?.email) return true;
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
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);