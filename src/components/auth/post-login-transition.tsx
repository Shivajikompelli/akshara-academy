'use client'

import React, { useState, useEffect, useRef } from 'react'

interface PostLoginTransitionProps {
  /** Mode: 'login' runs Phase 1 & 2 (0-750ms). 'dock' runs Phase 3 (750-1100ms / 350ms). */
  mode?: 'login' | 'dock'
  /** If provided, manually control whether the transition overlay is visible */
  active?: boolean
  /** Callback fired when this phase or sequence completes */
  onComplete?: () => void
  /** Backward-compatibility alias for mode='dock' */
  isDashboardDock?: boolean
}

export function PostLoginTransition({
  mode = 'login',
  active = true,
  onComplete,
  isDashboardDock = false,
}: PostLoginTransitionProps) {
  const effectiveMode = isDashboardDock ? 'dock' : mode

  // Phases:
  // For 'login': 'center' (0-250ms) -> 'micro' (250-750ms) -> done
  // For 'dock': 'dock-start' (0-30ms) -> 'docking' (30-330ms) -> done
  const [phase, setPhase] = useState<'center' | 'micro' | 'dock-start' | 'docking' | 'done'>(
    effectiveMode === 'dock' ? 'dock-start' : 'center'
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
      // Accessibility fast path: quick 150ms cross-fade
      const timer = setTimeout(() => {
        setPhase('done')
        onComplete?.()
      }, 150)
      return () => clearTimeout(timer)
    }

    if (effectiveMode === 'login') {
      // Phase 1 (0 - 250ms): Form exit and logo center (1.2x)
      // Phase 2 (250ms - 750ms): Centered micro-animation with SVG ring draw + cap pulse + subtext
      const tMicro = setTimeout(() => {
        setPhase('micro')
      }, 250)

      // At 750ms: Complete Phase 2 on login page and trigger handoff
      const tDone = setTimeout(() => {
        if (hasFinishedRef.current) return
        hasFinishedRef.current = true
        onComplete?.()
      }, 750)

      return () => {
        clearTimeout(tMicro)
        clearTimeout(tDone)
      }
    } else {
      // Phase 3: Shared-element dock on the dashboard (350ms total)
      // 0ms - 30ms: Render centered at 1.2x to match the login screen perfectly
      // 30ms: Measure target header logo and animate dock to top-left (300ms)
      const tDock = setTimeout(() => {
        if (typeof window !== 'undefined') {
          // Find the visible header logo (desktop or mobile)
          const targets = document.querySelectorAll('[data-header-logo]')
          let visibleTarget: HTMLElement | null = null
          for (const el of Array.from(targets)) {
            const htmlEl = el as HTMLElement
            if (htmlEl.offsetParent !== null || htmlEl.getBoundingClientRect().height > 0) {
              visibleTarget = htmlEl
              break
            }
          }

          if (visibleTarget) {
            const rect = visibleTarget.getBoundingClientRect()
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
            // Fallback based on responsive viewport
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

        setPhase('docking')
        // Fade out background canvas as logo docks
        setTimeout(() => {
          setOverlayOpacity(0)
        }, 50)
      }, 30)

      // At 350ms: Docking sequence finishes, cards are fully revealed
      const tDone = setTimeout(() => {
        if (hasFinishedRef.current) return
        hasFinishedRef.current = true
        setPhase('done')
        onComplete?.()
      }, 350)

      return () => {
        clearTimeout(tDock)
        clearTimeout(tDone)
      }
    }
  }, [active, effectiveMode, onComplete])

  if (!active || phase === 'done') {
    return null
  }

  const isDocking = phase === 'docking'

  // Hardware-accelerated transform style
  const logoTransform = isDocking
    ? `translate3d(${dockCoords.x}px, ${dockCoords.y}px, 0) scale(${dockCoords.scale})`
    : phase === 'micro' || phase === 'center' || phase === 'dock-start'
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
