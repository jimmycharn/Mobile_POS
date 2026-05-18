import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Plus, Minus, ShoppingCart, X, ChefHat, Receipt, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { customerApi } from '../../services/supabaseApi'

// Persist a stable session id so we know which items were added in this device
function getSessionId() {
  let id = localStorage.getItem('cust_session_id')
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('cust_session_id', id)
  }
  return id
}

const STATUS_LABELS = {
  pending: { label: 'รอครัวรับออเดอร์', color: 'bg-amber-100 text-amber-700' },
  preparing: { label: 'กำลังทำ', color: 'bg-blue-100 text-blue-700' },
  ready: { label: 'พร้อมเสิร์ฟ', color: 'bg-emerald-100 text-emerald-700' },
  served: { label: 'เสิร์ฟแล้ว', color: 'bg-slate-200 text-slate-600' },
  cancel_requested: { label: 'รออนุมัติยกเลิก', color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'ยกเลิก', color: 'bg-slate-200 text-slate-500' },
}

export default function CustomerMenuPage() {
  const { tableCode } = useParams()
  const sessionId = useMemo(getSessionId, [])
  const [tableInfo, setTableInfo] = useState(null) // {table_id, table_name, shop_name, branch_name, active_order_id, order_status, error}
  const [menu, setMenu] = useState([])
  const [items, setItems] = useState([]) // all order_items for active order
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showCart, setShowCart] = useState(false)
  const [showProduct, setShowProduct] = useState(null)
  const [productNote, setProductNote] = useState('')
  const [productQty, setProductQty] = useState(1)
  const [busy, setBusy] = useState(false)

  // ---------------- Load table + menu ----------------
  const loadTable = async () => {
    try {
      const info = await customerApi.getTable(tableCode)
      setTableInfo(info || { error: 'table_not_found' })
    } catch (err) {
      setTableInfo({ error: err.message })
    }
  }
  const loadMenu = async () => {
    try {
      const list = await customerApi.getMenu(tableCode)
      setMenu(list || [])
    } catch { /* ignore */ }
  }
  const loadItems = async (orderId) => {
    if (!orderId) { setItems([]); return }
    try {
      const list = await customerApi.listItems(orderId)
      setItems(list)
    } catch { /* ignore */ }
  }

  useEffect(() => { loadTable(); loadMenu() /* eslint-disable-next-line */ }, [tableCode])
  useEffect(() => { loadItems(tableInfo?.active_order_id) /* eslint-disable-next-line */ }, [tableInfo?.active_order_id])

  // ---------------- Realtime: order_items (this order) + restaurant_tables (this table) ----------------
  useEffect(() => {
    if (!tableInfo?.active_order_id) return
    const orderId = tableInfo.active_order_id
    const ch = supabase
      .channel(`cust_order_${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => {
        loadItems(orderId)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_orders', filter: `id=eq.${orderId}` }, () => {
        loadTable()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tableInfo?.active_order_id])

  useEffect(() => {
    if (!tableInfo?.table_id) return
    const ch = supabase
      .channel(`cust_table_${tableInfo.table_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_tables', filter: `id=eq.${tableInfo.table_id}` }, () => {
        loadTable()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tableInfo?.table_id])

  // ---------------- Derived ----------------
  const cartItems = items.filter(i => i.status === 'cart')
  const submittedItems = items.filter(i => i.status !== 'cart' && i.status !== 'cancelled')
  const cartTotal = cartItems.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0)
  const orderTotal = items
    .filter(i => i.status !== 'cancelled' && i.status !== 'cart')
    .reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0)

  const categories = useMemo(() => ['all', ...Array.from(new Set(menu.map(p => p.category).filter(Boolean)))], [menu])
  const filteredMenu = useMemo(() => {
    let list = menu
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory)
    if (search) list = list.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()))
    return list
  }, [menu, activeCategory, search])

  // ---------------- Actions ----------------
  const isOpen = tableInfo?.active_order_id && tableInfo?.order_status === 'open'
  const isAwaitingPayment = tableInfo?.order_status === 'awaiting_payment'
  const isClosed = !tableInfo?.active_order_id

  const openProduct = (p) => {
    if (!isOpen) return
    setShowProduct(p)
    setProductQty(1)
    setProductNote('')
  }
  const addToCart = async () => {
    if (!showProduct) return
    setBusy(true)
    try {
      await customerApi.addItem(tableCode, showProduct.id, productQty, productNote, sessionId)
      setShowProduct(null)
      await loadItems(tableInfo.active_order_id)
    } catch (err) {
      alert('เพิ่มสินค้าไม่สำเร็จ: ' + err.message)
    } finally { setBusy(false) }
  }
  const updateQty = async (item, delta) => {
    const next = Number(item.qty) + delta
    try {
      await customerApi.updateItem(tableCode, item.id, next)
      await loadItems(tableInfo.active_order_id)
    } catch (err) { alert('แก้ไขจำนวนไม่สำเร็จ: ' + err.message) }
  }
  const removeCartItem = async (item) => {
    try {
      await customerApi.removeItem(tableCode, item.id)
      await loadItems(tableInfo.active_order_id)
    } catch (err) { alert('ลบไม่สำเร็จ: ' + err.message) }
  }
  const confirmOrder = async () => {
    if (!cartItems.length) return
    setBusy(true)
    try {
      const n = await customerApi.confirmOrder(tableCode)
      await loadItems(tableInfo.active_order_id)
      if (n > 0) {
        setShowCart(false)
        if (navigator.vibrate) navigator.vibrate(120)
      }
    } catch (err) { alert('ส่งออเดอร์ไม่สำเร็จ: ' + err.message) }
    finally { setBusy(false) }
  }
  const cancelPending = async (item) => {
    if (!confirm(`ยกเลิก "${item.name}"?`)) return
    try {
      await customerApi.cancelPending(tableCode, item.id)
      await loadItems(tableInfo.active_order_id)
    } catch (err) { alert('ยกเลิกไม่สำเร็จ: ' + err.message) }
  }
  const requestCancel = async (item) => {
    if (!confirm(`ขออนุมัติยกเลิก "${item.name}"?\nรายการนี้กำลังถูกเตรียม จะต้องรอพนักงานยืนยัน`)) return
    try {
      await customerApi.requestCancel(tableCode, item.id)
      await loadItems(tableInfo.active_order_id)
    } catch (err) { alert('ส่งคำขอไม่สำเร็จ: ' + err.message) }
  }
  const requestBill = async () => {
    if (!confirm('ต้องการให้พนักงานเก็บเงินใช่หรือไม่?')) return
    try {
      await customerApi.requestBill(tableCode)
      await loadTable()
    } catch (err) { alert('ส่งคำขอไม่สำเร็จ: ' + err.message) }
  }

  // ---------------- States: not found / closed ----------------
  if (!tableInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">กำลังโหลด…</p>
      </div>
    )
  }
  if (tableInfo.error || !tableInfo.table_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <AlertCircle size={48} className="text-red-400 mb-3" />
        <h1 className="text-lg font-bold text-slate-800">ไม่พบโต๊ะนี้</h1>
        <p className="text-sm text-slate-500 mt-1">โปรดตรวจสอบ QR Code หรือสอบถามพนักงาน</p>
      </div>
    )
  }
  if (isClosed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <Lock size={48} className="text-slate-400 mb-3" />
        <h1 className="text-lg font-bold text-slate-800">โต๊ะ {tableInfo.table_name} ยังไม่เปิดใช้งาน</h1>
        <p className="text-sm text-slate-500 mt-2">กรุณาเรียกพนักงานเพื่อเปิดโต๊ะก่อนสั่งอาหาร</p>
        <p className="text-xs text-slate-400 mt-4">{tableInfo.shop_name} · {tableInfo.branch_name}</p>
      </div>
    )
  }

  // ---------------- Render ----------------
  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 truncate">{tableInfo.shop_name} · {tableInfo.branch_name}</p>
            <h1 className="text-base font-bold text-slate-800 truncate">โต๊ะ {tableInfo.table_name}</h1>
          </div>
          {isAwaitingPayment && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg whitespace-nowrap">รอเก็บเงิน</span>
          )}
        </div>

        <div className="mt-3 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเมนู…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-slate-50"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex space-x-2 overflow-x-auto mt-3 -mx-4 px-4 pb-1 no-scrollbar">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeCategory === c ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {c === 'all' ? 'ทั้งหมด' : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submitted items status board */}
      {submittedItems.length > 0 && (
        <div className="px-4 mt-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-3">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center"><ChefHat size={12} className="mr-1.5" /> รายการที่สั่งแล้ว</p>
            <div className="space-y-1.5">
              {submittedItems.map(it => {
                const meta = STATUS_LABELS[it.status] || { label: it.status, color: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={it.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-700 truncate">{it.name} <span className="text-slate-400">×{it.qty}</span></p>
                      {it.note && <p className="text-[11px] text-slate-400 truncate">{it.note}</p>}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ml-2 whitespace-nowrap ${meta.color}`}>{meta.label}</span>
                    {it.status === 'pending' && (
                      <button onClick={() => cancelPending(it)} className="ml-2 text-[11px] text-red-500">ยกเลิก</button>
                    )}
                    {(it.status === 'preparing' || it.status === 'ready') && (
                      <button onClick={() => requestCancel(it)} className="ml-2 text-[11px] text-orange-500">ขอยกเลิก</button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-sm">
              <span className="text-slate-500">รวมยอด</span>
              <span className="font-bold text-slate-800">฿{orderTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Menu grid */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        {filteredMenu.map(p => (
          <button
            key={p.id}
            onClick={() => openProduct(p)}
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden text-left hover:border-primary-200 transition-colors disabled:opacity-50"
            disabled={!isOpen}
          >
            {p.imageUrl ? (
              <div className="aspect-square bg-slate-100">
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square bg-slate-100 flex items-center justify-center">
                <ChefHat size={32} className="text-slate-300" />
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
              <p className="text-xs text-slate-400 truncate">{p.category}</p>
              <p className="text-sm font-bold text-primary-600 mt-1">฿{Number(p.salePrice || 0).toLocaleString()}</p>
            </div>
          </button>
        ))}
        {filteredMenu.length === 0 && (
          <div className="col-span-2 text-center text-slate-400 text-sm py-12">ไม่พบเมนู</div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 z-30">
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCart(true)}
            disabled={!isOpen || cartItems.length === 0}
            className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ShoppingCart size={16} />
            <span>ตะกร้า ({cartItems.reduce((s, i) => s + Number(i.qty), 0)}) · ฿{cartTotal.toLocaleString()}</span>
          </button>
          {submittedItems.length > 0 && !isAwaitingPayment && (
            <button
              onClick={requestBill}
              className="flex items-center justify-center space-x-1 py-3 px-4 rounded-xl bg-amber-500 text-white font-semibold text-sm"
            >
              <Receipt size={16} />
              <span>เรียกเก็บเงิน</span>
            </button>
          )}
        </div>
      </div>

      {/* Product detail modal */}
      {showProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-800 truncate">{showProduct.name}</h3>
                <p className="text-sm text-slate-400">฿{Number(showProduct.salePrice || 0).toLocaleString()} / {showProduct.unit}</p>
              </div>
              <button onClick={() => setShowProduct(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            {showProduct.imageUrl && (
              <img src={showProduct.imageUrl} alt={showProduct.name} className="w-full aspect-square object-cover rounded-2xl mb-3" />
            )}
            <textarea
              value={productNote}
              onChange={e => setProductNote(e.target.value)}
              placeholder="หมายเหตุ (เช่น ไม่ใส่ผัก, เผ็ดน้อย)"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-3">
                <button onClick={() => setProductQty(Math.max(1, productQty - 1))} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Minus size={18} /></button>
                <span className="text-lg font-bold text-slate-800 w-8 text-center">{productQty}</span>
                <button onClick={() => setProductQty(productQty + 1)} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Plus size={18} /></button>
              </div>
              <button
                onClick={addToCart}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm disabled:opacity-60"
              >
                เพิ่มลงตะกร้า · ฿{(productQty * Number(showProduct.salePrice || 0)).toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowCart(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">ตะกร้าสินค้า</h3>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cartItems.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">ตะกร้าว่าง</p>
              ) : cartItems.map(it => (
                <div key={it.id} className="flex items-center space-x-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                    {it.note && <p className="text-[11px] text-slate-400 truncate">{it.note}</p>}
                    <p className="text-xs text-slate-500">฿{Number(it.salePrice).toLocaleString()} × {it.qty}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => updateQty(it, -1)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm font-bold">{it.qty}</span>
                    <button onClick={() => updateQty(it, 1)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Plus size={14} /></button>
                    <button onClick={() => removeCartItem(it)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-slate-100 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">รวม</span>
                <span className="font-bold text-slate-800">฿{cartTotal.toLocaleString()}</span>
              </div>
              <button
                onClick={confirmOrder}
                disabled={busy || cartItems.length === 0}
                className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                ส่งออเดอร์ไปยังครัว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
