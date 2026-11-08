'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, CalendarCheck, Receipt, MessageSquareText } from 'lucide-react'

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
    icon: Receipt,
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: MessageSquareText,
  },
]

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1.5 px-3 py-6">
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
            className={`min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-sm font-bold transition-all ${
              isActive
                ? 'bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--card-border)]/60'
                : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text)]'
            }`}
          >
            <Icon
              className={`size-5 shrink-0 transition-colors ${
                isActive ? 'text-[var(--primary)]' : 'text-[var(--text-decor)]'
              }`}
            />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-[var(--card-border)]/50 flex items-stretch lg:hidden shadow-lg px-1"
      aria-label="Mobile Navigation"
    >
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
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1 px-1 text-xs transition-colors select-none ${
              isActive
                ? 'text-[var(--primary)] font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)] font-normal'
            }`}
          >
            <div
              className={`p-1 rounded-full transition-colors ${
                isActive ? 'bg-[var(--primary-soft)]' : ''
              }`}
            >
              <Icon
                className={`size-5 shrink-0 ${
                  isActive ? 'text-[var(--primary)] stroke-[2.5]' : 'text-[var(--text-decor)]'
                }`}
              />
            </div>
            <span className="truncate text-xs leading-tight">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
