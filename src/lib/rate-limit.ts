/**
 * Simple in-memory rate limiting for API routes
 * In production, use Redis or a proper rate limiting service
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000 // 1 minute
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs
    }
    rateLimitStore.set(key, newEntry)
    
    return {
      success: true,
      remaining: limit - 1,
      resetTime: newEntry.resetTime
    }
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }

  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    success: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime
  }
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return "unknown"
}
