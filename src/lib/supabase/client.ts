import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co')
    .trim()
    .replace(/^["']|["']$/g, '')
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
    .trim()
    .replace(/^["']|["']$/g, '')

  return createBrowserClient(url, key)
}
