import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, Package, BarChart3, Settings, Store, Shield, LogOut, ClipboardList, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const shopNavItems = [
  { path: '/pos', label: 'ขายหน้าร้าน', icon: ShoppingCart },
  { path: '/inventory', label: 'จัดการสต็อก', icon: Package },
  { path: '/reports', label: 'รายงานยอดขาย', icon: BarChart3 },
  { path: '/logs', label: 'บันทึกกิจกรรม', icon: ClipboardList, ownerOnly: true },
  { path: '/settings', label: 'ตั้งค่าร้าน', icon: Settings },
]

const superAdminItems = [
  { path: '/superadmin', label: 'ภาพรวม', icon: Store },
  { path: '/superadmin/shops', label: 'ร้านค้า', icon: Store },
  { path: '/superadmin/products', label: 'คลังสินค้ากลาง', icon: Package },
  { path: '/superadmin/packages', label: 'แพ็คเกจราคา', icon: Shield },
  { path: '/superadmin/logs', label: 'บันทึกกิจกรรม', icon: ClipboardList },
]

export default function DesktopSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  if (!user) return null

  let navItems = user.role === 'superadmin' ? superAdminItems : shopNavItems
  if (user.role === 'staff') {
    navItems = navItems.filter(item => !item.ownerOnly)
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
      <div className="p-6">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <Store className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">Mobile POS</h1>
            <p className="text-xs text-slate-400">ระบบขายหน้าร้าน</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center space-x-3 mb-4 px-2">
          <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
            <Users size={16} className="text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
            <p className="text-xs text-slate-400">
              {user.role === 'superadmin' ? 'Super Admin' : user.role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-3 w-full px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  )
}
