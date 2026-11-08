import React from 'react'

interface AksharaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showText?: boolean
}

export function AksharaLogo({
  size = 'md',
  className = '',
  showText = false,
}: AksharaLogoProps) {
  // Dimensions and radiuses according to profile (squircle radius 28px for large, proportionally scaled)
  const sizeMap = {
    sm: { box: 'size-9', radius: 'rounded-[14px]', icon: 18, shadow: 'shadow-xs' },
    md: { box: 'size-11', radius: 'rounded-[18px]', icon: 22, shadow: 'shadow-sm' },
    lg: { box: 'size-14', radius: 'rounded-[24px]', icon: 28, shadow: 'shadow-md' },
    xl: { box: 'size-18', radius: 'rounded-[28px]', icon: 34, shadow: 'shadow-lg' },
  }

  const cfg = sizeMap[size]

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`${cfg.box} ${cfg.radius} flex items-center justify-center text-white shrink-0`}
        style={{
          background: 'var(--hero-gradient)',
          boxShadow: '0 8px 20px var(--hero-shadow)',
        }}
      >
        {/* Custom graduation-cap glyph with stroke 2.1 and round caps per profile */}
        <svg
          width={cfg.icon}
          height={cfg.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
          <path d="M22 10v6" />
          <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-lg leading-tight text-[var(--text)] tracking-tight">
            Akshara Academy
          </span>
          <span className="text-xs font-normal text-[var(--text-secondary)]">
            Management Portal
          </span>
        </div>
      )}
    </div>
  )
}

