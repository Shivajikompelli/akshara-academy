import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedManager, safeCompareSecrets } from '@/lib/auth'

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-DNS-Prefetch-Control', 'on')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()')
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.facebook.com https://*.razorpay.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com https://vercel.live https://api.razorpay.com https://lumberjack.razorpay.com",
      "frame-src 'self' https://api.razorpay.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )
  return res
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/^["']|["']$/g, '')
  const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '')

  // Validate URL to prevent crashes from typos in .env
  let validUrl = false
  try {
    const parsed = new URL(rawUrl)
    validUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    validUrl = false
  }

  let user = null
  let supabase = null

  if (validUrl && rawKey) {
    try {
      supabase = createServerClient(rawUrl, rawKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      })

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      user = authUser
    } catch (error) {
      console.error('Auth error in proxy:', error)
    }
  }

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')
  const isAuthCallback = pathname.startsWith('/auth')
  const isAuthApi = pathname.startsWith('/api/auth/')
  const isApiRoute = pathname.startsWith('/api/')

  // Allow /api/send-fee-reminders when called with valid CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY Bearer token
  let isCronAuthorized = false
  if (pathname === '/api/send-fee-reminders') {
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim()
      const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
      const cronSecret = (process.env.CRON_SECRET || '').trim()
      if (
        (serviceRoleKey && safeCompareSecrets(token, serviceRoleKey)) ||
        (cronSecret && safeCompareSecrets(token, cronSecret))
      ) {
        isCronAuthorized = true
      }
    }
  }

  const authz = isAuthorizedManager(user)

  // If signed in with an unauthorized account, revoke session immediately
  if (user && !authz.authorized) {
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        // Ignore signOut error in proxy
      }
    }
    if (isApiRoute && !isAuthApi) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: authz.reason || 'Forbidden: account not authorized.' },
          { status: 403 }
        )
      )
    }
    if (!isLoginPage) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('error', 'unauthorized')
      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }
  }

  // For API routes (other than /api/auth/* or cron-authenticated job), return 401 JSON if not authenticated
  if (isApiRoute && !isAuthApi && !isCronAuthorized && (!user || !authz.authorized)) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: 'Unauthorized: please sign in.' },
        { status: 401 }
      )
    )
  }

  // If user is not authenticated and trying to access a protected page
  if ((!user || !authz.authorized) && !isLoginPage && !isAuthCallback && !isApiRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return applySecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  // If authenticated & authorized user visits /login, redirect to home
  if (user && authz.authorized && isLoginPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    return applySecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/assets (*.svg, *.png, *.jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
