'use client'

import { useState, useEffect } from 'react'
import { Bell, Sparkles } from 'lucide-react'
import type { StudentProfile } from '../data/mock-student-data'

interface StudentHeroProps {
  student: StudentProfile
  onNotificationClick?: () => void
}

export function StudentHero({ student, onNotificationClick }: StudentHeroProps) {
  const [todayFormatted, setTodayFormatted] = useState('Friday, 13 Nov 2026')

  useEffect(() => {
    try {
      const formatted = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date())
      setTodayFormatted(formatted)
    } catch {
      // Keep default
    }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#5B45E0] via-[#6349E8] to-[#7B61FF] p-5 sm:p-7 text-white shadow-[0_12px_32px_rgba(91,69,224,0.22)]">
      {/* Subtle Ambient Decorative Circles for Smooth Flutter-like Depth */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-white/10 blur-xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-[#886DFC]/30 blur-2xl" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Greeting & Student Profile Badge */}
        <div className="flex items-center gap-3.5">
          {/* Avatar with Status Ring */}
          <div className="relative shrink-0">
            <div className="flex size-13 sm:size-14 items-center justify-center rounded-[18px] bg-white/20 text-white font-extrabold text-lg sm:text-xl shadow-inner border border-white/30 backdrop-blur-md">
              {student.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            {/* Active Status Dot */}
            <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-[#5B45E0] bg-[#10B981]" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white/90 backdrop-blur-md border border-white/20">
                <Sparkles className="size-3 text-amber-300" />
                {student.academyName}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Hi, {student.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-xs sm:text-sm font-medium text-white/80">
              {student.classLevel} • {student.section} • Roll #{student.rollNumber}
            </p>
          </div>
        </div>

        {/* Right: Date Badge & Notification Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-white/15 sm:border-t-0">
          <div className="text-left sm:text-right">
            <span className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider">
              Today
            </span>
            <span className="text-xs sm:text-sm font-bold text-white">
              {todayFormatted}
            </span>
          </div>

          <button
            type="button"
            onClick={onNotificationClick}
            aria-label="View notifications"
            className="relative flex size-11 items-center justify-center rounded-[16px] bg-white/15 text-white backdrop-blur-md border border-white/20 transition-all hover:bg-white/25 active:scale-95 cursor-pointer shadow-sm"
          >
            <Bell className="size-5" />
            <span className="absolute top-2 right-2 size-2.5 rounded-full bg-amber-400 ring-2 ring-[#5B45E0]" />
          </button>
        </div>
      </div>
    </div>
  )
}
