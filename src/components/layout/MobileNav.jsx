import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, Package, BarChart3, Settings, ClipboardList, Store, Shield, LayoutDashboard, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const shopNavItems = [
  { path: '/pos', label: 'ขาย', icon: ShoppingCart },
  { path: '/inventory', label: 'สต็อก', icon: Package },
  { path: '/reports', label: 'รายงาน', icon: BarChart3 },
  { path: '/logs', label: 'บันทึก', icon: ClipboardList },
  { path: '/settings', label: 'ตั้งค่า', icon: Settings },
]

const superAdminNavItems = [
  { path: '/superadmin', label: 'ภาพรวม', icon: LayoutDashboard },
  { path: '/superadmin/shops', label: 'ร้านค้า', icon: Store },
  { path: '/superadmin/products', label: 'สินค้า', icon: Package },
  { path: '/superadmin/packages', label: 'แพ็คเกจ', icon: Shield },
  { path: '/superadmin/settings', label: 'ตั้งค่า', icon: SlidersHorizontal },
]

export default function MobileNav() {
  const location = useLocation()
  const { user } = useAuth()

  if (!user) return null

  let navItems = []
  if (user.role === 'superadmin') {
    navItems = superAdminNavItems
  } else if (user.role === 'owner') {
    navItems = shopNavItems
  } else {
    navItems = shopNavItems.filter(item => item.path !== '/logs')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-bottom z-50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 ${
                isActive ? 'text-primary-600' : 'text-slate-400'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
