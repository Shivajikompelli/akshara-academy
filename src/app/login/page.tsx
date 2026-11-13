'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AksharaLogo } from '@/components/ui/akshara-logo'
import { AksharaButton } from '@/components/ui/akshara-button'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0)

  // Check if redirected due to unauthorized account
  useEffect(() => {
    let ignore = false
    const timer = setTimeout(() => {
      if (ignore || typeof window === 'undefined') return
      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'unauthorized') {
        setErrorMsg(
          'Access denied: Your account is not authorized to access the Akshara Academy management portal.'
        )
      }
    }, 0)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [])

  // Countdown timer when temporarily locked out
  useEffect(() => {
    if (lockoutSeconds <= 0) return
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [lockoutSeconds])

  function handleKeyEvent(e: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (lockoutSeconds > 0) return

    setErrorMsg(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errorObj = typeof data.error === 'object' && data.error !== null ? data.error : null
        const errorMessage = errorObj?.message || (typeof data.error === 'string' ? data.error : 'Invalid email or password.')
        const retryAfter = data.retry_after_seconds || errorObj?.retryAfterSeconds

        if (res.status === 429 && retryAfter) {
          setLockoutSeconds(Number(retryAfter) || 900)
        }
        setErrorMsg(errorMessage)
        setPassword('')
        setIsLoading(false)
        return
      }

      if (data.success || data.user) {
        router.push('/')
        router.refresh()
      } else {
        setErrorMsg('Sign-in could not be verified. Please try again.')
        setIsLoading(false)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('An unexpected network error occurred. Please try again.')
      }
      setIsLoading(false)
    }
  }

  const isLocked = lockoutSeconds > 0
  const lockMinutes = Math.floor(lockoutSeconds / 60)
  const lockRemSeconds = String(lockoutSeconds % 60).padStart(2, '0')

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 pt-safe pb-safe bg-[var(--app-bg)] text-[var(--text)]">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <AksharaLogo size="xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Akshara Academy
          </h1>
          <p className="text-sm font-normal text-[var(--text-secondary)]">
            Sign in to manage students, attendance and fees
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[24px] bg-white border border-[var(--card-border)]/70 p-6 sm:p-8 shadow-xs space-y-5">
          {/* Authorized Managers Badge */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[12px] bg-[var(--primary-soft)] border border-[var(--card-border)]/60">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
              <ShieldCheck className="size-4 shrink-0" />
              <span>Management Portal</span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Encrypted Session
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-[12px] bg-[var(--attention-bg)] border border-[var(--attention)]/30 text-sm font-medium text-[var(--attention-text)] flex items-start gap-2.5"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-[var(--attention-text)]" />
              <div className="space-y-1">
                <span>{errorMsg}</span>
                {isLocked && (
                  <p className="text-xs font-bold">
                    Retry available in {lockMinutes}:{lockRemSeconds}
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input (Icon-led) */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold text-[var(--text-secondary)] block uppercase tracking-wider"
              >
                Manager Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-decor)]">
                  <Mail className="size-4" />
                </span>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  required
                  placeholder="manager@akshara.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isLocked}
                  className="w-full h-12 pl-10 pr-3.5 rounded-[12px] border border-[var(--card-border)] bg-white text-base text-[var(--text)] placeholder:text-[var(--text-decor)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input (Icon-led with Show/Hide toggle) */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-bold text-[var(--text-secondary)] block uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-decor)]">
                  <Lock className="size-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={handleKeyEvent}
                  onKeyDown={handleKeyEvent}
                  disabled={isLoading || isLocked}
                  className="w-full h-12 pl-10 pr-11 rounded-[12px] border border-[var(--card-border)] bg-white text-base text-[var(--text)] placeholder:text-[var(--text-decor)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--text-decor)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="size-4.5" />
                  ) : (
                    <Eye className="size-4.5" />
                  )}
                </button>
              </div>

              {capsLockOn && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--attention-text)] pt-1">
                  <KeyRound className="size-3.5 shrink-0" />
                  <span>Caps Lock is on</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <AksharaButton
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                disabled={isLocked}
                className="w-full"
              >
                {isLocked ? `Locked (${lockMinutes}:${lockRemSeconds})` : 'Sign In Securely'}
              </AksharaButton>
            </div>
          </form>

          <p className="text-center text-xs font-normal text-[var(--text-secondary)] pt-1">
            Restricted to authorized Akshara Academy administrators. Public registration is disabled.
          </p>
        </div>
      </div>
    </div>
  )
}
