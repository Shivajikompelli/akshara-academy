'use client'

import { Home, Calendar, Clock, Receipt, User } from 'lucide-react'

interface StudentNavProps {
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function StudentNav({ activeTab, onTabChange }: StudentNavProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'schedule', label: 'Routine', icon: Clock },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'fees', label: 'Fee Dues', icon: Receipt },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  return (
    <nav
      aria-label="Student Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#C7D2FE]/70 px-4 py-2 shadow-[0_-8px_25px_rgba(79,70,229,0.08)] pb-[max(0.65rem,env(safe-area-inset-bottom))]"
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
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-[16px] transition-all duration-200 ease-out cursor-pointer min-h-[48px] min-w-[56px] focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none motion-reduce:transition-none ${
                isActive
                  ? 'text-[#4F46E5]'
                  : 'text-[#475569] hover:text-[#1E1B4B]'
              }`}
            >
              {/* Soft clay active pill indicator */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#EEF2FF] rounded-[16px] -z-10 border border-[#C7D2FE]/50 shadow-inner"
                />
              )}
              <Icon className={`size-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
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
