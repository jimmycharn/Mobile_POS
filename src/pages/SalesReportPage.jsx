import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { saleService, shopProductService } from '../services/mockData'
import { startOfDay, endOfDay, subDays, format, parseISO, isSameDay } from 'date-fns'

export default function SalesReportPage() {
  const { user } = useAuth()
  const [range, setRange] = useState('7') // days
  const [currentDate, setCurrentDate] = useState(new Date())

  const sales = useMemo(() => {
    if (!user?.shopId) return []
    const end = endOfDay(currentDate)
    const start = startOfDay(subDays(end, Number(range) - 1))
    return saleService.getByDateRange(user.shopId, start, end)
  }, [user, range, currentDate])

  const products = useMemo(() => {
    if (!user?.shopId) return []
    return shopProductService.getByShop(user.shopId)
  }, [user])

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
    const totalOrders = sales.length
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const todaySales = sales.filter(s => isSameDay(parseISO(s.createdAt), currentDate))
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
    return { totalRevenue, totalOrders, avgOrder, todayRevenue, todayOrders: todaySales.length }
  }, [sales, currentDate])

  const dailyData = useMemo(() => {
    const data = {}
    const end = endOfDay(currentDate)
    const start = startOfDay(subDays(end, Number(range) - 1))
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
  }, [sales, range, currentDate])

  const paymentStats = useMemo(() => {
    const cash = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0)
    const transfer = sales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0)
    return { cash, transfer }
  }, [sales])

  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  return (
    <div className="h-full pb-20 md:pb-0">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">รายงานยอดขาย</h1>
        <p className="text-sm text-slate-400">สรุปผลประกอบการและแนวโน้มยอดขาย</p>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex space-x-2 overflow-x-auto no-scrollbar">
            {[
              { value: '7', label: '7 วัน' },
              { value: '30', label: '30 วัน' },
            ].map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  range === r.value ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-sm text-slate-600">{format(subDays(currentDate, Number(range) - 1), 'dd MMM')} - {format(currentDate, 'dd MMM yyyy')}</span>
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
    </div>
  )
}
