import React from 'react'

export interface AksharaButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  loading?: boolean
}

export function AksharaButton({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: AksharaButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-bold tracking-tight rounded-[16px] transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2'

  const sizeStyles = {
    sm: 'min-h-[40px] px-4 text-sm gap-1.5',
    md: 'min-h-[48px] px-6 text-base gap-2',
    lg: 'min-h-[52px] px-7 text-base gap-2.5',
  }[size]

  const variantStyles = {
    primary:
      'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:opacity-95 shadow-xs',
    secondary:
      'bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary-light)] border border-[var(--card-border)]',
    tertiary:
      'bg-transparent text-[var(--primary)] hover:bg-[var(--primary-soft)] active:bg-[var(--primary-light)]',
    destructive:
      'bg-[#9A4A00] text-white hover:bg-[#853E00] active:opacity-95 shadow-xs',
  }[variant]

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin size-4 text-current shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  )
}

