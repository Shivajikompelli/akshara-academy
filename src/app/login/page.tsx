'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AksharaLogo } from '@/components/ui/akshara-logo'
import { AksharaButton } from '@/components/ui/akshara-button'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        setIsLoading(false)
        return
      }

      if (data.session) {
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('An unexpected error occurred. Please try again.')
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--app-bg)] text-[var(--text)]">
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
        <div className="rounded-[24px] bg-white border border-[var(--card-border)]/70 p-6 sm:p-8 shadow-xs">
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-[12px] bg-[var(--attention-bg)] border border-[var(--attention)]/30 text-sm font-medium text-[var(--attention-text)] flex items-start gap-2.5"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-[var(--attention-text)]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input (Icon-led) */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold text-[var(--text-secondary)] block uppercase tracking-wider"
              >
                Email Address
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
                  required
                  placeholder="admin@akshara.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-12 pl-10 pr-3.5 rounded-[12px] border border-[var(--card-border)] bg-white text-base text-[var(--text)] placeholder:text-[var(--text-decor)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-12 pl-10 pr-11 rounded-[12px] border border-[var(--card-border)] bg-white text-base text-[var(--text)] placeholder:text-[var(--text-decor)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
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
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <AksharaButton
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full"
              >
                Sign In
              </AksharaButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
