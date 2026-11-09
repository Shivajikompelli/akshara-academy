import React from 'react'
import { Check, X } from 'lucide-react'

export interface AttendanceToggleProps {
  status: 'present' | 'absent'
  onToggle: () => void
  disabled?: boolean
  className?: string
}

export function AttendanceToggle({
  status,
  onToggle,
  disabled = false,
  className = '',
}: AttendanceToggleProps) {
  const isPresent = status === 'present'

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={`Mark as ${isPresent ? 'absent' : 'present'}`}
      className={`min-h-[44px] min-w-[108px] px-3.5 py-2 rounded-[12px] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs ${
        isPresent
          ? 'bg-[#047857] text-white hover:bg-[#036246]'
          : 'bg-[#FFE0BD] text-[#9A4A00] border border-[#FDBA74]/50 hover:bg-[#FFD7A8]'
      } ${className}`}
    >
      {isPresent ? (
        <>
          <div className="size-5 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0">
            <Check className="size-3.5 stroke-[3]" />
          </div>
          <span>Present</span>
        </>
      ) : (
        <>
          <div className="size-5 rounded-full bg-[#9A4A00]/15 text-[#9A4A00] flex items-center justify-center shrink-0">
            <X className="size-3.5 stroke-[3]" />
          </div>
          <span>Absent</span>
        </>
      )}
    </button>
  )
}
