import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Receipt, ArrowLeft, Banknote, QrCode, Building2, Check, Trash2, GitMerge } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { orderService, saleService, bankAccountService, shopProductService, recipeService, authService } from '../../services/supabaseApi'
import { generatePromptPayQrUrl, isPromptPayId } from '../../utils/promptpay'

export default function CashierPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedOrderId = searchParams.get('order')

  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId || '')
  const [bankAccounts, setBankAccounts] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [selectedBankAccount, setSelectedBankAccount] = useState(null)
  const [received, setReceived] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [qrUrl, setQrUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  // Merge mode
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeFromId, setMergeFromId] = useState('')

  const reload = async () => {
    if (!user?.branchId) return
    const list = await orderService.getByBranch(user.branchId, ['open', 'awaiting_payment'])
    setOrders(list)
    // Auto-select awaiting_payment if no selection
    if (!selectedOrderId) {
      const awaiting = list.find(o => o.status === 'awaiting_payment')
      if (awaiting) setSelectedOrderId(awaiting.id)
    }
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [user?.branchId])
  useEffect(() => { if (user?.shopId) bankAccountService.getByShop(user.shopId).then(setBankAccounts) }, [user?.shopId])

  useEffect(() => {
    if (!user?.branchId) return
    const ch = supabase
      .channel(`cashier_${user.branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders', filter: `branch_id=eq.${user.branchId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, reload)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.branchId])

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId])
  const billItems = useMemo(() => {
    if (!selectedOrder) return []
    return (selectedOrder.orderItems || []).filter(i => i.status !== 'cancelled' && i.status !== 'cart')
  }, [selectedOrder])
  const subtotal = billItems.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0)
  const finalTotal = Math.max(0, subtotal - Number(discountAmount || 0))
  const change = paymentMethod === 'cash' ? Math.max(0, Number(received || 0) - finalTotal) : 0

  // PromptPay QR
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (paymentMethod === 'transfer' && selectedBankAccount?.type === 'promptpay' && isPromptPayId(selectedBankAccount.accountNo)) {
        const url = await generatePromptPayQrUrl(selectedBankAccount.accountNo, finalTotal)
        if (!cancelled) setQrUrl(url)
      } else {
        setQrUrl(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [paymentMethod, selectedBankAccount, finalTotal])

  const handleCheckout = async () => {
    if (!selectedOrder) return
    if (paymentMethod === 'cash' && Number(received || 0) < finalTotal) {
      alert('เงินที่รับมาไม่พอชำระ')
      return
    }
    setBusy(true)
    try {
      // Build sale items from non-cart, non-cancelled items
      const items = billItems.map(i => ({
        id: i.shopProductId,
        name: i.name,
        qty: Number(i.qty),
        salePrice: Number(i.salePrice || 0),
        costPrice: 0,
        unit: '',
      }))

      // Compute stock deductions: load each product, then for recipes load ingredients
      const productIds = Array.from(new Set(items.map(i => i.id).filter(Boolean)))
      const products = await Promise.all(productIds.map(id => shopProductService.getById(id).catch(() => null)))
      const productMap = Object.fromEntries(products.filter(Boolean).map(p => [p.id, p]))

      const stockDelta = {} // id -> qty to subtract
      for (const it of items) {
        const sp = productMap[it.id]
        if (!sp) continue
        if (sp.isRecipe) {
          try {
            const recipe = await recipeService.getByShopProduct(sp.id)
            for (const ri of recipe?.recipeItems || []) {
              const ing = await shopProductService.getById(ri.ingredientShopProductId).catch(() => null)
              if (!ing) continue
              const usage = Number(ri.quantity) * it.qty
              stockDelta[ing.id] = (stockDelta[ing.id] || 0) + usage
            }
          } catch { /* ignore */ }
        } else {
          stockDelta[sp.id] = (stockDelta[sp.id] || 0) + it.qty
        }
      }

      // Create the sale
      const sale = await saleService.create({
        shop_id: user.shopId,
        branch_id: user.branchId,
        items,
        total: finalTotal,
        discount: Number(discountAmount || 0),
        discount_type: 'amount',
        payment_method: paymentMethod,
        received: paymentMethod === 'cash' ? Number(received || 0) : finalTotal,
        change: paymentMethod === 'cash' ? change : 0,
        staff_id: user.id,
      })

      // Deduct stock
      await Promise.all(
        Object.entries(stockDelta).map(async ([id, qty]) => {
          const cur = await shopProductService.getById(id).catch(() => null)
          if (!cur) return
          await shopProductService.update(id, { stock: Math.max(0, Number(cur.stock || 0) - qty) })
        })
      )

      // Close order, link sale, free the table
      await orderService.closePaid(selectedOrder.id, sale.id)

      await authService.logActivity('REST_CHECKOUT', `เก็บเงินโต๊ะ ${selectedOrder.restaurantTables?.name || ''} ยอด ฿${finalTotal.toLocaleString()}`)

      // Reset and reload
      setSelectedOrderId('')
      setReceived('')
      setDiscountAmount(0)
      setPaymentMethod('cash')
      setSelectedBankAccount(null)
      await reload()
    } catch (err) {
      alert('เก็บเงินไม่สำเร็จ: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleMerge = async () => {
    if (!selectedOrderId || !mergeFromId || mergeFromId === selectedOrderId) return
    if (!confirm('ย้ายรายการทั้งหมดเข้ามาในโต๊ะนี้?')) return
    try {
      await orderService.merge(selectedOrderId, mergeFromId)
      setMergeMode(false)
      setMergeFromId('')
      await reload()
    } catch (err) { alert('รวมโต๊ะไม่สำเร็จ: ' + err.message) }
  }

  return (
    <div className="h-full pb-24 md:pb-0 overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate('/tables')} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800">แคชเชียร์</h1>
            <p className="text-sm text-slate-400">เก็บเงิน · รวมโต๊ะ · ปิดบิล</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Orders sidebar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 space-y-2 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <p className="text-xs font-bold text-slate-500 px-2 pt-1">ออเดอร์ที่เปิดอยู่ ({orders.length})</p>
          {orders.length === 0 && <p className="text-sm text-slate-400 text-center py-4">ไม่มีออเดอร์เปิดอยู่</p>}
          {orders.map(o => {
            const tableName = o.restaurantTables?.name || 'โต๊ะ?'
            const total = (o.orderItems || [])
              .filter(i => i.status !== 'cancelled' && i.status !== 'cart')
              .reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0)
            const isAwaiting = o.status === 'awaiting_payment'
            return (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`w-full text-left p-3 rounded-xl border ${
                  selectedOrderId === o.id ? 'border-primary-300 bg-primary-50' :
                  isAwaiting ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{tableName}</span>
                  {isAwaiting && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">รอเก็บเงิน</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">฿{total.toLocaleString()}</p>
              </button>
            )
          })}
        </div>

        {/* Bill panel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          {!selectedOrder ? (
            <p className="text-center text-slate-400 py-12">เลือกออเดอร์เพื่อเก็บเงิน</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">โต๊ะ {selectedOrder.restaurantTables?.name}</h2>
                  <p className="text-xs text-slate-400">{billItems.length} รายการ · เปิด {new Date(selectedOrder.openedAt).toLocaleTimeString('th-TH')}</p>
                </div>
                <button
                  onClick={() => setMergeMode(m => !m)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"
                >
                  <GitMerge size={14} /><span>รวมโต๊ะ</span>
                </button>
              </div>

              {mergeMode && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl flex items-center space-x-2">
                  <select
                    value={mergeFromId}
                    onChange={e => setMergeFromId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="">— เลือกโต๊ะที่จะย้ายเข้ามา —</option>
                    {orders.filter(o => o.id !== selectedOrderId).map(o => (
                      <option key={o.id} value={o.id}>{o.restaurantTables?.name}</option>
                    ))}
                  </select>
                  <button onClick={handleMerge} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">รวม</button>
                </div>
              )}

              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {billItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีรายการ</p>
                ) : billItems.map(it => (
                  <div key={it.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{it.name} <span className="text-slate-400">×{it.qty}</span></p>
                      {it.note && <p className="text-[11px] text-slate-400 truncate">{it.note}</p>}
                      <span className={`text-[10px] ${it.status === 'served' ? 'text-emerald-600' : 'text-slate-400'}`}>{it.status}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">฿{(Number(it.salePrice) * Number(it.qty)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals + payment */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ยอดรวม</span>
                  <span className="font-medium text-slate-800">฿{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">ส่วนลด (บาท)</span>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 text-right text-sm"
                  />
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>ยอดสุทธิ</span>
                  <span className="text-primary-600">฿{finalTotal.toLocaleString()}</span>
                </div>

                {/* Payment method */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setPaymentMethod('cash'); setSelectedBankAccount(null) }}
                    className={`flex flex-col items-center py-3 rounded-xl border-2 ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <Banknote size={20} className={paymentMethod === 'cash' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-xs font-medium mt-1">เงินสด</span>
                  </button>
                  {bankAccounts.filter(a => a.type === 'promptpay').slice(0, 1).map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { setPaymentMethod('transfer'); setSelectedBankAccount(acc) }}
                      className={`flex flex-col items-center py-3 rounded-xl border-2 ${paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <QrCode size={20} className={paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className="text-xs font-medium mt-1">PromptPay</span>
                    </button>
                  ))}
                  {bankAccounts.filter(a => a.type === 'bank').slice(0, 1).map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { setPaymentMethod('transfer'); setSelectedBankAccount(acc) }}
                      className={`flex flex-col items-center py-3 rounded-xl border-2 ${paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <Building2 size={20} className={paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="text-xs font-medium mt-1">โอน</span>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">เงินที่รับมา</label>
                    <input
                      type="number"
                      value={received}
                      onChange={e => setReceived(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm text-right text-lg font-bold"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">เงินทอน</span>
                      <span className="font-bold text-emerald-600">฿{change.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {paymentMethod === 'transfer' && selectedBankAccount?.type === 'promptpay' && qrUrl && (
                  <div className="flex flex-col items-center bg-slate-50 rounded-xl p-4">
                    <img src={qrUrl} alt="PromptPay QR" className="w-44 h-44" />
                    <p className="text-xs text-slate-500 mt-2">{selectedBankAccount.name}</p>
                  </div>
                )}

                {paymentMethod === 'transfer' && selectedBankAccount?.type === 'bank' && (
                  <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
                    <p className="font-semibold text-blue-800">{selectedBankAccount.bankName}</p>
                    <p className="text-blue-700">{selectedBankAccount.accountHolder}</p>
                    <p className="text-blue-700 font-mono">{selectedBankAccount.accountNo}</p>
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={busy || billItems.length === 0}
                  className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Check size={18} /><span>เก็บเงิน · ฿{finalTotal.toLocaleString()}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
