import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAuthorizedManager, verifySameOrigin } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { AppError, ErrorCode, ValidationError } from '@/lib/errors'

// In-memory rate limiter per Email and per IP to protect against brute-force attacks
interface AttemptRecord {
  count: number
  firstAttemptAt: number
  lockedUntil: number | null
}

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes window
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes lockout after 5 failed attempts

const loginAttempts = new Map<string, AttemptRecord>()

function getClientIp(req: NextRequest): string {
  // Prefer Vercel's trusted edge-overwritten header first
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for')
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return 'unknown-ip'
}

function getEmailRateKey(email: string): string {
  return `email:${email.toLowerCase()}`
}

function getIpRateKey(ip: string): string {
  return `ip:${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number; remainingAttempts: number } {
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000)
    return { allowed: false, retryAfterSeconds, remainingAttempts: 0 }
  }

  // Reset if window expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(key)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
  }
}

function recordFailedAttempt(key: string): { locked: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now()
  const existing = loginAttempts.get(key)

  if (!existing || now - existing.firstAttemptAt > WINDOW_MS) {
    loginAttempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    })
    return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 }
  }

  const nextCount = existing.count + 1
  if (nextCount >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_MS
    loginAttempts.set(key, {
      ...existing,
      count: nextCount,
      lockedUntil,
    })
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    }
  }

  loginAttempts.set(key, {
    ...existing,
    count: nextCount,
  })

  return {
    locked: false,
    remainingAttempts: MAX_ATTEMPTS - nextCount,
  }
}

function clearAttempts(key: string) {
  loginAttempts.delete(key)
}

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF / Origin Verification
    if (!verifySameOrigin(req)) {
      return apiError(
        new AppError({
          message: 'Invalid request origin.',
          code: ErrorCode.AUTH_FORBIDDEN,
          statusCode: 403,
          retryable: false,
        }),
        req
      )
    }

    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    // 2. Input Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email) || email.length > 254) {
      return apiError(
        new ValidationError('Please enter a valid email address.', [
          { field: 'email', issue: 'Must be a valid email format' },
        ]),
        req
      )
    }

    if (!password || password.length < 6 || password.length > 256) {
      return apiError(
        new AppError({
          message: 'Invalid email or password.',
          code: ErrorCode.AUTH_INVALID_CREDENTIALS,
          statusCode: 401,
          retryable: false,
        }),
        req
      )
    }

    // 3. Brute-Force Rate Limit Check (tracked independently by Email and by IP)
    const ip = getClientIp(req)
    const emailKey = getEmailRateKey(email)
    const ipOnlyKey = getIpRateKey(ip)

    const emailLimit = checkRateLimit(emailKey)
    const ipLimit = checkRateLimit(ipOnlyKey)

    if (!emailLimit.allowed || !ipLimit.allowed) {
      const waitSec = emailLimit.retryAfterSeconds || ipLimit.retryAfterSeconds || 900
      const waitMin = Math.ceil(waitSec / 60)
      return apiError(
        new AppError({
          message: `Too many failed sign-in attempts. For your security, login is temporarily locked for ${waitMin} minute${waitMin === 1 ? '' : 's'}.`,
          code: ErrorCode.AUTH_RATE_LIMITED,
          statusCode: 429,
          retryable: false,
          retryAfterSeconds: waitSec,
        }),
        req
      )
    }

    // 4. Authenticate with Supabase on the Server (sets cookies via @supabase/ssr)
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user || !data.session) {
      const failStatus = recordFailedAttempt(emailKey)
      recordFailedAttempt(ipOnlyKey)

      if (failStatus.locked) {
        return apiError(
          new AppError({
            message: 'Too many failed sign-in attempts. Your account is temporarily locked for 15 minutes.',
            code: ErrorCode.AUTH_RATE_LIMITED,
            statusCode: 429,
            retryable: false,
            retryAfterSeconds: failStatus.retryAfterSeconds,
          }),
          req
        )
      }

      // Generic message to prevent user enumeration
      const remainingMsg =
        failStatus.remainingAttempts <= 2
          ? `Invalid email or password. (${failStatus.remainingAttempts} attempt${failStatus.remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout)`
          : 'Invalid email or password.'

      return apiError(
        new AppError({
          message: remainingMsg,
          code: ErrorCode.AUTH_INVALID_CREDENTIALS,
          statusCode: 401,
          retryable: false,
        }),
        req
      )
    }

    // 5. Verify Manager Authorization (Allowlist / Role Check)
    const authz = isAuthorizedManager(data.user)
    if (!authz.authorized) {
      // Immediately sign out unauthorized user so session cookie is cleared
      await supabase.auth.signOut()
      recordFailedAttempt(emailKey)

      return apiError(
        new AppError({
          message: authz.reason || 'Access denied: this account is not authorized as an Academy Manager.',
          code: ErrorCode.AUTH_FORBIDDEN,
          statusCode: 403,
          retryable: false,
        }),
        req
      )
    }

    // 6. Success: Clear failed attempts
    clearAttempts(emailKey)
    clearAttempts(ipOnlyKey)

    return apiSuccess({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (err: unknown) {
    return apiError(err, req)
  }
}

