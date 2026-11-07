import { DesktopNav, MobileBottomNav } from '@/components/dashboard-nav'
import { LogoutButton } from '@/components/logout-button'
import { GraduationCap } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-20 flex md:hidden h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-bold text-base text-slate-900">Akshara Academy</span>
        </div>
        <LogoutButton
          variant="ghost"
          showIconOnlyOnMobile={true}
          className="text-slate-600 hover:text-red-600"
        />
      </header>

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white z-20">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="h-9 w-9 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight text-slate-900">Akshara Academy</h1>
            <p className="text-xs text-slate-500 font-medium">Management App</p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <DesktopNav />

        {/* Sidebar Footer with Logout */}
        <div className="border-t border-slate-200 p-4">
          <LogoutButton
            variant="outline"
            className="w-full justify-center gap-2 border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <div className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tabs */}
      <MobileBottomNav />
    </div>
  )
}

