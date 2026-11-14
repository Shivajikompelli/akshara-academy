'use client'

import React, { useState, useEffect, useRef } from 'react'

interface PostLoginTransitionProps {
  /** If provided, manually control whether the transition overlay is visible */
  active?: boolean
  /** Callback fired when the entire sequence finishes (~1.1s) */
  onComplete?: () => void
  /** If true, runs the dock-in phase directly on the dashboard */
  isDashboardDock?: boolean
}

export function PostLoginTransition({
  active = true,
  onComplete,
  isDashboardDock = false,
}: PostLoginTransitionProps) {
  // Phase 1: 0ms-250ms (Center & Scale 1.2x)
  // Phase 2: 250ms-750ms (SVG Micro-animation + "Preparing your classes...")
  // Phase 3: 750ms-1100ms (Dock to top-left header & 0.5x scale)
  const [phase, setPhase] = useState<'center' | 'micro' | 'dock' | 'done'>(
    isDashboardDock ? 'micro' : 'center'
  )
  const [dockCoords, setDockCoords] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1.2,
  })
  const [overlayOpacity, setOverlayOpacity] = useState(1)
  const hasFinishedRef = useRef(false)

  useEffect(() => {
    if (!active) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Accessibility fast path: 150ms gentle cross-fade
      const timer = setTimeout(() => {
        setPhase('done')
        onComplete?.()
      }, 150)
      return () => clearTimeout(timer)
    }

    // Determine starting offset if coming from login page via sessionStorage
    let elapsed = 0
    try {
      const storedStart = sessionStorage.getItem('akshara_post_login_start')
      if (storedStart) {
        elapsed = Math.max(0, Date.now() - Number(storedStart))
      }
    } catch {
      // Ignore storage errors
    }

    // Step 1: Center & Scale up (0 - 250ms)
    const tMicro = setTimeout(() => {
      setPhase('micro')
    }, Math.max(0, 250 - elapsed))

    // Step 2: Begin Docking to Top-Left Header (at 750ms)
    const tDock = setTimeout(() => {
      // Compute exact pixel coordinates of destination header logo
      if (typeof window !== 'undefined') {
        const targetEl =
          (document.querySelector('[data-header-logo]') as HTMLElement) ||
          (document.getElementById('desktop-header-logo') as HTMLElement) ||
          (document.getElementById('mobile-header-logo') as HTMLElement)

        if (targetEl) {
          const rect = targetEl.getBoundingClientRect()
          const targetX = rect.left + rect.width / 2
          const targetY = rect.top + rect.height / 2
          const centerX = window.innerWidth / 2
          const centerY = window.innerHeight / 2

          setDockCoords({
            x: targetX - centerX,
            y: targetY - centerY,
            scale: 0.5,
          })
        } else {
          // Fallback based on viewport
          const isMobile = window.innerWidth < 768
          const targetX = isMobile ? 34 : Math.max(48, (window.innerWidth - 1100) / 2 + 48)
          const targetY = isMobile ? 32 : 36
          setDockCoords({
            x: targetX - window.innerWidth / 2,
            y: targetY - window.innerHeight / 2,
            scale: 0.5,
          })
        }
      }

      setPhase('dock')
      // Fade out background canvas as logo docks
      setTimeout(() => {
        setOverlayOpacity(0)
      }, 50)
    }, Math.max(0, 750 - elapsed))

    // Step 3: Complete Sequence & Cleanup (at 1100ms)
    const tDone = setTimeout(() => {
      if (hasFinishedRef.current) return
      hasFinishedRef.current = true
      setPhase('done')
      try {
        sessionStorage.removeItem('akshara_post_login_start')
      } catch {
        // Ignore
      }
      onComplete?.()
    }, Math.max(100, 1100 - elapsed))

    return () => {
      clearTimeout(tMicro)
      clearTimeout(tDock)
      clearTimeout(tDone)
    }
  }, [active, onComplete])

  if (!active || phase === 'done') {
    return null
  }

  const isDocking = phase === 'dock'

  // Dynamic hardware-accelerated transform style
  const logoTransform = isDocking
    ? `translate3d(${dockCoords.x}px, ${dockCoords.y}px, 0) scale(${dockCoords.scale})`
    : phase === 'micro' || phase === 'center'
    ? 'translate3d(0, 0, 0) scale(1.2)'
    : 'translate3d(0, 0, 0) scale(1)'

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--app-bg)] pointer-events-none select-none transition-opacity duration-250 ease-out"
      style={{
        opacity: overlayOpacity,
        willChange: 'opacity',
      }}
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Animated App Logo Squircle */}
        <div
          className="relative transition-transform"
          style={{
            transform: logoTransform,
            transitionDuration: isDocking ? '300ms' : '250ms',
            transitionTimingFunction: isDocking
              ? 'cubic-bezier(0.4, 0, 0.2, 1)'
              : 'cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
          }}
        >
          {/* Logo Squircle with Brand Hero Gradient */}
          <div
            className="size-18 rounded-[28px] flex items-center justify-center text-white shrink-0 shadow-xl"
            style={{
              background: 'var(--hero-gradient)',
              boxShadow: '0 12px 28px var(--hero-shadow)',
            }}
          >
            {/* Custom graduation-cap glyph with academic pulse */}
            <svg
              width={34}
              height={34}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={phase === 'micro' ? 'animate-cap-pulse' : ''}
            >
              <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
              <path d="M22 10v6" />
              <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
            </svg>
          </div>

          {/* Micro-Animation: Circular Progress Stroke Drawing around Squircle */}
          {phase === 'micro' && (
            <svg
              className="absolute -inset-3.5 size-[100px] -rotate-90 pointer-events-none"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="rgba(91, 69, 224, 0.12)"
                strokeWidth="3.5"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="url(#akshara-ring-grad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="animate-ring-draw"
              />
              <defs>
                <linearGradient id="akshara-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5B45E0" />
                  <stop offset="60%" stopColor="#886DFC" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>

        {/* Subtext below centered logo (fades in 250ms, fades out on dock) */}
        <div
          className={`mt-6 text-center transition-all duration-200 ${
            phase === 'micro'
              ? 'opacity-100 translate-y-0 animate-status-fade-in'
              : 'opacity-0 translate-y-1'
          }`}
        >
          <span className="text-base font-bold text-[var(--text)] tracking-tight block">
            Akshara Academy
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)] mt-0.5 block">
            Preparing your classes...
          </span>
        </div>
      </div>
    </div>
  )
}
