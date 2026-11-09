import React from 'react'

export type StatusWordType =
  | 'paid'
  | 'pending'
  | 'partial'
  | 'overdue'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'queued'
  | 'present'
  | 'absent'

export interface StatusWordProps {
  status: StatusWordType | string
  daysOverdue?: number
  className?: string
}

export function StatusWord({ status, daysOverdue, className = '' }: StatusWordProps) {
  const normalized = status.toLowerCase()

  switch (normalized) {
    case 'paid':
      return (
        <span className={`font-bold text-sm text-[var(--present-text)] ${className}`}>
          Paid
        </span>
      )
    case 'pending':
      return (
        <span className={`font-bold text-sm text-[var(--text-secondary)] ${className}`}>
          Pending
        </span>
      )
    case 'partial':
      return (
        <span className={`font-bold text-sm text-[var(--attention-text)] ${className}`}>
          Partial
        </span>
      )
    case 'overdue':
      return (
        <span className={`font-bold text-sm text-[var(--attention-text)] ${className}`}>
          Overdue{typeof daysOverdue === 'number' && daysOverdue > 0 ? ` ${daysOverdue}d` : ''}
        </span>
      )
    case 'sent':
    case 'delivered':
    case 'read':
      return (
        <span className={`font-bold text-sm text-[var(--present-text)] ${className}`}>
          Sent
        </span>
      )
    case 'failed':
      return (
        <span className={`font-bold text-sm text-[var(--attention-text)] ${className}`}>
          Failed
        </span>
      )
    case 'queued':
      return (
        <span className={`font-bold text-sm text-[var(--text-secondary)] ${className}`}>
          Queued
        </span>
      )
    case 'present':
      return (
        <span className={`font-bold text-sm text-[var(--present-text)] ${className}`}>
          Present
        </span>
      )
    case 'absent':
      return (
        <span className={`font-bold text-sm text-[var(--attention-text)] ${className}`}>
          Absent
        </span>
      )
    default:
      return (
        <span className={`font-bold text-sm text-[var(--text-secondary)] ${className}`}>
          {status}
        </span>
      )
  }
}

