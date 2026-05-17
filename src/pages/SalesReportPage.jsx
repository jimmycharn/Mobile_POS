import { useState, useMemo, useEffect } from 'react'
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Calendar, Wheat, Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { saleService, shopProductService, branchService, recipeService, productUnitService, convertToBaseUnit } from '../services/supabaseApi'
import { startOfDay, endOfDay, subDays, format, parseISO, isSameDay, startOfMonth, endOfMonth, isValid, parse } from 'date-fns'

export default function SalesReportPage() {
  const { user } = useAuth()
  const [range, setRange] = useState('7') // 'today', '7', 'month', 'custom'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('all') // 'all' or branchId
  const [branches, setBranches] = useState([])
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [ingredientUsage, setIngredientUsage] = useState([])

  const canFilterBranch = user && (user.role === 'owner' || user.role === 'superadmin') && branches.length > 1
  const effectiveBranchId = canFilterBranch ? (selectedBranch === 'all' ? null : selectedBranch) : user?.branchId

  const getDateRange = () => {
    const today = new Date()
    switch (range) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) }
      case '7':
        return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) }
      case 'custom': {
        const s = parse(customStart, 'yyyy-MM-dd', new Date())
        const e = parse(customEnd, 'yyyy-MM-dd', new Date())
        if (isValid(s) && isValid(e)) {
          return { start: startOfDay(s), end: endOfDay(e) }
        }
        return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }
      }
      default:
        return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }
    }
  }

  useEffect(() => {
    const load = async () => {
      if (!user?.shopId) return
      const branchList = await branchService.getByShop(user.shopId)
      setBranches(branchList)
      const effId = (user.role === 'owner' || user.role === 'superadmin') && branchList.length > 1 && selectedBranch !== 'all'
        ? selectedBranch
        : user.branchId
      const { start, end } = getDateRange()
      const saleList = effId
        ? await saleService.getByBranch(effId)
        : await saleService.getByShop(user.shopId)
      setSales(saleList.filter(s => {
        const d = new Date(s.createdAt)
        return d >= start && d <= end
      }))
      const prodList = effId
        ? await shopProductService.getByBranch(effId)
        : await shopProductService.getByShop(user.shopId)
      setProducts(prodList)

      // Compute ingredient consumption for the date range
      const filteredSales = saleList.filter(s => {
        const d = new Date(s.createdAt)
        return d >= start && d <= end
      })
      const productMap = Object.fromEntries(prodList.map(p => [p.id, p]))
      const usage = {} // { ingredientId: { name, unit, qty, cost } }
      const recipeCache = {}
      const unitsCache = {}
      for (const sale of filteredSales) {
        if (!Array.isArray(sale.items)) continue
        for (const item of sale.items) {
          if (!item.isRecipe) continue
          let recipe = recipeCache[item.id]
          if (recipe === undefined) {
            recipe = await recipeService.getByShopProduct(item.id)
            recipeCache[item.id] = recipe
          }
          if (!recipe || !recipe.recipeItems) continue
          for (const ri of recipe.recipeItems) {
            const ing = productMap[ri.ingredientShopProductId]
            if (!ing) continue
            let units = unitsCache[ing.id]
            if (units === undefined) {
              units = await productUnitService.getByProduct(ing.id)
              unitsCache[ing.id] = units
            }
            const baseQty = convertToBaseUnit(ri.quantity * item.qty, ri.unit, units)
            if (!usage[ing.id]) {
              usage[ing.id] = { id: ing.id, name: ing.name, unit: ing.unit, qty: 0, cost: 0 }
            }
            usage[ing.id].qty += baseQty
            usage[ing.id].cost += baseQty * (ing.costPrice || 0)
          }
        }
      }
      setIngredientUsage(Object.values(usage).sort((a, b) => b.cost - a.cost))
    }
    load()
  }, [user, selectedBranch, range, currentDate, customStart, customEnd])

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
    const totalOrders = sales.length
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const todaySales = sales.filter(s => isSameDay(parseISO(s.createdAt), new Date()))
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
    return { totalRevenue, totalOrders, avgOrder, todayRevenue, todayOrders: todaySales.length }
  }, [sales])

  const dailyData = useMemo(() => {
    const data = {}
    const { start, end } = getDateRange()
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
      fullDate: date,
      ...val,
    }))
  }, [sales, range, customStart, customEnd])

  const paymentStats = useMemo(() => {
    const cash = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0)
    const transfer = sales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0)
    return { cash, transfer }
  }, [sales])

  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  const exportCSV = () => {
    const rows = [['เลขที่บิล', 'วันเวลา', 'รายการ', 'ยอดสุทธิ', 'ส่วนลด', 'วิธีชำระ']]
    for (const s of sales) {
      const itemList = Array.isArray(s.items)
        ? s.items.map(i => `${i.name} x${i.qty}`).join(' | ')
        : ''
      rows.push([
        s.id.slice(-6),
        format(parseISO(s.createdAt), 'yyyy-MM-dd HH:mm'),
        itemList,
        s.total,
        s.discount || 0,
        s.paymentMethod === 'cash' ? 'เงินสด' : (s.paymentMethod === 'transfer' ? 'โอน' : s.paymentMethod),
      ])
    }
    // Add ingredient summary at end
    if (ingredientUsage.length > 0) {
      rows.push([])
      rows.push(['== วัตถุดิบที่ใช้ =='])
      rows.push(['ชื่อ', 'จำนวน', 'หน่วย', 'ต้นทุน'])
      for (const u of ingredientUsage) {
        rows.push([u.name, u.qty.toFixed(2), u.unit, u.cost.toFixed(2)])
      }
    }
    const csv = '\uFEFF' + rows.map(r => r.map(c => {
      const s = String(c ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const { start, end } = getDateRange()
    a.href = url
    a.download = `sales_${format(start, 'yyyyMMdd')}_${format(end, 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const dateRangeLabel = useMemo(() => {
    const { start, end } = getDateRange()
    if (isSameDay(start, end)) return format(start, 'dd MMM yyyy')
    return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`
  }, [range, customStart, customEnd])

  return (
    <div className="h-full pb-20 md:pb-0 overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800">รายงานยอดขาย</h1>
            <p className="text-sm text-slate-400">สรุปยอดขายและสถิติ</p>
          </div>
          {canFilterBranch && (
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
            >
              <option value="all">ทุกสาขา</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex space-x-2 overflow-x-auto no-scrollbar">
            {[
              { value: 'today', label: 'วันนี้' },
              { value: '7', label: '7 วัน' },
              { value: 'month', label: 'เดือนนี้' },
              ...(user?.role === 'owner' ? [{ value: 'custom', label: 'กำหนดเอง' }] : []),
            ].map(r => (
              <button
                key={r.value}
                onClick={() => {
                  setRange(r.value)
                  if (r.value === 'custom') setShowCustomPicker(true)
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  range === r.value ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">{dateRangeLabel}</span>
            </div>
            <button
              onClick={exportCSV}
              disabled={sales.length === 0}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Download size={16} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
                <DollarSign size={18} className="text-primary-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">รายได้วันนี้</span>
            </div>
            <p className="text-xl font-bold text-slate-800">฿{stats.todayRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{stats.todayOrders} ออเดอร์</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">รายได้รวม</span>
            </div>
            <p className="text-xl font-bold text-slate-800">฿{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{stats.totalOrders} ออเดอร์</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <ShoppingBag size={18} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">ออเดอร์เฉลี่ย</span>
            </div>
            <p className="text-xl font-bold text-slate-800">฿{stats.avgOrder.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">ต่อบิล</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <TrendingDown size={18} className="text-amber-600" />
              </div>
              <span className="text-xs font-medium text-slate-400">สินค้าใกล้หมด</span>
            </div>
            <p className="text-xl font-bold text-slate-800">{products.filter(p => p.stock <= p.minStock).length}</p>
            <p className="text-xs text-slate-400 mt-1">รายการ</p>
          </div>
        </div>

        {/* Chart */}
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
                <span className="text-slate-600">เงินสด</span>
                <span className="font-medium">฿{paymentStats.cash.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${stats.totalRevenue > 0 ? (paymentStats.cash / stats.totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">โอนเงิน / QR</span>
                <span className="font-medium">฿{paymentStats.transfer.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${stats.totalRevenue > 0 ? (paymentStats.transfer / stats.totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ingredient Consumption (only if any) */}
        {ingredientUsage.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Wheat size={18} className="text-amber-600" />
              <h3 className="font-semibold text-slate-800">วัตถุดิบที่ใช้ในช่วงนี้</h3>
            </div>
            <div className="space-y-2">
              {ingredientUsage.slice(0, 15).map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.qty.toFixed(2)} {u.unit}</p>
                  </div>
                  <p className="text-sm font-semibold text-amber-600">฿{u.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-sm font-semibold">
              <span className="text-slate-700">ต้นทุนวัตถุดิบรวม</span>
              <span className="text-amber-600">฿{ingredientUsage.reduce((s, u) => s + u.cost, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {/* Recent Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">รายการขายล่าสุด</h3>
          <div className="space-y-3">
            {sales.slice(0, 10).map(sale => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">ออเดอร์ #{sale.id.slice(-6)}</p>
                  <p className="text-xs text-slate-400">{format(parseISO(sale.createdAt), 'dd MMM yyyy HH:mm')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">฿{sale.total.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{sale.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน'}</p>
                </div>
              </div>
            ))}
          </div>
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
                  setRange('custom')
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
