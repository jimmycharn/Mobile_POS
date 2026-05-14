import { Outlet } from 'react-router-dom'
import MobileNav from './MobileNav'
import DesktopSidebar from './DesktopSidebar'

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] md:h-screen bg-slate-50 overflow-x-hidden md:overflow-hidden">
      <DesktopSidebar />
      <main className="flex-1 flex flex-col min-h-0 h-full min-w-0 overflow-x-hidden md:overflow-hidden">
        <div className="flex-1 pb-20 md:pb-0 min-w-0 overflow-x-hidden md:overflow-hidden h-full">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
