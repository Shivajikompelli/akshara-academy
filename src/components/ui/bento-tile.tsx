import React from 'react'

export interface BentoTileProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'hero' | 'stat' | 'list' | 'default'
  tint?: 'green' | 'orange' | 'purple' | 'neutral'
  label?: string
  displayNumber?: React.ReactNode
  heading?: React.ReactNode
  headingAction?: React.ReactNode
  children?: React.ReactNode
}

export function BentoTile({
  variant = 'default',
  tint = 'neutral',
  label,
  displayNumber,
  heading,
  headingAction,
  className = '',
  children,
  style,
  ...props
}: BentoTileProps) {
  // 1. Hero Variant (Purple Gradient, white text, 24px radius)
  if (variant === 'hero') {
    return (
      <div
        className={`rounded-[24px] p-[18px] sm:p-[22px] text-white relative overflow-hidden flex flex-col justify-between ${className}`}
        style={{
          background: 'var(--hero-gradient)',
          boxShadow: '0 12px 28px var(--hero-shadow)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    )
  }

  // 2. Stat Variant (Tinted fill, small label 14px, display number 30-40px/700)
  if (variant === 'stat') {
    const tintStyles = {
      green: 'bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/20',
      orange: 'bg-[var(--attention-bg)] text-[var(--attention-text)] border border-[var(--attention)]/30',
      purple: 'bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--card-border)]/60',
      neutral: 'bg-white text-[var(--text)] border border-[var(--card-border)]/60',
    }[tint]

    return (
      <div
        className={`rounded-[24px] p-[18px] sm:p-[22px] flex flex-col justify-between ${tintStyles} ${className}`}
        style={style}
        {...props}
      >
        <div>
          {label && (
            <span className="text-sm font-normal text-[var(--text-secondary)] block">
              {label}
            </span>
          )}
          {displayNumber && (
            <div className="text-[32px] sm:text-[36px] font-bold tracking-tight mt-1 leading-none">
              {displayNumber}
            </div>
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    )
  }

  // 3. List Variant (White, 1px border, heading, rows with thin dividers)
  if (variant === 'list') {
    return (
      <div
        className={`rounded-[24px] bg-white border border-[var(--card-border)] overflow-hidden flex flex-col ${className}`}
        style={style}
        {...props}
      >
        {heading && (
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#F1F2F8]">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
              {heading}
            </h3>
            {headingAction && <div>{headingAction}</div>}
          </div>
        )}
        <div className="divide-y divide-[#F1F2F8] flex-1">{children}</div>
      </div>
    )
  }

  // Default white tile (24px radius, 1px border)
  return (
    <div
      className={`rounded-[24px] p-[18px] sm:p-[22px] bg-white border border-[var(--card-border)] ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}

