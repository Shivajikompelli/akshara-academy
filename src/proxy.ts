import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''

  // Validate URL to prevent crashes from typos in .env
  let validUrl = false
  try {
    const parsed = new URL(rawUrl)
    validUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    validUrl = false
  }

  let user = null

  if (validUrl && rawKey) {
    try {
      const supabase = createServerClient(rawUrl, rawKey, {
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

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth')

  // If user is not authenticated and trying to access a protected page
  if (!user && !isLoginPage && !isAuthCallback) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated user visits /login, redirect to home
  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
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
