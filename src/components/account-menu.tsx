'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InitialsAvatar, getInitials } from '@/components/ui/initials-avatar'
import { LogOut, Building2, Mail, Clock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<{
    name: string
    email: string
    lastSignIn: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'Manager'
        const email = authUser.email || 'manager@akshara.academy'
        const lastSignIn = authUser.last_sign_in_at
          ? new Date(authUser.last_sign_in_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Today'

        setUser({ name, email, lastSignIn })
      }
    }
    loadUser()
  }, [])

  // Handle Escape key and outside click to close
  const handleClose = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        handleClose()
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleClose])

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
      router.push('/login')
      router.refresh()
    } catch (err: unknown) {
      console.error('Logout error:', err)
      toast.error('Failed to log out')
      setLoading(false)
    }
  }

  const displayName = user?.name || 'Manager'

  return (
    <div className="relative">
      {/* 44px circular initials avatar button */}
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`size-11 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 hover:opacity-90 transition-all cursor-pointer select-none focus:outline-none ${
          open ? 'ring-3 ring-[var(--primary)] ring-offset-2' : ''
        }`}
      >
        <span>{getInitials(displayName)}</span>
      </button>

      {/* Dim scrim backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/25 z-40 backdrop-blur-2xs transition-opacity animate-in fade-in-0"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Card (24px radius, dialog shadow) anchored under avatar */}
      {open && (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label="Account details"
          className="absolute right-0 top-14 z-50 w-80 sm:w-88 rounded-[24px] bg-white border border-[var(--card-border)] p-6 shadow-2xl space-y-5 animate-in fade-in-0 zoom-in-95"
        >
          {/* Header: Large avatar, Name (18px bold), Role Manager */}
          <div className="flex items-center gap-4">
            <InitialsAvatar name={displayName} size="xl" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-[var(--text)] tracking-tight truncate">
                {displayName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--primary-soft)] text-[var(--primary)]">
                  <ShieldCheck className="size-3.5" />
                  <span>Manager</span>
                </span>
              </div>
            </div>
          </div>

          {/* Labeled Rows: Email, Academy, Last sign-in */}
          <div className="space-y-3 pt-3 border-t border-[#F1F2F8] text-sm">
            <div className="flex items-start gap-3">
              <Mail className="size-4.5 text-[var(--text-secondary)] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-normal text-[var(--text-secondary)] block">
                  Email
                </span>
                <span className="font-medium text-[var(--text)] text-sm truncate block">
                  {user?.email || 'Loading...'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="size-4.5 text-[var(--text-secondary)] mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-normal text-[var(--text-secondary)] block">
                  Academy
                </span>
                <span className="font-medium text-[var(--text)] text-sm block">
                  Akshara Academy
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="size-4.5 text-[var(--text-secondary)] mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-normal text-[var(--text-secondary)] block">
                  Last sign-in
                </span>
                <span className="font-medium text-[var(--text)] text-sm block">
                  {user?.lastSignIn || 'Recent'}
                </span>
              </div>
            </div>
          </div>

          {/* Full-width Log out button: outlined in --primary, 48px tall, 16px radius. Never red or orange. */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="w-full min-h-[48px] rounded-[16px] border-2 border-[var(--primary)] text-[var(--primary)] bg-white hover:bg-[var(--primary-soft)] active:bg-[var(--primary-light)] font-bold text-base flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <LogOut className="size-5" />
              <span>{loading ? 'Signing out...' : 'Log out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

