import React from 'react'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export type FeeStatusType = 'paid' | 'pending' | 'partial' | 'overdue'

interface StatusBadgeProps {
  status: FeeStatusType | string
  daysOverdue?: number
  className?: string
}

export function StatusBadge({
  status,
  daysOverdue,
  className = '',
}: StatusBadgeProps) {
  const norm = String(status).toLowerCase()

  switch (norm) {
    case 'paid':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/20 ${className}`}
        >
          <CheckCircle2 className="size-3.5 stroke-[2.5]" />
          <span>Paid</span>
        </span>
      )
    case 'partial':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn)]/20 ${className}`}
        >
          <Clock className="size-3.5 stroke-[2.5]" />
          <span>Partial</span>
        </span>
      )
    case 'overdue':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--absent-bg)] text-[var(--absent-text)] border border-[var(--absent)]/20 ${className}`}
        >
          <AlertCircle className="size-3.5 stroke-[2.5]" />
          <span>Overdue{daysOverdue ? ` (${daysOverdue}d)` : ''}</span>
        </span>
      )
    case 'pending':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--primary-soft)] text-[var(--text-secondary)] border border-[var(--card-border)]/50 ${className}`}
        >
          <Clock className="size-3.5" />
          <span>Pending</span>
        </span>
      )
  }
}

