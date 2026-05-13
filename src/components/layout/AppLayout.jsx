import { Outlet } from 'react-router-dom'
import MobileNav from './MobileNav'
import DesktopSidebar from './DesktopSidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DesktopSidebar />
      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
