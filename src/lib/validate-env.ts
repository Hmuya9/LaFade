import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Database
  DATABASE_URL: z.string().optional(),
  
  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  NOTIFY_FROM: z.string().email().optional(),
  NOTIFY_TO: z.string().email().optional(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PRICE_STANDARD: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PRICE_DELUXE: z.string().optional(),
  NEXT_PUBLIC_STRIPE_LINK_STANDARD: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_LINK_DELUXE: z.string().url().optional(),
  
  // Redis (optional caching)
  REDIS_URL: z.string().optional(),
  
  // Public URLs
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_CALENDLY_URL: z.string().url().optional(),
})

export function validateEnv() {
  try {
    const env = envSchema.parse(process.env)
    
    // Warn about missing critical env vars in development
    if (process.env.NODE_ENV === "development") {
      const warnings: string[] = []
      
      if (!env.DATABASE_URL) {
        warnings.push("DATABASE_URL is missing - Database features will be disabled")
      }
      
      if (!env.RESEND_API_KEY) {
        warnings.push("RESEND_API_KEY is missing - Email notifications will be disabled")
      }
      
      if (!env.NOTIFY_FROM) {
        warnings.push("NOTIFY_FROM is missing - Email sender will use fallback")
      }
      
      if (!env.NOTIFY_TO) {
        warnings.push("NOTIFY_TO is missing - Internal notifications will use fallback")
      }
      
      if (!env.STRIPE_SECRET_KEY) {
        warnings.push("STRIPE_SECRET_KEY is missing - Stripe features will be disabled")
      }
      
      if (!env.STRIPE_WEBHOOK_SECRET) {
        warnings.push("STRIPE_WEBHOOK_SECRET is missing - Webhooks will be disabled")
      }
      
      if (!env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD) {
        warnings.push("NEXT_PUBLIC_STRIPE_PRICE_STANDARD is missing - Standard plan checkout disabled")
      }
      
      if (!env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE) {
        warnings.push("NEXT_PUBLIC_STRIPE_PRICE_DELUXE is missing - Deluxe plan checkout disabled")
      }
      
      if (!env.NEXT_PUBLIC_APP_URL) {
        warnings.push("NEXT_PUBLIC_APP_URL is missing - Email links may be incorrect")
      }
      
      if (warnings.length > 0) {
        console.warn("⚠️ Environment Configuration Warnings:")
        warnings.forEach(warning => console.warn(`  - ${warning}`))
      }
    }
    
    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment validation failed:")
      error.issues.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
    }
    
    // In production, we should fail fast
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration")
    }
    
    // In development, return partial env with warnings
    return process.env as any
  }
}

export const env = validateEnv()
