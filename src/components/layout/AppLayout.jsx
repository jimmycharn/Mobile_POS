import { Outlet } from 'react-router-dom'
import MobileNav from './MobileNav'
import DesktopSidebar from './DesktopSidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen md:h-screen bg-slate-50 overflow-x-hidden md:overflow-hidden">
      <DesktopSidebar />
      <main className="flex-1 flex flex-col min-h-screen md:min-h-0 md:h-screen min-w-0 overflow-x-hidden md:overflow-hidden">
        <div className="flex-1 pb-20 md:pb-0 min-w-0 overflow-x-hidden md:overflow-hidden">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
