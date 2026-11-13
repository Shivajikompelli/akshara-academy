'use client'

import { Calendar, Receipt, FileText, MessageSquare, ArrowRight } from 'lucide-react'

interface QuickActionsProps {
  onActionClick?: (actionId: string) => void
}

export function QuickActions({ onActionClick }: QuickActionsProps) {
  const actions = [
    {
      id: 'attendance',
      title: 'My Attendance',
      subtitle: 'Calendar & Monthly Log',
      badge: '95.5%',
      icon: Calendar,
      colorBg: 'bg-[#EDEAFC]',
      colorText: 'text-[#5B45E0]',
      hoverBorder: 'hover:border-[#5B45E0]',
    },
    {
      id: 'fees',
      title: 'Fee Receipts',
      subtitle: 'Official PDF Receipts',
      badge: 'All Clear',
      icon: Receipt,
      colorBg: 'bg-[#ECFDF5]',
      colorText: 'text-[#059669]',
      hoverBorder: 'hover:border-[#10B981]',
    },
    {
      id: 'homework',
      title: 'Homework & Tasks',
      subtitle: '2 Pending Due Soon',
      badge: '2 Due',
      icon: FileText,
      colorBg: 'bg-[#FFFBEB]',
      colorText: 'text-[#D97706]',
      hoverBorder: 'hover:border-[#F59E0B]',
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Desk',
      subtitle: 'Ask Teachers & Admin',
      badge: 'Online',
      icon: MessageSquare,
      colorBg: 'bg-[#25D366]/10',
      colorText: 'text-[#059669]',
      hoverBorder: 'hover:border-[#25D366]',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-black text-[#1F2438] tracking-tight">
          Quick Actions
        </h2>
        <span className="text-xs font-semibold text-[#5A6378]">
          One-tap services
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
        {actions.map((act) => {
          const Icon = act.icon

          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onActionClick?.(act.id)}
              className={`group flex flex-col justify-between rounded-[20px] bg-white border border-[#E9D5FF]/80 p-4 text-left transition-all hover:shadow-[0_8px_20px_rgba(91,69,224,0.08)] active:scale-[0.98] cursor-pointer min-h-[120px] ${act.hoverBorder}`}
            >
              <div className="flex items-start justify-between w-full">
                <div
                  className={`flex size-11 items-center justify-center rounded-[14px] ${act.colorBg} ${act.colorText} shadow-2xs transition-transform group-hover:scale-105`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#F4F2FD] text-[#5B45E0]">
                  {act.badge}
                </span>
              </div>

              <div className="mt-3 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-[#1F2438] group-hover:text-[#5B45E0] transition-colors line-clamp-1">
                    {act.title}
                  </h3>
                  <ArrowRight className="size-3 text-[#7E869B] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] font-medium text-[#5A6378] line-clamp-1">
                  {act.subtitle}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
