'use client'

import { useState } from 'react'
import { Calendar, Clock, MapPin, User, BookOpen, CheckCircle, Radio } from 'lucide-react'
import type { ClassPeriod } from '../data/mock-student-data'

interface TodayScheduleProps {
  schedule: ClassPeriod[]
  onPeriodClick?: (period: ClassPeriod) => void
}

export function TodaySchedule({ schedule, onPeriodClick }: TodayScheduleProps) {
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'upcoming'>('all')

  const filteredList = schedule.filter((p) => {
    if (filter === 'all') return true
    return p.status === filter
  })

  return (
    <section
      aria-label="Today's Class Schedule"
      className="rounded-[26px] bg-white border border-[#C7D2FE]/70 p-5 sm:p-6 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.06),0_8px_10px_-6px_rgba(79,70,229,0.03)]"
    >
      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 pb-4 border-b border-[#EBEEF8]">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-[16px] bg-[#EEF2FF] text-[#4F46E5] shadow-inner">
            <Calendar className="size-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1E1B4B] tracking-tight">
              Today&apos;s Class Routine
            </h2>
            <p className="text-xs font-semibold text-[#475569]">
              4 Periods Scheduled • 1 Live Right Now
            </p>
          </div>
        </div>

        {/* Filter Pills with Keyboard Navigation */}
        <div
          role="tablist"
          aria-label="Schedule Filter"
          className="flex items-center gap-1.5 bg-[#EEF2FF]/60 p-1.5 rounded-[16px] border border-[#C7D2FE]/60 self-start sm:self-auto"
        >
          {(['all', 'ongoing', 'upcoming'] as const).map((mode) => {
            const isSelected = filter === mode

            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1 text-xs font-bold rounded-[12px] capitalize transition-all duration-200 ease-out cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none motion-reduce:transition-none ${
                  isSelected
                    ? 'bg-white text-[#4F46E5] shadow-xs border border-[#C7D2FE]/40'
                    : 'text-[#475569] hover:text-[#1E1B4B]'
                }`}
              >
                {mode}
              </button>
            )
          })}
        </div>
      </div>

      {/* Schedule Timeline Cards */}
      <div className="mt-4 space-y-3.5">
        {filteredList.map((period) => {
          const isOngoing = period.status === 'ongoing'
          const isCompleted = period.status === 'completed'

          return (
            <div
              key={period.id}
              onClick={() => onPeriodClick?.(period)}
              className={`group relative overflow-hidden rounded-[20px] border p-4 sm:p-4.5 transition-all duration-200 ease-out cursor-pointer active:scale-[0.99] motion-reduce:transition-none focus-within:ring-2 focus-within:ring-[#4F46E5] ${
                isOngoing
                  ? 'border-[#10B981] bg-[#F0FDF4]/70 shadow-[0_6px_20px_rgba(16,185,129,0.14)]'
                  : isCompleted
                    ? 'border-[#EBEEF8] bg-[#F8F9FE] opacity-80'
                    : 'border-[#C7D2FE]/60 bg-white hover:border-[#4F46E5]/40 hover:shadow-xs'
              }`}
            >
              {/* Ongoing Pulse Accent Bar */}
              {isOngoing && (
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#10B981]"
                />
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
                {/* Left: Time & Subject info */}
                <div className="flex items-start gap-3.5">
                  <div className="flex flex-col items-center justify-center shrink-0 size-13 rounded-[16px] bg-[#EEF2FF] text-[#4F46E5] font-black border border-[#C7D2FE]/40 shadow-inner">
                    <span className="text-[10px] uppercase text-[#475569] font-bold">
                      Period
                    </span>
                    <span className="text-lg font-black text-[#4F46E5] leading-none">
                      {period.periodNumber}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-[#1E1B4B]">
                        {period.subject}
                      </h3>

                      {/* Status Badges */}
                      {isOngoing && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#059669] border border-[#10B981]/30">
                          <Radio className="size-3 text-[#10B981] animate-pulse motion-reduce:animate-none" />
                          Live Class Now
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          <CheckCircle className="size-3 text-[#059669]" />
                          Completed
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-[#475569] line-clamp-1">
                      {period.topic}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] font-bold text-[#475569] flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 text-[#4F46E5]">
                        <Clock className="size-3.5 stroke-[2.2]" />
                        {period.timeRange}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="size-3.5" />
                        {period.teacherName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {period.room}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Pill */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-xs font-bold bg-[#EEF2FF] hover:bg-[#4F46E5] text-[#4F46E5] hover:text-white transition-all duration-200 ease-out cursor-pointer active:scale-95 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none shadow-2xs"
                  >
                    <BookOpen className="size-3.5 stroke-[2.2]" />
                    View Notes
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
