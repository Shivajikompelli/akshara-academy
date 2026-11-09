import React from 'react'

export interface InitialsAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function getInitials(fullName: string): string {
  if (!fullName || !fullName.trim()) return '?'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function InitialsAvatar({
  name,
  size = 'md',
  className = '',
}: InitialsAvatarProps) {
  const initials = getInitials(name)

  const sizeStyles = {
    sm: 'size-8 text-xs',
    md: 'size-11 text-sm',        // 44px touch target
    lg: 'size-12 text-base',
    xl: 'size-16 text-xl',        // 64px for account menu
  }[size]

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold select-none shrink-0 border border-[var(--card-border)]/70 bg-[var(--primary-light)] text-[var(--primary)] ${sizeStyles} ${className}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}
