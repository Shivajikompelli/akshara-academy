import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySameOrigin } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { AuthError, ErrorCode } from '@/lib/errors'

export async function POST(req: NextRequest) {
  try {
    if (!verifySameOrigin(req)) {
      throw new AuthError('Cross-origin request blocked.', ErrorCode.AUTH_FORBIDDEN)
    }

    const supabase = await createClient()
    // Revoke session globally on Supabase Auth and clear cookies
    await supabase.auth.signOut({ scope: 'global' })

    return apiSuccess(
      { loggedOut: true },
      200,
      {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    )
  } catch (err: unknown) {
    return apiError(err, req)
  }
}


