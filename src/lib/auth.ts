import 'server-only'
import { timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Constant-time string comparison to prevent timing attacks when checking
 * service role keys or cron secrets.
 */
export function safeCompareSecrets(provided: string, expected: string): boolean {
  if (!provided || !expected) return false
  const bufA = Buffer.from(provided, 'utf8')
  const bufB = Buffer.from(expected, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Checks whether an authenticated Supabase user is an authorized Academy Manager.
 *
 * Authorization rules:
 * 1. User must have a valid, non-expired session and confirmed email.
 * 2. If `ADMIN_ALLOWED_EMAILS` is configured in environment variables (comma-separated),
 *    the user's email must be in the allowlist.
 * 3. If `app_metadata.role` is explicitly set to `'blocked'` or `'disabled'`, deny access.
 */
export function isAuthorizedManager(user: User | null): {
  authorized: boolean
  reason?: string
} {
  if (!user) {
    return { authorized: false, reason: 'Not signed in.' }
  }

  if (!user.email) {
    return { authorized: false, reason: 'Account does not have a verified email address.' }
  }

  // Check if explicitly disabled in app_metadata
  const appRole = user.app_metadata?.role
  if (appRole === 'blocked' || appRole === 'disabled') {
    return { authorized: false, reason: 'This manager account has been disabled.' }
  }

  // Optional strict allowlist from environment variable (e.g. ADMIN_ALLOWED_EMAILS="admin1@akshara.com,admin2@akshara.com")
  const rawAllowlist = process.env.ADMIN_ALLOWED_EMAILS?.trim()
  if (rawAllowlist) {
    const allowedEmails = rawAllowlist
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (allowedEmails.length > 0 && !allowedEmails.includes(user.email.toLowerCase())) {
      return {
        authorized: false,
        reason: 'Your email is not authorized to access the Akshara Academy management portal.',
      }
    }
  }

  return { authorized: true }
}

/**
 * Verifies that a state-changing request originates from the same origin (CSRF protection).
 * Checks both `Sec-Fetch-Site` and `Origin` vs `Host` headers using constant-time comparison.
 */
export function verifySameOrigin(req: NextRequest): boolean {
  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return false
  }

  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')

  if (origin && host) {
    try {
      const originHost = new URL(origin).host
      const a = Buffer.from(originHost, 'utf8')
      const b = Buffer.from(host, 'utf8')
      if (a.length !== b.length) return false
      return timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  return true
}

/**
 * Verifies that the current request comes from an authenticated & authorized manager
 * (or optionally a valid cron/service-role bearer token for scheduled jobs).
 */
export async function verifyApiAuth(
  req: NextRequest,
  options?: { allowCronSecret?: boolean }
): Promise<
  | { authorized: true; user: User | null; isCron: boolean }
  | { authorized: false; response: NextResponse }
> {
  // 1. Optional Cron / Service Role Bearer token check (constant-time)
  if (options?.allowCronSecret) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim()
      const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
      const cronSecret = (process.env.CRON_SECRET || '').trim()

      if (
        (serviceRoleKey && safeCompareSecrets(token, serviceRoleKey)) ||
        (cronSecret && safeCompareSecrets(token, cronSecret))
      ) {
        return { authorized: true, user: null, isCron: true }
      }
    }
  }

  // 2. Enforce Same-Origin / Sec-Fetch-Site check on state-changing requests
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (!verifySameOrigin(req)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Cross-origin request blocked.' },
          { status: 403 }
        ),
      }
    }
  }

  // 2. Verify Supabase session cookie via Auth server (`getUser()`)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: please sign in to continue.' },
        { status: 401 }
      ),
    }
  }

  // 3. Verify Manager Authorization (Allowlist / Role)
  const check = isAuthorizedManager(user)
  if (!check.authorized) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: check.reason || 'Forbidden: insufficient permissions.' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, user, isCron: false }
}

