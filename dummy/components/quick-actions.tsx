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
      subtitle: 'Monthly Calendar & Leaves',
      badge: '95.5%',
      icon: Calendar,
      colorBg: 'bg-[#EEF2FF]',
      colorText: 'text-[#4F46E5]',
      borderHover: 'hover:border-[#4F46E5]',
    },
    {
      id: 'fees',
      title: 'Fee Receipts',
      subtitle: 'Download PDF / PNG',
      badge: 'All Clear',
      icon: Receipt,
      colorBg: 'bg-[#ECFDF5]',
      colorText: 'text-[#059669]',
      borderHover: 'hover:border-[#10B981]',
    },
    {
      id: 'homework',
      title: 'Homework Tasks',
      subtitle: '2 Submissions Due',
      badge: '2 Due',
      icon: FileText,
      colorBg: 'bg-[#FFF7ED]',
      colorText: 'text-[#EA580C]',
      borderHover: 'hover:border-[#EA580C]',
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Desk',
      subtitle: 'Direct Teacher Query',
      badge: 'Online',
      icon: MessageSquare,
      colorBg: 'bg-[#F0FDF4]',
      colorText: 'text-[#059669]',
      borderHover: 'hover:border-[#25D366]',
    },
  ]

  return (
    <section aria-label="Quick Actions" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#1E1B4B] tracking-tight">
            Quick Actions
          </h2>
          <p className="text-xs font-medium text-[#475569]">
            Instant access to student services
          </p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5] bg-[#EEF2FF] px-2.5 py-1 rounded-[8px] border border-[#C7D2FE]/60">
          One-Tap
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {actions.map((act) => {
          const Icon = act.icon

          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onActionClick?.(act.id)}
              className={`group flex flex-col justify-between rounded-[22px] bg-white border border-[#C7D2FE]/70 p-4 sm:p-5 text-left transition-all duration-200 ease-out hover:shadow-[0_12px_28px_-6px_rgba(79,70,229,0.12)] active:scale-[0.98] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none cursor-pointer min-h-[130px] shadow-[0_4px_16px_rgba(79,70,229,0.04)] ${act.borderHover}`}
            >
              <div className="flex items-start justify-between w-full">
                <div
                  className={`flex size-12 items-center justify-center rounded-[16px] ${act.colorBg} ${act.colorText} shadow-inner transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none`}
                >
                  <Icon className="size-6 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]/60">
                  {act.badge}
                </span>
              </div>

              <div className="mt-3.5 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-[#1E1B4B] group-hover:text-[#4F46E5] transition-colors line-clamp-1">
                    {act.title}
                  </h3>
                  <ArrowRight className="size-3.5 text-[#475569] opacity-0 group-hover:opacity-100 transition-opacity motion-reduce:transition-none" />
                </div>
                <p className="text-[11px] font-medium text-[#475569] line-clamp-1">
                  {act.subtitle}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
