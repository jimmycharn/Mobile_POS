import { Outlet } from 'react-router-dom'
import MobileNav from './MobileNav'
import DesktopSidebar from './DesktopSidebar'
import BranchSwitcher from '../BranchSwitcher'

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] md:h-screen bg-slate-50 overflow-x-hidden md:overflow-hidden">
      <DesktopSidebar />
      <main className="flex-1 flex flex-col min-h-0 h-full min-w-0 overflow-x-hidden md:overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-slate-200 bg-white shrink-0">
          <BranchSwitcher />
        </div>
        <div className="flex-1 pb-20 md:pb-0 min-w-0 overflow-x-hidden md:overflow-hidden h-full">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
