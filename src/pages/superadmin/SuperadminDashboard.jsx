import { useEffect, useState, useMemo } from 'react'
import { Store, Users, ShoppingBag, DollarSign, TrendingUp, LogOut } from 'lucide-react'
import { shopService, userService, saleService, logService } from '../../services/supabaseApi'
import { useAuth } from '../../context/AuthContext'
import { format, parseISO, subDays, startOfDay } from 'date-fns'

export default function SuperadminDashboard() {
  const { logout } = useAuth()
  const [shops, setShops] = useState([])
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const load = async () => {
      const [shopsData, usersData, salesData, logsData] = await Promise.all([
        shopService.getAll(),
        userService.getAll(),
        saleService.getAll(),
        logService.getAll(),
      ])
      setShops(shopsData)
      setUsers(usersData)
      setSales(salesData)
      setLogs(logsData.slice(0, 10))
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
    const today = startOfDay(new Date())
    const todayRevenue = sales.filter(s => new Date(s.createdAt) >= today).reduce((sum, s) => sum + s.total, 0)
    return {
      shops: shops.length,
      users: users.length,
      totalRevenue,
      todayRevenue,
      totalSales: sales.length,
    }
  }, [shops, users, sales])

  const recentShops = shops.slice(0, 5)

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">แดชบอร์ด Super Admin</h1>
          <p className="text-sm text-slate-400">ภาพรวมระบบทั้งหมด</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">ออกจากระบบ</span>
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                <Store size={20} className="text-primary-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">ร้านค้าทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.shops}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">ผู้ใช้งาน</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.users}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">รายได้วันนี้</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">฿{stats.todayRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <ShoppingBag size={20} className="text-amber-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">ยอดขายรวม</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.totalSales}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">ร้านค้าล่าสุด</h3>
            <div className="space-y-3">
              {recentShops.map(shop => (
                <div key={shop.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Store size={18} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{shop.name}</p>
                    <p className="text-xs text-slate-400">{shop.email}</p>
                  </div>
                </div>
              ))}
              {recentShops.length === 0 && <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีร้านค้า</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">กิจกรรมล่าสุด</h3>
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{log.profiles?.name || log.userId?.slice(0, 8) || 'ไม่ระบุ'}</p>
                    <p className="text-xs text-slate-500">{log.shops?.name || log.action}</p>
                    <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{format(parseISO(log.createdAt), 'HH:mm')}</span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีกิจกรรม</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
