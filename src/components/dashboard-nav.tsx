'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Users,
  CalendarCheck,
  Wallet,
  MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AksharaLogo } from '@/components/ui/akshara-logo'
import { AccountMenu } from '@/components/account-menu'

export const NAV_ITEMS = [
  {
    name: 'Home',
    href: '/',
    icon: Home,
  },
  {
    name: 'Students',
    href: '/students',
    icon: Users,
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck,
  },
  {
    name: 'Fees',
    href: '/fees',
    icon: Wallet,
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: MessageCircle,
  },
]

export function DesktopTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [hasFailedMessages, setHasFailedMessages] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
        router.refresh()
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    async function checkFailed() {
      try {
        const supabase = createClient()
        const { count, error } = await supabase
          .from('message_log')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')

        if (!error) {
          setHasFailedMessages((count ?? 0) > 0)
        }
      } catch {
        // non-critical check
      }
    }
    checkFailed()
    window.addEventListener('akshara:messages-updated', checkFailed)
    return () => window.removeEventListener('akshara:messages-updated', checkFailed)
  }, [pathname])

  return (
    <header className="hidden md:flex h-18 bg-white border-b border-[var(--card-border)]/60 sticky top-0 z-30 shadow-2xs">
      <div className="w-full max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        {/* Left: Brand Logo + Name */}
        <Link href="/" className="flex items-center gap-3 cursor-pointer select-none">
          <AksharaLogo size="md" showText={true} />
        </Link>

        {/* Center: Five Destinations as text links with 2px primary underline on active */}
        <nav className="flex items-center gap-1 h-full" aria-label="Desktop Navigation">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 h-full flex items-center text-sm transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'font-bold text-[var(--primary)] border-b-2 border-[var(--primary)]'
                    : 'font-normal text-[#4B5468] hover:text-[var(--text)]'
                }`}
              >
                <span>{item.name}</span>
                {item.href === '/messages' && hasFailedMessages && (
                  <span
                    className="size-2 rounded-full bg-[var(--attention)] ml-1.5 shrink-0"
                    title="Failed messages requiring attention"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right: Avatar Button with Account Menu */}
        <div className="flex items-center">
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

export function MobileTopHeader({ title }: { title?: string }) {
  return (
    <header className="flex md:hidden h-16 items-center justify-between border-b border-[var(--card-border)]/50 bg-white/95 backdrop-blur-md px-4 sticky top-0 z-20">
      <div className="flex items-center gap-2.5">
        <AksharaLogo size="sm" showText={false} />
        <span className="font-bold text-lg text-[var(--text)] tracking-tight">
          {title || 'Akshara Academy'}
        </span>
      </div>
      <AccountMenu />
    </header>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const [hasFailedMessages, setHasFailedMessages] = useState(false)

  useEffect(() => {
    async function checkFailed() {
      try {
        const supabase = createClient()
        const { count, error } = await supabase
          .from('message_log')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')

        if (!error) {
          setHasFailedMessages((count ?? 0) > 0)
        }
      } catch {
        // non-critical check
      }
    }
    checkFailed()
    window.addEventListener('akshara:messages-updated', checkFailed)
    return () => window.removeEventListener('akshara:messages-updated', checkFailed)
  }, [pathname])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-[24px] border-t border-[var(--card-border)]/70 shadow-lg md:hidden px-2 pt-1 pb-safe"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 select-none transition-colors ${
                isActive
                  ? 'text-[var(--primary)] font-bold'
                  : 'text-[#4B5468] hover:text-[var(--text)] font-normal'
              }`}
            >
              <div
                className={`p-1 rounded-full relative transition-colors ${
                  isActive ? 'bg-[var(--primary-light)]' : ''
                }`}
              >
                <Icon
                  className="size-6 shrink-0"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {item.href === '/messages' && hasFailedMessages && (
                  <span
                    className="absolute top-0 right-0 size-2.5 rounded-full bg-[var(--attention)] border-2 border-white"
                    title="Failed messages"
                  />
                )}
              </div>
              <span className="text-[12px] leading-tight truncate">
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
      {/* Home indicator pill space */}
      <div className="h-1 w-32 bg-slate-200/60 rounded-full mx-auto my-1" />
    </nav>
  )
}
