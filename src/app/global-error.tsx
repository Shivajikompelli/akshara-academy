'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[NEXT_APP_GLOBAL_FATAL_ERROR]', {
      name: error.name,
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <html lang="en">
      <body className="bg-[#F8F9FE] text-[#1F2438] min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-[24px] border border-[#E9D5FF] p-8 shadow-xl text-center space-y-4">
          <div className="size-14 rounded-full bg-[#FFF1E0] text-[#9A4A00] flex items-center justify-center mx-auto border border-[#FDBA74]/40">
            <AlertCircle className="size-7 stroke-[2.2]" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[#1F2438]">
              Akshara Academy
            </h1>
            <h2 className="text-sm font-semibold text-[#5A6378]">
              System Encountered an Error
            </h2>
            <p className="text-xs text-[#5A6378] leading-relaxed pt-1">
              The application could not complete the initial page load. Please reload or check your connection.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="min-h-[44px] px-6 rounded-[12px] bg-[#5B45E0] hover:bg-[#4D36D4] text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <RefreshCw className="size-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

