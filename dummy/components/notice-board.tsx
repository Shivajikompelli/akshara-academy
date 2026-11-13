'use client'

import { Bell, AlertCircle, Calendar, ChevronRight } from 'lucide-react'
import type { AnnouncementItem } from '../data/mock-student-data'

interface NoticeBoardProps {
  announcements: AnnouncementItem[]
  onViewAll?: () => void
}

export function NoticeBoard({ announcements, onViewAll }: NoticeBoardProps) {
  return (
    <section
      aria-label="Academy Notice Board"
      className="rounded-[26px] bg-white border border-[#C7D2FE]/70 p-5 sm:p-6 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.06),0_8px_10px_-6px_rgba(79,70,229,0.03)]"
    >
      <div className="flex items-center justify-between pb-3.5 border-b border-[#EBEEF8]">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-[16px] bg-[#FFF7ED] text-[#EA580C] shadow-inner">
            <Bell className="size-6 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1E1B4B] tracking-tight">
              Academy Notice Board
            </h2>
            <p className="text-xs font-semibold text-[#475569]">
              Official circulars from school administration
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-[#4F46E5] hover:text-[#4338CA] flex items-center gap-1 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded-[6px] focus-visible:outline-none"
        >
          View All <ChevronRight className="size-3.5 stroke-[2.5]" />
        </button>
      </div>

      <div className="mt-4 space-y-3.5">
        {announcements.map((item) => (
          <div
            key={item.id}
            className={`p-4 sm:p-4.5 rounded-[20px] border transition-all duration-200 ease-out motion-reduce:transition-none ${
              item.isUrgent
                ? 'bg-[#FFF7ED]/50 border-[#FDBA74] hover:bg-[#FFF7ED]'
                : 'bg-[#F8F9FE] border-[#C7D2FE]/50 hover:bg-white hover:border-[#4F46E5]/40 hover:shadow-2xs'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      item.isUrgent
                        ? 'bg-[#FFEDD5] text-[#C2410C]'
                        : 'bg-[#EEF2FF] text-[#4F46E5]'
                    }`}
                  >
                    {item.category}
                  </span>
                  {item.isUrgent && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#EA580C]">
                      <AlertCircle className="size-3.5 stroke-[2.5]" /> Priority Notice
                    </span>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold text-[#1E1B4B] leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  {item.description}
                </p>
              </div>

              <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-[#475569] bg-white px-2.5 py-1 rounded-[10px] border border-[#EBEEF8] shadow-2xs">
                <Calendar className="size-3.5 text-[#4F46E5]" />
                {item.date}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
