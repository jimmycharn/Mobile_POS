import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChefHat, Clock, CheckCircle2, Bell, AlertCircle, Ban, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { departmentService, orderService } from '../../services/supabaseApi'

const fmtTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
const minsAgo = (ts) => {
  if (!ts) return null
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
}

export default function KitchenBoardPage() {
  const { deptCode } = useParams()
  const [dept, setDept] = useState(null)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [, force] = useState(0)

  // Re-render every 30s for elapsed times
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const load = async (d) => {
    if (!d) return
    try {
      const list = await orderService.getItemsByDepartment(d.id, ['pending', 'preparing', 'ready', 'cancel_requested'])
      setItems(list)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    let cancelled = false
    departmentService.getByCode(deptCode).then(d => {
      if (cancelled) return
      if (!d) { setError('ไม่พบแผนกนี้'); return }
      setDept(d)
      load(d)
    }).catch(err => setError(err.message))
    return () => { cancelled = true }
  }, [deptCode])

  // Realtime
  useEffect(() => {
    if (!dept?.id) return
    const ch = supabase
      .channel(`kitchen_${dept.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `department_id=eq.${dept.id}` }, (payload) => {
        // Beep on new pending arrival
        if (soundOn && payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
          beep()
        }
        if (soundOn && payload.eventType === 'UPDATE' && payload.new?.status === 'pending' && payload.old?.status !== 'pending') {
          beep()
        }
        load(dept)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dept?.id, soundOn])

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.1
      osc.start()
      setTimeout(() => { osc.stop(); ctx.close() }, 200)
    } catch { /* noop */ }
  }

  const setStatus = async (item, status) => {
    try {
      await orderService.setItemStatus(item.id, status)
      load(dept)
    } catch (err) { alert('อัปเดตสถานะไม่สำเร็จ: ' + err.message) }
  }

  const groups = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending' || i.status === 'cancel_requested'),
    preparing: items.filter(i => i.status === 'preparing'),
    ready: items.filter(i => i.status === 'ready'),
  }), [items])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <AlertCircle size={48} className="text-red-400 mb-3" />
        <p className="text-lg">{error}</p>
      </div>
    )
  }
  if (!dept) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">กำลังโหลด…</div>
  }

  const Card = ({ item, actions }) => {
    const tableName = item.restaurantOrders?.restaurantTables?.name || '—'
    const ageMin = minsAgo(item.confirmedAt)
    const stale = ageMin != null && ageMin >= 10
    return (
      <div className={`rounded-2xl p-3 shadow-sm ${stale ? 'bg-red-50 border-2 border-red-300' : 'bg-white border border-slate-100'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-500">โต๊ะ {tableName}</span>
          <span className="text-[10px] text-slate-400">
            <Clock size={10} className="inline mr-0.5" />
            {fmtTime(item.confirmedAt)} ({ageMin != null ? `${ageMin} นาที` : '-'})
          </span>
        </div>
        <p className="text-base font-bold text-slate-800">{item.name} <span className="text-primary-600">×{item.qty}</span></p>
        {item.note && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">📝 {item.note}</p>}
        {item.status === 'cancel_requested' && (
          <div className="mt-2 flex items-center space-x-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
            <Bell size={12} /><span>ลูกค้าขอยกเลิก</span>
          </div>
        )}
        <div className="flex space-x-1.5 mt-2">{actions}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-900 z-30">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color || '#10b981' }}></span>
          <div>
            <h1 className="text-lg font-bold">ครัว · {dept.name}</h1>
            <p className="text-xs text-slate-400">รวม {items.length} รายการ</p>
          </div>
        </div>
        <button
          onClick={() => setSoundOn(s => !s)}
          className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"
          title={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} className="text-slate-500" />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {/* Pending */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-amber-300 flex items-center"><Bell size={14} className="mr-1.5" /> รอรับ ({groups.pending.length})</h2>
          </div>
          <div className="space-y-2">
            {groups.pending.length === 0 && <div className="text-xs text-slate-500 text-center py-6">ไม่มีรายการ</div>}
            {groups.pending.map(it => (
              <Card key={it.id} item={it} actions={
                <>
                  <button onClick={() => setStatus(it, 'preparing')} className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-xs font-bold">เริ่มทำ</button>
                  {it.status === 'cancel_requested' ? (
                    <button onClick={() => setStatus(it, 'cancelled')} className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-bold">อนุมัติยกเลิก</button>
                  ) : (
                    <button onClick={() => setStatus(it, 'cancelled')} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs"><Ban size={12} /></button>
                  )}
                </>
              } />
            ))}
          </div>
        </div>

        {/* Preparing */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-blue-300 flex items-center"><ChefHat size={14} className="mr-1.5" /> กำลังทำ ({groups.preparing.length})</h2>
          </div>
          <div className="space-y-2">
            {groups.preparing.length === 0 && <div className="text-xs text-slate-500 text-center py-6">ไม่มีรายการ</div>}
            {groups.preparing.map(it => (
              <Card key={it.id} item={it} actions={
                <button onClick={() => setStatus(it, 'ready')} className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1">
                  <CheckCircle2 size={12} /><span>พร้อมเสิร์ฟ</span>
                </button>
              } />
            ))}
          </div>
        </div>

        {/* Ready */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-emerald-300 flex items-center"><CheckCircle2 size={14} className="mr-1.5" /> พร้อมเสิร์ฟ ({groups.ready.length})</h2>
          </div>
          <div className="space-y-2">
            {groups.ready.length === 0 && <div className="text-xs text-slate-500 text-center py-6">ไม่มีรายการ</div>}
            {groups.ready.map(it => (
              <Card key={it.id} item={it} actions={
                <button onClick={() => setStatus(it, 'served')} className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold">เสิร์ฟแล้ว</button>
              } />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
