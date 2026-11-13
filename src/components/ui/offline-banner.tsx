'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'

/**
 * Non-blocking connectivity status bar that alerts the manager
 * when connection drops, and briefly displays a reassuring "Back online" pill upon restoration.
 */
export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus()
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (isOnline && wasOffline) {
      const showTimer = setTimeout(() => {
        setShowReconnected(true)
      }, 0)
      const hideTimer = setTimeout(() => {
        setShowReconnected(false)
      }, 4000)
      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [isOnline, wasOffline])

  if (!isOnline) {
    return (
      <aside
        aria-live="assertive"
        className="w-full bg-[var(--attention-bg)] border-b border-[var(--attention)]/30 text-[var(--attention-text)] px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-2xs z-40 relative animate-in fade-in slide-in-from-top-1"
      >
        <div className="max-w-[1100px] mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 shrink-0 text-[var(--attention-text)]" />
            <span>
              <strong>You are offline.</strong> Changes may not save until connectivity is restored.
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-white border border-[var(--attention)]/40 hover:bg-[var(--attention-bg)] font-bold text-xs cursor-pointer transition-colors shrink-0"
          >
            <RefreshCw className="size-3" />
            <span>Check Connection</span>
          </button>
        </div>
      </aside>
    )
  }

  if (showReconnected) {
    return (
      <aside
        aria-live="polite"
        className="w-full bg-[var(--present-bg)] border-b border-[var(--present)]/30 text-[var(--present-text)] px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs z-40 relative animate-in fade-in slide-in-from-top-1"
      >
        <Wifi className="size-4 shrink-0 text-[var(--present-text)]" />
        <span>Connection restored. You are back online!</span>
      </aside>
    )
  }

  return null
}

