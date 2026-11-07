'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogoutButtonProps {
  className?: string
  variant?: 'outline' | 'ghost' | 'default' | 'secondary'
  showIconOnlyOnMobile?: boolean
}

export function LogoutButton({
  className,
  variant = 'outline',
  showIconOnlyOnMobile = false,
}: LogoutButtonProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    try {
      setIsLoggingOut(true)
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Logout error:', err)
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoggingOut}
      variant={variant}
      className={`min-h-[44px] cursor-pointer ${className || ''}`}
    >
      <LogOut className="size-4 shrink-0" />
      <span className={showIconOnlyOnMobile ? 'hidden sm:inline' : 'inline'}>
        {isLoggingOut ? 'Logging out...' : 'Log out'}
      </span>
    </Button>
  )
}

