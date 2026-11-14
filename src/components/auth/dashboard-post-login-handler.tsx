'use client'

import { useState, useEffect } from 'react'
import { PostLoginTransition } from './post-login-transition'

export function DashboardPostLoginHandler() {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const hasStoredStart = sessionStorage.getItem('akshara_post_login_start')
      const params = new URLSearchParams(window.location.search)
      const hasParam = params.get('post_login') === '1'

      if (hasStoredStart || hasParam) {
        setIsActive(true)
      }
    } catch {
      // Ignore sessionStorage exceptions
    }
  }, [])

  if (!isActive) return null

  return (
    <PostLoginTransition
      active={isActive}
      isDashboardDock={true}
      onComplete={() => {
        setIsActive(false)
        try {
          sessionStorage.removeItem('akshara_post_login_start')
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
