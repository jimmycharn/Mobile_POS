import { useState, useEffect } from 'react'
import { Store, Search, Mail, Phone, Package, Users } from 'lucide-react'
import { shopService, userService, packageService } from '../../services/mockData'

export default function SuperadminShops() {
  const [shops, setShops] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    setShops(shopService.getAll())
  }, [])

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full">
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">จัดการร้านค้า</h1>
            <p className="text-sm text-slate-400">รายชื่อร้านค้าที่ใช้งานระบบ</p>
          </div>
        </div>
        <div className="relative mt-4 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาร้านค้า..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">ร้านค้า</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">ติดต่อ</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">แพ็คเกจ</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(shop => {
                  const pkg = packageService.getById(shop.packageId)
                  const staffCount = userService.getByShop(shop.id).length
                  return (
                    <tr key={shop.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                            <Store size={18} className="text-primary-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{shop.name}</p>
                            <p className="text-xs text-slate-400">{formatDate(shop.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-slate-600">{shop.email}</div>
                        <div className="text-xs text-slate-400">{shop.phone || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-lg">
                          {pkg?.name || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${
                          shop.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {shop.isActive ? 'ใช้งาน' : 'ปิดการใช้งาน'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Store size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่พบร้านค้า</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}
