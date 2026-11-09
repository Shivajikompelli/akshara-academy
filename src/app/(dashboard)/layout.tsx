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

      {/* Main Content Area in a container with max-width 1100px */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation (< 768px) */}
      <MobileBottomNav />
    </div>
  )
}
