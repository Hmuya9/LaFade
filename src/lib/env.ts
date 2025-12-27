import "server-only";
import { z } from "zod";

// Server-only environment variables schema
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Required critical vars
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),

  // Optional server vars
  NEXTAUTH_URL: z.string().url().optional(),
  BARBER_EMAIL: z.string().email().optional(),
  NOTIFY_FROM: z.string().email().optional(),

  // Email/Resend - OPTIONAL
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  // Stripe - OPTIONAL
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Redis - OPTIONAL
  REDIS_URL: z.string().url().optional(),

  // Cloudinary - OPTIONAL
  CLOUDINARY_API_SECRET: z.string().optional(),
});

// Client-safe environment variables schema (NEXT_PUBLIC_* only)
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_CALENDLY_URL: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PRICE_STANDARD: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PRICE_DELUXE: z.string().optional(),
  NEXT_PUBLIC_STRIPE_LINK_STANDARD: z.string().optional(),
  NEXT_PUBLIC_STRIPE_LINK_DELUXE: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_API_KEY: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
  NEXT_PUBLIC_BARBER_NAME: z.string().optional(),
});

// Parse server env with safeParse
const serverParsed = serverSchema.safeParse(process.env);

// During Vercel build, env vars may not be available yet - allow build to proceed
// Validation will happen at runtime when env is actually accessed
const isBuildTime = process.env.VERCEL === "1" && !process.env.DATABASE_URL;

if (!serverParsed.success && !isBuildTime) {
  const errors = serverParsed.error.flatten().fieldErrors;
  console.error("❌ Invalid server environment variables:", errors);

  // Fail fast on critical missing vars
  const criticalVars = ["DATABASE_URL", "NEXTAUTH_SECRET"] as const;
  const missingCritical = criticalVars.filter((key) => errors[key as keyof typeof errors]);

  if (missingCritical.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingCritical.join(", ")}. Check logs for details.`
    );
  }

  // In dev, log warnings but continue with partial env
  if (process.env.NODE_ENV === "development") {
    console.warn("⚠️ Some optional environment variables are missing. App will continue with limited functionality.");
  }
}

// Export server env (only use in server components/actions/API routes)
// During build, provide safe defaults if env vars aren't available yet
const buildTimeDefaults = isBuildTime ? {
  DATABASE_URL: "file:./prisma/dev.db", // Placeholder for build
  NEXTAUTH_SECRET: "build-time-placeholder", // Placeholder for build
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  BARBER_EMAIL: process.env.BARBER_EMAIL,
  NOTIFY_FROM: process.env.NOTIFY_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
} : {};

export const env = {
  ...(serverParsed.success ? serverParsed.data : buildTimeDefaults),
  // Backward compatibility aliases
  appUrl: serverParsed.success ? (serverParsed.data.NEXTAUTH_URL || "") : (process.env.NEXTAUTH_URL || ""),
  calendly: process.env.NEXT_PUBLIC_CALENDLY_URL || "",
  stripeStandard: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD || "",
  stripeDeluxe: process.env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE || "",
  linkStandard: process.env.NEXT_PUBLIC_STRIPE_LINK_STANDARD || "",
  linkDeluxe: process.env.NEXT_PUBLIC_STRIPE_LINK_DELUXE || "",
  redisUrl: serverParsed.success ? (serverParsed.data.REDIS_URL || "") : (process.env.REDIS_URL || ""),
  cloudinaryCloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  cloudinaryApiSecret: serverParsed.success ? (serverParsed.data.CLOUDINARY_API_SECRET || "") : (process.env.CLOUDINARY_API_SECRET || ""),
  cloudinaryUploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
};

// Export client env (for reference, but client components should use process.env.NEXT_PUBLIC_* directly)
const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CALENDLY_URL: process.env.NEXT_PUBLIC_CALENDLY_URL,
  NEXT_PUBLIC_STRIPE_PRICE_STANDARD: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD,
  NEXT_PUBLIC_STRIPE_PRICE_DELUXE: process.env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE,
  NEXT_PUBLIC_STRIPE_LINK_STANDARD: process.env.NEXT_PUBLIC_STRIPE_LINK_STANDARD,
  NEXT_PUBLIC_STRIPE_LINK_DELUXE: process.env.NEXT_PUBLIC_STRIPE_LINK_DELUXE,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  NEXT_PUBLIC_CLOUDINARY_API_KEY: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  NEXT_PUBLIC_BARBER_NAME: process.env.NEXT_PUBLIC_BARBER_NAME,
});

export const clientEnv = clientParsed.success ? clientParsed.data : {};

export type Env = typeof env;
export type ClientEnv = typeof clientEnv;

/**
 * Get the base URL for the application.
 * Defaults to http://localhost:3000 if NEXTAUTH_URL is not set.
 */
export function getBaseUrl(): string {
  return env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/**
 * Get the email sender address.
 * Priority: EMAIL_FROM -> NOTIFY_FROM -> "onboarding@resend.dev"
 * Never returns empty string - always has a safe fallback for local/dev.
 */
export function getNotifyFromEmail(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.NOTIFY_FROM?.trim() ||
    "onboarding@resend.dev"
  );
}
