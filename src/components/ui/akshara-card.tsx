import React from 'react'

interface AksharaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hero' | 'soft'
  children: React.ReactNode
}

export function AksharaCard({
  variant = 'default',
  className = '',
  children,
  style,
  ...props
}: AksharaCardProps) {
  if (variant === 'hero') {
    return (
      <div
        className={`rounded-[24px] p-6 text-white overflow-hidden relative ${className}`}
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

  if (variant === 'soft') {
    return (
      <div
        className={`rounded-[24px] p-6 bg-[var(--primary-soft)] border border-[var(--card-border)]/40 ${className}`}
        style={style}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={`rounded-[24px] p-6 bg-white border border-[var(--card-border)]/60 ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}

