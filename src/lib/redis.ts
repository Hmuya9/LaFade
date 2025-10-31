import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (typeof window !== 'undefined') {
    // Don't initialize Redis on client side
    return null
  }

  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      })
    } catch (error) {
      console.error('Failed to initialize Redis:', error)
    }
  }

  return redis
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const value = await client.get(key)
    return value ? JSON.parse(value) : null
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error)
    return null
  }
}

export async function redisSet(key: string, value: any, ttlSec: number): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const serialized = JSON.stringify(value)
    await client.setex(key, ttlSec, serialized)
    return true
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error)
    return false
  }
}
