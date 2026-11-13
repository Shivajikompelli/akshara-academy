'use client'

import { Bell, AlertCircle, Calendar, ChevronRight } from 'lucide-react'
import type { AnnouncementItem } from '../data/mock-student-data'

interface NoticeBoardProps {
  announcements: AnnouncementItem[]
  onViewAll?: () => void
}

export function NoticeBoard({ announcements, onViewAll }: NoticeBoardProps) {
  return (
    <div className="rounded-[24px] bg-white border border-[#E9D5FF]/80 p-5 sm:p-6 shadow-[0_8px_28px_rgba(91,69,224,0.06)]">
      <div className="flex items-center justify-between pb-3.5 border-b border-[#EDEEF3]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-[12px] bg-[#FFFBEB] text-[#D97706]">
            <Bell className="size-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1F2438] tracking-tight">
              Academy Notice Board
            </h2>
            <p className="text-xs font-semibold text-[#5A6378]">
              Important updates from school management
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-[#5B45E0] hover:underline flex items-center gap-1 cursor-pointer"
        >
          View All <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="mt-3.5 space-y-3">
        {announcements.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-[18px] border transition-all ${
              item.isUrgent
                ? 'bg-[#FFFBEB]/40 border-[#F59E0B]/40 hover:bg-[#FFFBEB]/70'
                : 'bg-[#F8F9FE] border-[#E9D5FF]/50 hover:bg-white hover:border-[#5B45E0]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                      item.isUrgent
                        ? 'bg-[#FEF3C7] text-[#B45309]'
                        : 'bg-[#EDEAFC] text-[#5B45E0]'
                    }`}
                  >
                    {item.category}
                  </span>
                  {item.isUrgent && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#D97706]">
                      <AlertCircle className="size-3" /> Important
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-[#1F2438] leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[#5A6378] leading-relaxed">
                  {item.description}
                </p>
              </div>

              <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#5A6378] bg-white/80 px-2 py-1 rounded-[8px] border border-[#EDEEF3]">
                <Calendar className="size-3 text-[#5B45E0]" />
                {item.date}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
