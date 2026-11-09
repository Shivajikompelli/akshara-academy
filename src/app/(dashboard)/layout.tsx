import { DesktopTopBar, MobileTopHeader, MobileBottomNav } from '@/components/dashboard-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--app-bg)] text-[var(--text)]">
      {/* Desktop Top Bar (768px and up) - No Sidebar */}
      <DesktopTopBar />

      {/* Mobile Top Header (< 768px) with Page/Brand title and 44px Avatar */}
      <MobileTopHeader />

      {/* Main Content Area in a container with max-width 1100px and tightened padding */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-3 sm:px-4 py-4 pb-20 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation (< 768px) */}
      <MobileBottomNav />
    </div>
  )
}
