import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Search, Trash2, AlertTriangle } from 'lucide-react'
import { shopService, branchService } from '../../services/supabaseApi'

export default function SuperadminShops() {
  const navigate = useNavigate()
  const [shops, setShops] = useState([])
  const [branches, setBranches] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const [shopData, branchData] = await Promise.all([
        shopService.getAll(),
        branchService.getByShop('*').catch(() => []),
      ])
      setShops(shopData)
      setBranches(branchData)
    }
    load()
  }, [])

  const filtered = shops.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full overflow-y-auto">
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">สาขา</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">สถานะ</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(shop => {
                  const branchCount = branches.filter(b => b.shopId === shop.id).length
                  return (
                  <tr
                    key={shop.id}
                    onClick={() => navigate(`/superadmin/shops/${shop.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer"
                  >
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
                      <span className="text-sm text-slate-600">{branchCount} สาขา</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${
                        shop.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {shop.isActive ? 'ใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (branchCount > 0) {
                            alert(`ไม่สามารถลบร้านค้านี้ได้ เนื่องจากยังมี ${branchCount} สาขา\nกรุณาลบสาขาทั้งหมดก่อน`)
                            return
                          }
                          if (!confirm(`ยืนยันลบร้านค้า "${shop.name}"?\nการลบจะไม่สามารถกู้คืนได้`)) return
                          try {
                            await shopService.remove(shop.id)
                            setShops(prev => prev.filter(s => s.id !== shop.id))
                          } catch (err) {
                            alert('ลบร้านค้าไม่สำเร็จ: ' + err.message)
                          }
                        }}
                        className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          branchCount > 0
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                        title={branchCount > 0 ? 'ยังมีสาขา ไม่สามารถลบได้' : 'ลบร้านค้า'}
                      >
                        <Trash2 size={14} className="mr-1" />
                        ลบ
                      </button>
                    </td>
                  </tr>
                )})}
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
