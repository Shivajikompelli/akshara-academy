'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, CalendarCheck, Receipt, MessageSquareText } from 'lucide-react'

export const NAV_ITEMS = [
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
    name: 'Message log',
    href: '/messages',
    icon: MessageSquareText,
  },
]

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`size-5 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
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
    <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-white border-t border-slate-200 flex items-stretch md:hidden shadow-lg">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 py-1 px-2 text-xs transition-colors ${
              isActive
                ? 'text-blue-700 font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`size-5 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
            <span className="truncate">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}

