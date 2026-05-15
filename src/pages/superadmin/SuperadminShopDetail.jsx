import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Store, ClipboardList, ArrowLeft, LogIn, LogOut, Package, Pencil, ArrowRightLeft, User, Trash2, AlertTriangle, Ban, ChevronDown, Building2 } from 'lucide-react'
import { logService, shopService, branchService, packageService } from '../../services/supabaseApi'
import { format, parseISO } from 'date-fns'

const actionConfig = {
  LOGIN: { label: 'เข้าสู่ระบบ', icon: LogIn, color: 'bg-green-50 text-green-600' },
  LOGOUT: { label: 'ออกจากระบบ', icon: LogOut, color: 'bg-slate-50 text-slate-500' },
  SALE: { label: 'ขายสินค้า', icon: Package, color: 'bg-primary-50 text-primary-600' },
  STOCK_IN: { label: 'รับสินค้า', icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
  STOCK_OUT: { label: 'ตัดสต็อกสูญเสีย', icon: Ban, color: 'bg-red-50 text-red-600' },
  ADD_PRODUCT: { label: 'เพิ่มสินค้า', icon: Package, color: 'bg-purple-50 text-purple-600' },
  EDIT_PRODUCT: { label: 'แก้ไขสินค้า', icon: Pencil, color: 'bg-amber-50 text-amber-600' },
  ADD_STAFF: { label: 'เพิ่มพนักงาน', icon: User, color: 'bg-teal-50 text-teal-600' },
  REMOVE_STAFF: { label: 'ลบพนักงาน', icon: Trash2, color: 'bg-red-50 text-red-600' },
  EDIT_SHOP: { label: 'แก้ไขร้าน', icon: Pencil, color: 'bg-amber-50 text-amber-600' },
  CREATE_BRANCH: { label: 'เพิ่มสาขา', icon: Store, color: 'bg-blue-50 text-blue-600' },
  EDIT_BRANCH: { label: 'แก้ไขสาขา', icon: Pencil, color: 'bg-amber-50 text-amber-600' },
  ADD_BANK: { label: 'เพิ่มบัญชี', icon: Package, color: 'bg-purple-50 text-purple-600' },
  EDIT_BANK: { label: 'แก้ไขบัญชี', icon: Pencil, color: 'bg-amber-50 text-amber-600' },
  UPDATE_STAFF_PERM: { label: 'เปลี่ยนสิทธิ์', icon: User, color: 'bg-teal-50 text-teal-600' },
}

export default function SuperadminShopDetail() {
  const { shopId } = useParams()
  const navigate = useNavigate()
  const [shop, setShop] = useState(null)
  const [logs, setLogs] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('all')
  const [branchOpen, setBranchOpen] = useState(false)
  const [pkgName, setPkgName] = useState('-')

  useEffect(() => {
    const load = async () => {
      const s = await shopService.getById(shopId)
      setShop(s)
      if (s?.packageId) {
        const pkg = await packageService.getById(s.packageId)
        setPkgName(pkg?.name || '-')
      }
      const branchList = await branchService.getByShop(shopId)
      setBranches(branchList)
      const logData = await logService.getByShop(shopId)
      setLogs(logData)
    }
    load()
  }, [shopId])

  // Reload logs when branch selection changes
  useEffect(() => {
    if (!shopId) return
    const loadLogs = async () => {
      if (selectedBranchId === 'all') {
        const logData = await logService.getByShop(shopId)
        setLogs(logData)
      } else {
        const logData = await logService.getByBranch(selectedBranchId)
        setLogs(logData)
      }
    }
    loadLogs()
  }, [selectedBranchId, shopId])

  return (
    <div className="h-full pb-20 md:pb-0 overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <button
          onClick={() => navigate('/superadmin/shops')}
          className="flex items-center space-x-2 text-slate-500 hover:text-primary-600 mb-3 text-sm"
        >
          <ArrowLeft size={18} />
          <span>กลับไปรายชื่อร้านค้า</span>
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <Store size={20} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-800">{shop?.name || 'ร้านค้า'}</h1>
              <p className="text-sm text-slate-400">{[shop?.email, shop?.phone].filter(Boolean).join(' · ') || '-'}</p>
              {/* Branch Selector */}
              <div className="relative mt-2">
                <button
                  onClick={() => setBranchOpen(!branchOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                >
                  <Building2 size={13} />
                  <span>
                    {selectedBranchId === 'all'
                      ? 'ทุกสาขา'
                      : branches.find(b => b.id === selectedBranchId)?.name || 'เลือกสาขา'}
                  </span>
                  <ChevronDown size={13} className={`transition-transform ${branchOpen ? 'rotate-180' : ''}`} />
                </button>
                {branchOpen && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-scale-in">
                    <button
                      onClick={() => { setSelectedBranchId('all'); setBranchOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-xs transition-colors ${selectedBranchId === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      ทุกสาขา
                    </button>
                    {branches.map(branch => (
                      <button
                        key={branch.id}
                        onClick={() => { setSelectedBranchId(branch.id); setBranchOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors ${selectedBranchId === branch.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {branch.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Shop Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-slate-400 text-xs mb-1">{selectedBranchId === 'all' ? 'สาขา' : branches.find(b => b.id === selectedBranchId)?.name}</p>
            <p className="font-bold text-slate-800">{selectedBranchId === 'all' ? branches.length : 'สาขานี้'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-slate-400 text-xs mb-1">สถานะ</p>
            <p className={`font-bold ${shop?.isActive ? 'text-green-600' : 'text-red-600'}`}>{shop?.isActive ? 'ใช้งาน' : 'ปิดการใช้งาน'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-slate-400 text-xs mb-1">วันที่สมัคร</p>
            <p className="font-bold text-slate-800">{shop?.createdAt ? format(parseISO(shop.createdAt), 'dd MMM yyyy') : '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-slate-400 text-xs mb-1">แพ็คเกจ</p>
            <p className="font-bold text-primary-600">{pkgName}</p>
          </div>
        </div>

        {/* Activity Logs */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center space-x-3">
            <ClipboardList size={20} className="text-primary-600" />
            <h3 className="font-bold text-slate-800">บันทึกกิจกรรม</h3>
            <span className="text-xs text-slate-400">({logs.length} รายการ)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full hidden md:table">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">เวลา</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">ผู้ใช้</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">กิจกรรม</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const config = actionConfig[log.action] || { label: log.action, icon: AlertTriangle, color: 'bg-slate-50 text-slate-500' }
                  const Icon = config.icon
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{format(parseISO(log.createdAt), 'dd MMM yyyy HH:mm')}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{log.profiles?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.color}`}>
                          <Icon size={14} />
                          <span>{config.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{log.detail}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-slate-100">
            {logs.map(log => {
              const config = actionConfig[log.action] || { label: log.action, icon: AlertTriangle, color: 'bg-slate-50 text-slate-500' }
              const Icon = config.icon
              return (
                <div key={log.id} className="p-4 flex items-start space-x-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{config.label}</p>
                      <span className="text-xs text-slate-400">{format(parseISO(log.createdAt), 'HH:mm')}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{log.detail}</p>
                    <p className="text-xs text-slate-400 mt-1">โดย {log.profiles?.name || '—'}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ยังไม่มีบันทึกกิจกรรม</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
