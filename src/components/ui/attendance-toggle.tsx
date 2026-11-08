import React from 'react'
import { Check, X } from 'lucide-react'

interface AttendanceToggleProps {
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
      className={`min-h-[44px] min-w-[104px] px-3.5 py-2 rounded-[12px] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
        isPresent
          ? 'bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30 hover:border-[var(--present)]'
          : 'bg-[var(--absent-bg)] text-[var(--absent-text)] border border-[var(--absent)]/30 hover:border-[var(--absent)] shadow-2xs'
      } ${className}`}
    >
      {isPresent ? (
        <>
          <div className="size-5 rounded-full bg-[var(--present)] text-white flex items-center justify-center shrink-0">
            <Check className="size-3.5 stroke-[3]" />
          </div>
          <span>Present</span>
        </>
      ) : (
        <>
          <div className="size-5 rounded-full bg-[var(--absent)] text-white flex items-center justify-center shrink-0">
            <X className="size-3.5 stroke-[3]" />
          </div>
          <span>Absent</span>
        </>
      )}
    </button>
  )
}

