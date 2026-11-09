'use client'

import React from 'react'

export interface PillFilterOption<T extends string = string> {
  id: T
  label: string
  count?: number
}

export interface PillFiltersProps<T extends string = string> {
  options: PillFilterOption<T>[]
  selected: T
  onSelect: (id: T) => void
  className?: string
}

export function PillFilters<T extends string = string>({
  options,
  selected,
  onSelect,
  className = '',
}: PillFiltersProps<T>) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="tablist">
      {options.map((opt) => {
        const isSelected = selected === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(opt.id)}
            className={`min-h-[44px] px-4 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 select-none ${
              isSelected
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-xs border border-[var(--primary)]/30'
                : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)] hover:text-[var(--text)]'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isSelected
                    ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                    : 'bg-slate-100 text-[var(--text-secondary)]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

