import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const isConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// General: 100 requests per 10 seconds per IP
export const generalLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '10 s'), prefix: 'rl:general' })
  : null

// Strict: 20 requests per 60 seconds per IP — for CPU-heavy routes (PDF generation)
export const strictLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'rl:strict' })
  : null
