import { DesktopNav, MobileBottomNav } from '@/components/dashboard-nav'
import { LogoutButton } from '@/components/logout-button'
import { AksharaLogo } from '@/components/ui/akshara-logo'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--app-bg)] text-[var(--text)]">
      {/* Mobile / Tablet Top Header (< 1024px) */}
      <header className="sticky top-0 z-20 flex lg:hidden h-16 items-center justify-between border-b border-[var(--card-border)]/50 bg-white/95 backdrop-blur-md px-4 sm:px-6">
        <AksharaLogo size="sm" showText={true} />
        <LogoutButton
          variant="ghost"
          showIconOnlyOnMobile={true}
          className="text-[var(--text-secondary)] hover:text-[var(--absent-text)] hover:bg-[var(--absent-bg)] rounded-[12px]"
        />
      </header>

      {/* Desktop Left Sidebar (>= 1024px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[var(--card-border)]/60 bg-white z-20">
        {/* Brand Header */}
        <div className="flex h-20 items-center px-6 border-b border-[var(--card-border)]/50">
          <AksharaLogo size="md" showText={true} />
        </div>

        {/* Navigation Links */}
        <DesktopNav />

        {/* Sidebar Footer with Logout */}
        <div className="border-t border-[var(--card-border)]/50 p-4">
          <LogoutButton
            variant="outline"
            className="w-full justify-center gap-2 border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--absent-bg)] hover:text-[var(--absent-text)] hover:border-[var(--absent)]/30 rounded-[12px] font-bold text-sm min-h-[44px]"
          />
        </div>
      </aside>

      {/* Main Content Area (max-width 960px centered container) */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <div className="w-full max-w-[960px] mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8 flex-1">
          {children}
        </div>
      </main>

      {/* Mobile / Tablet Bottom Tab Navigation (< 1024px) */}
      <MobileBottomNav />
    </div>
  )
}
