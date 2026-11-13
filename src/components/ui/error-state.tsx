'use client'

import React from 'react'
import { AlertCircle, RefreshCw, Copy, Check } from 'lucide-react'
import { useState } from 'react'

export interface ErrorStateProps {
  title?: string
  message?: string
  requestId?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * Standardized in-section or in-card error component adhering to the Akshara design profile.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this information. Please try again.',
  requestId,
  onRetry,
  retryLabel = 'Try Again',
  className = '',
}: ErrorStateProps) {
  const [copied, setCopied] = useState(false)

  function handleCopyReference() {
    if (!requestId) return
    navigator.clipboard.writeText(requestId).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div
      role="alert"
      className={`p-6 sm:p-8 bg-white rounded-[24px] border border-[var(--card-border)] shadow-2xs text-center space-y-3.5 max-w-lg mx-auto ${className}`}
    >
      <div className="size-12 rounded-full bg-[var(--attention-bg)] text-[var(--attention-text)] flex items-center justify-center mx-auto border border-[var(--attention)]/30">
        <AlertCircle className="size-6 stroke-[2.2]" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--text)] tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm font-normal text-[var(--text-secondary)] leading-relaxed">
          {message}
        </p>
      </div>

      {requestId && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--primary-soft)] rounded-full text-xs text-[var(--text-secondary)] border border-[var(--card-border)]/60">
          <span>Ref: <code className="font-mono font-bold text-[var(--text)]">{requestId}</code></span>
          <button
            type="button"
            onClick={handleCopyReference}
            className="p-1 hover:text-[var(--primary)] transition-colors cursor-pointer"
            title="Copy Reference ID for Support"
          >
            {copied ? <Check className="size-3 text-[var(--present-text)]" /> : <Copy className="size-3" />}
          </button>
        </div>
      )}

      {onRetry && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <RefreshCw className="size-4" />
            <span>{retryLabel}</span>
          </button>
        </div>
      )}
    </div>
  )
}

