'use client'

import { useState, useEffect } from 'react'
import { PostLoginTransition } from './post-login-transition'

export function DashboardPostLoginHandler() {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const storedDock = sessionStorage.getItem('akshara_post_login_dock')
      const storedStart = sessionStorage.getItem('akshara_post_login_start')
      const params = new URLSearchParams(window.location.search)
      const hasParam = params.get('post_login') === '1'

      if (storedDock === '1' || storedStart || hasParam) {
        setIsActive(true)
        // Clean session storage immediately to avoid repeated triggers on back/refresh
        sessionStorage.removeItem('akshara_post_login_dock')
        sessionStorage.removeItem('akshara_post_login_start')
        sessionStorage.removeItem('akshara_post_login')
      }
    } catch {
      // Ignore sessionStorage exceptions
    }
  }, [])

  if (!isActive) return null

  return (
    <PostLoginTransition
      mode="dock"
      active={isActive}
      onComplete={() => {
        setIsActive(false)
        try {
          sessionStorage.removeItem('akshara_post_login_dock')
          sessionStorage.removeItem('akshara_post_login_start')
          sessionStorage.removeItem('akshara_post_login')
          const url = new URL(window.location.href)
          if (url.searchParams.has('post_login')) {
            url.searchParams.delete('post_login')
            window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
          }
        } catch {
          // Ignore
        }
      }}
    />
  )
}
