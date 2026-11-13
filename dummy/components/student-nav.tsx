'use client'

import { Home, Calendar, Clock, Receipt, User } from 'lucide-react'

interface StudentNavProps {
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function StudentNav({ activeTab, onTabChange }: StudentNavProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'schedule', label: 'Classes', icon: Clock },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'fees', label: 'Fees', icon: Receipt },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  return (
    <nav
      aria-label="Student Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E9D5FF]/80 px-4 py-2 shadow-[0_-4px_20px_rgba(91,69,224,0.06)] pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-[16px] transition-all cursor-pointer min-h-[44px] min-w-[56px] ${
                isActive
                  ? 'text-[#5B45E0]'
                  : 'text-[#5A6378] hover:text-[#1F2438]'
              }`}
            >
              {/* Flutter-style soft active pill indicator */}
              {isActive && (
                <span className="absolute inset-0 bg-[#F4F2FD] rounded-[14px] -z-10 animate-in fade-in zoom-in-95 duration-150" />
              )}
              <Icon className={`size-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              <span className={`text-[11px] mt-1 ${isActive ? 'font-black' : 'font-semibold'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
