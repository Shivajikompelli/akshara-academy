'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, Home, Copy, Check } from 'lucide-react'
import Link from 'next/link'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [supportRef] = useState(() => error.digest || 'err_' + Date.now().toString(36).slice(-6))

  useEffect(() => {
    console.error('[NEXT_APP_ROOT_ERROR]', {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  function handleCopy() {
    navigator.clipboard.writeText(supportRef).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[24px] border border-[var(--card-border)] p-6 sm:p-8 shadow-xl text-center space-y-4 animate-in fade-in-50 zoom-in-95">
        <div className="size-14 rounded-full bg-[var(--attention-bg)] text-[var(--attention-text)] flex items-center justify-center mx-auto border border-[var(--attention)]/30">
          <AlertCircle className="size-7 stroke-[2.2]" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">
            Unexpected Application Error
          </h2>
          <p className="text-xs sm:text-sm font-normal text-[var(--text-secondary)] leading-relaxed">
            An unexpected error occurred while processing your request. Your data remains safe in the database.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--primary-soft)] rounded-full text-xs text-[var(--text-secondary)] border border-[var(--card-border)]/60">
          <span>Support Ref: <code className="font-mono font-bold text-[var(--text)]">{supportRef}</code></span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
            title="Copy Reference Code for Support"
          >
            {copied ? <Check className="size-3.5 text-[var(--present-text)]" /> : <Copy className="size-3.5" />}
          </button>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto min-h-[44px] px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <RefreshCw className="size-4" />
            <span>Try Again</span>
          </button>

          <Link href="/" className="w-full sm:w-auto">
            <button
              type="button"
              className="w-full min-h-[44px] px-5 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Home className="size-4" />
              <span>Back to Overview</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}

