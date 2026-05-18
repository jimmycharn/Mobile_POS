import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Lock, Unlock, ChefHat, Receipt, Users, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { tableService, orderService } from '../../services/supabaseApi'

export default function TableBoardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [busyId, setBusyId] = useState(null)

  const reloadTables = async () => {
    if (!user?.branchId) return
    const list = await tableService.getByBranch(user.branchId)
    setTables(list)
  }
  const reloadOrders = async () => {
    if (!user?.branchId) return
    const list = await orderService.getByBranch(user.branchId, ['open', 'awaiting_payment'])
    setOrders(list)
  }

  useEffect(() => { reloadTables(); reloadOrders() /* eslint-disable-next-line */ }, [user?.branchId])

  // Realtime: tables and orders for this branch
  useEffect(() => {
    if (!user?.branchId) return
    const ch = supabase
      .channel(`tableboard_${user.branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables', filter: `branch_id=eq.${user.branchId}` }, reloadTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders', filter: `branch_id=eq.${user.branchId}` }, reloadOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, reloadOrders)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.branchId])

  const orderForTable = (t) => orders.find(o => o.id === t.activeOrderId)

  const openTable = async (t) => {
    setBusyId(t.id)
    try {
      await tableService.open(t.id)
      await reloadTables(); await reloadOrders()
    } catch (err) { alert('เปิดโต๊ะไม่สำเร็จ: ' + err.message) }
    finally { setBusyId(null) }
  }
  const closeTable = async (t) => {
    if (!confirm(`ปิดโต๊ะ "${t.name}" โดยไม่เก็บเงิน? ออเดอร์ปัจจุบันจะถูกยกเลิก`)) return
    setBusyId(t.id)
    try {
      await tableService.close(t.id)
      await reloadTables(); await reloadOrders()
    } catch (err) { alert('ปิดโต๊ะไม่สำเร็จ: ' + err.message) }
    finally { setBusyId(null) }
  }

  return (
    <div className="h-full pb-24 md:pb-0 overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">จัดการโต๊ะ</h1>
          <p className="text-sm text-slate-400">เปิด/ปิดโต๊ะ · ดูสถานะออเดอร์</p>
        </div>
        <Link to="/cashier" className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Receipt size={16} /><span>แคชเชียร์</span>
        </Link>
      </div>

      <div className="p-4 md:p-6">
        {tables.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-slate-400">ยังไม่มีโต๊ะในสาขานี้</p>
            <Link to="/restaurant" className="inline-block mt-3 text-primary-600 font-medium text-sm">ไปหน้าตั้งค่าเพื่อเพิ่มโต๊ะ</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map(t => {
              const o = orderForTable(t)
              const items = o?.orderItems || []
              const activeItems = items.filter(i => i.status !== 'cancelled')
              const total = activeItems
                .filter(i => i.status !== 'cart')
                .reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0)
              const pending = activeItems.filter(i => i.status === 'pending').length
              const preparing = activeItems.filter(i => i.status === 'preparing').length
              const ready = activeItems.filter(i => i.status === 'ready').length
              const isAwaitingPayment = o?.status === 'awaiting_payment'
              const isOpen = !!t.activeOrderId

              return (
                <div
                  key={t.id}
                  className={`rounded-2xl border p-3 ${
                    isAwaitingPayment ? 'bg-amber-50 border-amber-300' :
                    isOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{t.name}</p>
                      <p className="text-[11px] text-slate-400 truncate flex items-center"><Users size={10} className="mr-0.5" /> {t.seats} ที่นั่ง</p>
                    </div>
                    {isAwaitingPayment ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-800">รอเก็บเงิน</span>
                    ) : isOpen ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">เปิด</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600">ว่าง</span>
                    )}
                  </div>

                  {isOpen && (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <div className="flex justify-between"><span>รอ</span><span className="font-semibold">{pending}</span></div>
                      <div className="flex justify-between"><span>กำลังทำ</span><span className="font-semibold">{preparing}</span></div>
                      <div className="flex justify-between"><span>พร้อมเสิร์ฟ</span><span className="font-semibold">{ready}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-1 text-slate-800"><span>รวม</span><span className="font-bold">฿{total.toLocaleString()}</span></div>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {!isOpen ? (
                      <button
                        onClick={() => openTable(t)}
                        disabled={busyId === t.id}
                        className="col-span-2 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium disabled:opacity-50"
                      >
                        <Unlock size={12} /><span>เปิดโต๊ะ</span>
                      </button>
                    ) : (
                      <>
                        {isAwaitingPayment ? (
                          <button
                            onClick={() => navigate('/cashier?order=' + o.id)}
                            className="col-span-2 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium"
                          >
                            <Receipt size={12} /><span>เก็บเงิน</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate('/cashier?order=' + o.id)}
                            className="flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium"
                          >
                            <Receipt size={12} /><span>เก็บเงิน</span>
                          </button>
                        )}
                        {!isAwaitingPayment && (
                          <button
                            onClick={() => closeTable(t)}
                            disabled={busyId === t.id}
                            className="flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium disabled:opacity-50"
                          >
                            <Lock size={12} /><span>ยกเลิก</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <a
                    href={`/t/${encodeURIComponent(t.code)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 flex items-center justify-center space-x-1 py-1 rounded-lg text-[10px] text-slate-500 hover:bg-white"
                  >
                    <ExternalLink size={10} /><span>หน้าลูกค้า</span>
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
