import { useState, useEffect } from 'react'
import { Store, Users, Plus, Trash2, User, Shield, Smartphone, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopService, userService, authService, packageService } from '../services/mockData'

export default function ShopSettingsPage() {
  const { user, logout } = useAuth()
  const [shop, setShop] = useState(null)
  const [staff, setStaff] = useState([])
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '' })
  const [pkg, setPkg] = useState(null)

  useEffect(() => {
    if (user?.shopId) {
      const s = shopService.getById(user.shopId)
      setShop(s)
      setStaff(userService.getByShop(user.shopId).filter(u => u.id !== user.id))
      if (s) setPkg(packageService.getById(s.packageId))
    }
  }, [user])

  const handleAddStaff = () => {
    const result = userService.create({
      ...newStaff,
      role: 'staff',
      shopId: user.shopId,
      avatar: null,
    })
    if (!result.error) {
      authService.logActivity(user.id, user.shopId, 'ADD_STAFF', `เพิ่มพนักงาน ${newStaff.name}`)
      setStaff(userService.getByShop(user.shopId).filter(u => u.id !== user.id))
      setShowAddStaff(false)
      setNewStaff({ name: '', email: '', password: '' })
    }
  }

  const handleRemoveStaff = (id, name) => {
    if (!confirm(`ลบพนักงาน ${name}?`)) return
    userService.remove(id)
    authService.logActivity(user.id, user.shopId, 'REMOVE_STAFF', `ลบพนักงาน ${name}`)
    setStaff(userService.getByShop(user.shopId).filter(u => u.id !== user.id))
  }

  return (
    <div className="h-full pb-20 md:pb-0">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">ตั้งค่าร้านค้า</h1>
        <p className="text-sm text-slate-400">ข้อมูลร้านค้าและการจัดการพนักงาน</p>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Shop Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
              <Store size={28} className="text-primary-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">{shop?.name || 'ร้านค้า'}</h2>
              <p className="text-sm text-slate-400">{shop?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">เบอร์โทร</p>
              <p className="font-medium text-slate-700">{shop?.phone || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">แพ็คเกจ</p>
              <p className="font-medium text-primary-600">{pkg?.name || '-'}</p>
            </div>
          </div>
        </div>

        {/* Staff Management */}
        {user?.role === 'owner' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Users size={20} className="text-primary-600" />
                <h3 className="font-semibold text-slate-800">พนักงาน ({staff.length})</h3>
              </div>
              <button
                onClick={() => setShowAddStaff(true)}
                className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
              >
                <Plus size={16} />
                <span>เพิ่ม</span>
              </button>
            </div>

            <div className="space-y-2">
              {/* Owner */}
              <div className="flex items-center space-x-3 p-3 bg-primary-50 rounded-xl border border-primary-100">
                <div className="w-10 h-10 bg-primary-200 rounded-full flex items-center justify-center">
                  <Shield size={18} className="text-primary-700" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-400">เจ้าของร้าน · {user.email}</p>
                </div>
                <span className="px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-lg">Owner</span>
              </div>

              {staff.map(s => (
                <div key={s.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <User size={18} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveStaff(s.id, s.name)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Staff Modal */}
        {showAddStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
              <h3 className="text-lg font-bold text-slate-800 mb-4">เพิ่มพนักงาน</h3>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อพนักงาน"
                  value={newStaff.name}
                  onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="อีเมล"
                  value={newStaff.email}
                  onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="รหัสผ่าน"
                  type="password"
                  value={newStaff.password}
                  onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setShowAddStaff(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button onClick={handleAddStaff} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm">บันทึก</button>
              </div>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center space-x-3 mb-3">
            <Smartphone size={20} className="text-slate-400" />
            <h3 className="font-semibold text-slate-800">เกี่ยวกับแอป</h3>
          </div>
          <p className="text-sm text-slate-400">Mobile POS v1.0.0</p>
          <p className="text-sm text-slate-400">ระบบจัดการขายหน้าร้านสำหรับมือถือและแท็บเล็ต</p>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 py-3.5 rounded-xl font-medium transition-colors"
        >
          <LogOut size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  )
}
