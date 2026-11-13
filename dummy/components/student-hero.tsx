'use client'

import { useState, useEffect } from 'react'
import { Bell, Sparkles, GraduationCap, ShieldCheck } from 'lucide-react'
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
      // Keep static fallback
    }
  }, [])

  return (
    <section
      aria-label="Student Profile Header"
      className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#4F46E5] via-[#5B45E0] to-[#7C3AED] p-5 sm:p-7 text-white shadow-[0_14px_35px_rgba(79,70,229,0.22),inset_0_1px_0_rgba(255,255,255,0.25)] border border-white/20"
    >
      {/* Ambient Depth Accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-12 size-52 rounded-full bg-[#A78BFA]/25 blur-3xl"
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Avatar with Verified Ring & Student Identification */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {/* Claymorphic Soft 3D Avatar */}
            <div className="flex size-14 sm:size-16 items-center justify-center rounded-[20px] bg-white/20 text-white font-black text-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_6px_16px_rgba(0,0,0,0.15)] border border-white/30 backdrop-blur-md">
              <GraduationCap className="size-8 text-white drop-shadow-sm" />
            </div>
            {/* Active Attendance Badge */}
            <span
              title="Active enrolled student"
              className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#10B981] ring-2 ring-[#4F46E5] text-white shadow-xs"
            >
              <ShieldCheck className="size-3 stroke-[2.5]" />
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold text-white/95 backdrop-blur-md border border-white/25">
                <Sparkles className="size-3 text-amber-300" />
                {student.academyName}
              </span>
              <span className="text-[11px] font-semibold text-white/80 bg-black/15 px-2 py-0.5 rounded-full">
                {student.admissionNo}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-xs">
              Welcome back, {student.name.split(' ')[0]}
            </h1>

            <p className="text-xs sm:text-sm font-medium text-white/85">
              {student.classLevel} • {student.section} • Roll #{student.rollNumber}
            </p>
          </div>
        </div>

        {/* Right: Date Badge & Keyboard-Accessible Notification Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t border-white/15 sm:border-t-0">
          <div className="text-left sm:text-right">
            <span className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
              Today
            </span>
            <span className="text-xs sm:text-sm font-bold text-white">
              {todayFormatted}
            </span>
          </div>

          <button
            type="button"
            onClick={onNotificationClick}
            aria-label="View 2 unread academy notifications"
            className="relative flex size-12 items-center justify-center rounded-[16px] bg-white/15 text-white backdrop-blur-md border border-white/25 transition-all duration-200 ease-out hover:bg-white/25 active:scale-95 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none cursor-pointer shadow-sm"
          >
            <Bell className="size-5" />
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-[#EA580C] ring-2 ring-[#4F46E5]"
            />
          </button>
        </div>
      </div>
    </section>
  )
}
