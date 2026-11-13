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
    <div className="rounded-[24px] bg-white border border-[#E9D5FF]/80 p-5 sm:p-6 shadow-[0_8px_28px_rgba(91,69,224,0.06)]">
      {/* Header with Title & Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#EDEEF3]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-[12px] bg-[#F4F2FD] text-[#5B45E0]">
            <Calendar className="size-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1F2438] tracking-tight">
              Today&apos;s Class Schedule
            </h2>
            <p className="text-xs font-semibold text-[#5A6378]">
              4 Periods Scheduled • 1 Ongoing
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#F8F9FE] p-1 rounded-[14px] border border-[#E9D5FF]/50 self-start sm:self-auto">
          {(['all', 'ongoing', 'upcoming'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 text-xs font-bold rounded-[10px] capitalize transition-all cursor-pointer ${
                filter === mode
                  ? 'bg-white text-[#5B45E0] shadow-xs'
                  : 'text-[#5A6378] hover:text-[#1F2438]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Timeline Cards */}
      <div className="mt-4 space-y-3">
        {filteredList.map((period) => {
          const isOngoing = period.status === 'ongoing'
          const isCompleted = period.status === 'completed'

          return (
            <div
              key={period.id}
              onClick={() => onPeriodClick?.(period)}
              className={`relative overflow-hidden rounded-[18px] border p-4 transition-all cursor-pointer ${
                isOngoing
                  ? 'border-[#10B981] bg-[#F0FDF4]/50 shadow-[0_4px_16px_rgba(16,185,129,0.12)]'
                  : isCompleted
                    ? 'border-[#EDEEF3] bg-[#FAFAFA] opacity-80'
                    : 'border-[#E9D5FF]/60 bg-white hover:border-[#5B45E0]/40 hover:shadow-xs'
              }`}
            >
              {/* Ongoing Pulse Accent Bar */}
              {isOngoing && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#10B981]" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Left: Time & Subject info */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center shrink-0 size-12 rounded-[14px] bg-[#F4F2FD] text-[#5B45E0] font-bold">
                    <span className="text-[10px] uppercase text-[#5A6378] font-bold">Period</span>
                    <span className="text-base font-black text-[#5B45E0] leading-none">
                      {period.periodNumber}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-[#1F2438]">
                        {period.subject}
                      </h3>

                      {/* Status Badges */}
                      {isOngoing && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-bold text-[#059669] border border-[#10B981]/30">
                          <Radio className="size-3 animate-pulse text-[#10B981]" />
                          In Progress
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          <CheckCircle className="size-3 text-[#059669]" />
                          Completed
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-[#5A6378] line-clamp-1">
                      {period.topic}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] font-semibold text-[#5A6378] flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 text-[#5B45E0] font-bold">
                        <Clock className="size-3" />
                        {period.timeRange}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {period.teacherName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {period.room}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Pill */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[12px] text-xs font-bold bg-[#F4F2FD] hover:bg-[#5B45E0] text-[#5B45E0] hover:text-white transition-all cursor-pointer shadow-2xs"
                  >
                    <BookOpen className="size-3.5" />
                    Study Notes
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
