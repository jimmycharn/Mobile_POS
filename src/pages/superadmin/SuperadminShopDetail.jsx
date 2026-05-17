import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Store, ClipboardList, ArrowLeft, LogIn, LogOut, Package, Pencil, ArrowRightLeft, User, Trash2, AlertTriangle, Ban, ChevronDown, Building2, TrendingUp, ShoppingBag, DollarSign, Calendar, CreditCard, Wallet, X, Eye, Shield } from 'lucide-react'
import { logService, branchService, saleService, shopService, packageService } from '../../services/supabaseApi'
import { format, parseISO, startOfDay, endOfDay, subDays, isSameDay, startOfMonth, endOfMonth, isValid, parse } from 'date-fns'

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
  const [packages, setPackages] = useState([])
  const [pkgDropdownOpen, setPkgDropdownOpen] = useState(false)
  const [sales, setSales] = useState([])
  const [reportRange, setReportRange] = useState('7') // 'today', '7', 'month', 'custom'
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const getReportDateRange = () => {
    const today = new Date()
    switch (reportRange) {
      case 'today': return { start: startOfDay(today), end: endOfDay(today) }
      case '7': return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }
      case 'month': return { start: startOfMonth(today), end: endOfMonth(today) }
      case 'custom': {
        const s = parse(customStart, 'yyyy-MM-dd', new Date())
        const e = parse(customEnd, 'yyyy-MM-dd', new Date())
        if (isValid(s) && isValid(e)) {
          return { start: startOfDay(s), end: endOfDay(e) }
        }
        return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }
      }
      default: return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }
    }
  }

  useEffect(() => {
    const load = async () => {
      const [s, pkgList] = await Promise.all([
        shopService.getById(shopId),
        packageService.getAll(),
      ])
      setShop(s)
      setPackages(pkgList)
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

  // Load sales for report
  useEffect(() => {
    if (!shopId) return
    const loadSales = async () => {
      if (selectedBranchId === 'all') {
        const data = await saleService.getByShop(shopId)
        setSales(data)
      } else {
        const data = await saleService.getByBranch(selectedBranchId)
        setSales(data)
      }
    }
    loadSales()
  }, [selectedBranchId, shopId])

  const reportStats = useMemo(() => {
    const { start, end } = getReportDateRange()
    const filtered = sales.filter(s => {
      const d = new Date(s.createdAt)
      return d >= start && d <= end
    })
    const totalRevenue = filtered.reduce((sum, s) => sum + s.total, 0)
    const totalOrders = filtered.length
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const todaySales = sales.filter(s => isSameDay(parseISO(s.createdAt), new Date()))
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
    return { totalRevenue, totalOrders, avgOrder, todayRevenue, todayOrders: todaySales.length }
  }, [sales, reportRange, customStart, customEnd])

  const dailyData = useMemo(() => {
    const { start, end } = getReportDateRange()
    const data = {}
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      data[format(d, 'yyyy-MM-dd')] = { revenue: 0, orders: 0 }
    }
    sales.forEach(s => {
      const key = format(parseISO(s.createdAt), 'yyyy-MM-dd')
      if (data[key]) {
        data[key].revenue += s.total
        data[key].orders += 1
      }
    })
    return Object.entries(data).map(([date, val]) => ({
      date: format(parseISO(date), 'dd/MM'),
      ...val,
    }))
  }, [sales, reportRange, customStart, customEnd])

  const paymentStats = useMemo(() => {
    const { start, end } = getReportDateRange()
    const filtered = sales.filter(s => {
      const d = new Date(s.createdAt)
      return d >= start && d <= end
    })
    const cash = filtered.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0)
    const transfer = filtered.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0)
    return { cash, transfer }
  }, [sales, reportRange, customStart, customEnd])

  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  const dateRangeLabel = useMemo(() => {
    const { start, end } = getReportDateRange()
    if (isSameDay(start, end)) return format(start, 'dd MMM yyyy')
    return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`
  }, [reportRange, customStart, customEnd])

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
            <p className="text-slate-400 text-xs mb-1">{selectedBranchId === 'all' ? 'สาขา' : 'สาขา'}</p>
            <p className="font-bold text-slate-800">{selectedBranchId === 'all' ? branches.length : branches.find(b => b.id === selectedBranchId)?.name || '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-slate-400 text-xs mb-1">สถานะ</p>
            <p className={`font-bold ${shop?.isActive ? 'text-green-600' : 'text-red-600'}`}>{shop?.isActive ? 'ใช้งาน' : 'ปิดการใช้งาน'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-slate-400 text-xs mb-1">วันที่สมัคร</p>
            <p className="font-bold text-slate-800">{shop?.createdAt ? format(parseISO(shop.createdAt), 'dd MMM yyyy') : '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 relative">
            <p className="text-slate-400 text-xs mb-1">แพ็คเกจ</p>
            <button
              onClick={() => setPkgDropdownOpen(!pkgDropdownOpen)}
              className="flex items-center gap-1 font-bold text-slate-800"
            >
              <Shield size={14} className="text-primary-600" />
              <span>{packages.find(p => p.id === shop?.packageId)?.name || 'ไม่มีแพ็คเกจ'}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {pkgDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-scale-in">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={async () => {
                      try {
                        await shopService.update(shopId, { packageId: pkg.id })
                        setShop(prev => ({ ...prev, packageId: pkg.id }))
                        setPkgDropdownOpen(false)
                      } catch (err) {
                        alert('เปลี่ยนแพ็คเกจไม่สำเร็จ: ' + err.message)
                      }
                    }}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${shop?.packageId === pkg.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {pkg.name} {pkg.price === 0 ? '(ฟรี)' : `฿${pkg.price.toLocaleString()}/เดือน`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sales Report Summary */}
        <div className="space-y-4">
          {/* Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex space-x-2 overflow-x-auto no-scrollbar">
              {[
                { value: 'today', label: 'วันนี้' },
                { value: '7', label: '7 วัน' },
                { value: 'month', label: 'เดือนนี้' },
                { value: 'custom', label: 'กำหนดเอง' },
              ].map(r => (
                <button
                  key={r.value}
                  onClick={() => {
                    if (r.value === 'custom') setShowCustomPicker(true)
                    setReportRange(r.value)
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    reportRange === r.value ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">{dateRangeLabel}</span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
                  <DollarSign size={18} className="text-primary-600" />
                </div>
                <span className="text-xs font-medium text-slate-400">รายได้รวม</span>
              </div>
              <p className="text-xl font-bold text-slate-800">฿{reportStats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{reportStats.totalOrders} ออเดอร์</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                  <TrendingUp size={18} className="text-green-600" />
                </div>
                <span className="text-xs font-medium text-slate-400">รายได้วันนี้</span>
              </div>
              <p className="text-xl font-bold text-slate-800">฿{reportStats.todayRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{reportStats.todayOrders} ออเดอร์</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <ShoppingBag size={18} className="text-blue-600" />
                </div>
                <span className="text-xs font-medium text-slate-400">ออเดอร์เฉลี่ย</span>
              </div>
              <p className="text-xl font-bold text-slate-800">฿{reportStats.avgOrder.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">ต่อบิล</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <CreditCard size={18} className="text-amber-600" />
                </div>
                <span className="text-xs font-medium text-slate-400">การชำระเงิน</span>
              </div>
              <p className="text-xl font-bold text-slate-800">฿{paymentStats.cash.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">เงินสด</p>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">แนวโน้มยอดขาย</h3>
            <div className="flex items-end space-x-2 h-48 overflow-x-auto no-scrollbar">
              {dailyData.map((d, i) => (
                <div key={i} className="flex-1 min-w-[40px] flex flex-col items-center justify-end h-full">
                  <div className="text-xs text-slate-400 mb-1">{d.revenue > 0 ? `฿${(d.revenue/1000).toFixed(1)}k` : ''}</div>
                  <div
                    className="w-full max-w-[40px] bg-primary-500 rounded-t-lg transition-all"
                    style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                  />
                  <div className="text-[10px] text-slate-400 mt-2">{d.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">วิธีชำระเงิน</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 flex items-center gap-2"><Wallet size={14} /> เงินสด</span>
                  <span className="font-medium">฿{paymentStats.cash.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${reportStats.totalRevenue > 0 ? (paymentStats.cash / reportStats.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 flex items-center gap-2"><CreditCard size={14} /> โอนเงิน / QR</span>
                  <span className="font-medium">฿{paymentStats.transfer.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${reportStats.totalRevenue > 0 ? (paymentStats.transfer / reportStats.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
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
                      <td className="px-4 py-3 text-sm text-slate-600">{log.details}</td>
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
                    <p className="text-sm text-slate-600 mt-0.5">{log.details}</p>
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

      {/* Custom Date Picker Modal */}
      {showCustomPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-800 mb-4">เลือกช่วงวันที่</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">วันที่เริ่มต้น</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button
                onClick={() => setShowCustomPicker(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setShowCustomPicker(false)
                  setReportRange('custom')
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
