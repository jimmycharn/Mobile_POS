import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, X, QrCode, Edit3, ChefHat, LayoutGrid, Copy, Printer, Store } from 'lucide-react'
import QRCode from 'qrcode'
import { useAuth } from '../../context/AuthContext'
import { branchService, departmentService, tableService, authService } from '../../services/supabaseApi'

// Slugify: keep ascii + Thai for code; lowercase, strip spaces
const slugify = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')

export default function RestaurantSettingsPage() {
  const { user } = useAuth()
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])
  const [tables, setTables] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  // Department modal
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [deptForm, setDeptForm] = useState({ name: '', code: '', color: '#10b981' })
  // Table modal
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [tableForm, setTableForm] = useState({ name: '', code: '', seats: 4 })
  // QR modal
  const [qrTarget, setQrTarget] = useState(null) // { type:'table'|'dept', name, url, dataUrl }

  const selectedBranch = useMemo(() => branches.find(b => b.id === selectedBranchId), [branches, selectedBranchId])

  const reload = async () => {
    if (!user?.shopId) return
    const [bs, ds] = await Promise.all([
      branchService.getByShop(user.shopId),
      departmentService.getByShop(user.shopId),
    ])
    setBranches(bs)
    setDepartments(ds)
    if (!selectedBranchId && bs.length) setSelectedBranchId(user.branchId || bs[0].id)
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [user?.shopId])

  useEffect(() => {
    if (!selectedBranchId) { setTables([]); return }
    tableService.getByBranch(selectedBranchId).then(setTables).catch(() => setTables([]))
  }, [selectedBranchId])

  const setBranchMode = async (branch, mode) => {
    try {
      await branchService.update(branch.id, { mode })
      await authService.logActivity('SET_BRANCH_MODE', `เปลี่ยนโหมดสาขา ${branch.name} เป็น ${mode === 'restaurant' ? 'ร้านอาหาร' : 'POS'}`)
      setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, mode } : b))
    } catch (err) { alert('เปลี่ยนโหมดไม่สำเร็จ: ' + err.message) }
  }

  // ---------------- Departments ----------------
  const openDeptCreate = () => {
    setEditingDept(null)
    setDeptForm({ name: '', code: '', color: '#10b981' })
    setShowDeptModal(true)
  }
  const openDeptEdit = (d) => {
    setEditingDept(d)
    setDeptForm({ name: d.name, code: d.code, color: d.color || '#10b981' })
    setShowDeptModal(true)
  }
  const saveDept = async () => {
    const name = deptForm.name.trim()
    if (!name) { alert('กรุณาระบุชื่อแผนก'); return }
    const code = slugify(deptForm.code || name)
    if (!code) { alert('รหัสแผนกไม่ถูกต้อง'); return }
    try {
      if (editingDept) {
        await departmentService.update(editingDept.id, { name, code, color: deptForm.color })
      } else {
        await departmentService.create({ shopId: user.shopId, branchId: selectedBranchId, name, code, color: deptForm.color })
      }
      setShowDeptModal(false)
      reload()
    } catch (err) { alert('บันทึกแผนกไม่สำเร็จ: ' + err.message) }
  }
  const removeDept = async (d) => {
    if (!confirm(`ลบแผนก "${d.name}"?`)) return
    try { await departmentService.remove(d.id); reload() } catch (err) { alert('ลบแผนกไม่สำเร็จ: ' + err.message) }
  }

  // ---------------- Tables ----------------
  const openTableCreate = () => {
    if (!selectedBranchId) { alert('กรุณาเลือกสาขา'); return }
    setEditingTable(null)
    setTableForm({ name: '', code: '', seats: 4 })
    setShowTableModal(true)
  }
  const openTableEdit = (t) => {
    setEditingTable(t)
    setTableForm({ name: t.name, code: t.code, seats: t.seats || 4 })
    setShowTableModal(true)
  }
  const saveTable = async () => {
    const name = tableForm.name.trim()
    if (!name) { alert('กรุณาระบุชื่อโต๊ะ'); return }
    const code = slugify(tableForm.code || name)
    if (!code) { alert('รหัสโต๊ะไม่ถูกต้อง'); return }
    try {
      if (editingTable) {
        await tableService.update(editingTable.id, { name, code, seats: Number(tableForm.seats) || 4 })
      } else {
        await tableService.create({ shopId: user.shopId, branchId: selectedBranchId, name, code, seats: Number(tableForm.seats) || 4 })
      }
      setShowTableModal(false)
      const list = await tableService.getByBranch(selectedBranchId)
      setTables(list)
    } catch (err) { alert('บันทึกโต๊ะไม่สำเร็จ: ' + err.message) }
  }
  const removeTable = async (t) => {
    if (!confirm(`ลบโต๊ะ "${t.name}"?`)) return
    try {
      await tableService.remove(t.id)
      const list = await tableService.getByBranch(selectedBranchId)
      setTables(list)
    } catch (err) { alert('ลบโต๊ะไม่สำเร็จ: ' + err.message) }
  }

  // ---------------- QR ----------------
  const showTableQR = async (t) => {
    const url = `${window.location.origin}/t/${encodeURIComponent(t.code)}`
    const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 })
    setQrTarget({ type: 'table', name: t.name, url, dataUrl })
  }
  const showDeptQR = async (d) => {
    const url = `${window.location.origin}/kitchen/${encodeURIComponent(d.code)}`
    const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 })
    setQrTarget({ type: 'dept', name: d.name, url, dataUrl })
  }
  const copyUrl = () => {
    if (!qrTarget) return
    navigator.clipboard?.writeText(qrTarget.url)
    alert('คัดลอกลิงก์แล้ว')
  }
  const printQR = () => {
    if (!qrTarget) return
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>${qrTarget.name}</title></head><body style="font-family:sans-serif;text-align:center;padding:20px">
      <h2 style="margin:0 0 12px">${qrTarget.type === 'table' ? 'โต๊ะ' : 'แผนก'} ${qrTarget.name}</h2>
      <img src="${qrTarget.dataUrl}" style="width:80%;max-width:360px"/>
      <p style="margin-top:12px;font-size:12px;word-break:break-all">${qrTarget.url}</p>
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="h-full pb-24 md:pb-0 overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">ระบบร้านอาหาร</h1>
        <p className="text-sm text-slate-400">จัดการโหมดสาขา · แผนกครัว · โต๊ะ · QR Code</p>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Branch selector + mode toggle */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <Store size={18} className="text-primary-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">สาขา</h2>
              <p className="text-xs text-slate-400">เลือกสาขาที่ต้องการตั้งค่า</p>
            </div>
          </div>
          <div className="space-y-2">
            {branches.map(b => (
              <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl border ${selectedBranchId === b.id ? 'border-primary-300 bg-primary-50/30' : 'border-slate-100'}`}>
                <button onClick={() => setSelectedBranchId(b.id)} className="flex-1 text-left">
                  <p className="text-sm font-medium text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-400">โหมดปัจจุบัน: {b.mode === 'restaurant' ? 'ร้านอาหาร' : 'POS ปกติ'}</p>
                </button>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setBranchMode(b, 'pos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${b.mode !== 'restaurant' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >POS</button>
                  <button
                    onClick={() => setBranchMode(b, 'restaurant')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${b.mode === 'restaurant' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >ร้านอาหาร</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Departments */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <ChefHat size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">แผนกครัว</h2>
                <p className="text-xs text-slate-400">เช่น ครัว, น้ำ, ขนมหวาน</p>
              </div>
            </div>
            <button onClick={openDeptCreate} className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
              <Plus size={16} /><span>เพิ่ม</span>
            </button>
          </div>
          {departments.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-4">ยังไม่มีแผนก</p>
          ) : (
            <div className="space-y-2">
              {departments.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color || '#10b981' }}></span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                      <p className="text-xs text-slate-400 truncate">/{d.code}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => showDeptQR(d)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-primary-500">
                      <QrCode size={16} />
                    </button>
                    <button onClick={() => openDeptEdit(d)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-primary-500">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => removeDept(d)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tables */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <LayoutGrid size={18} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">โต๊ะ {selectedBranch ? `· ${selectedBranch.name}` : ''}</h2>
                <p className="text-xs text-slate-400">โต๊ะที่ลูกค้าสแกน QR เพื่อสั่งอาหาร</p>
              </div>
            </div>
            <button onClick={openTableCreate} className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
              <Plus size={16} /><span>เพิ่มโต๊ะ</span>
            </button>
          </div>
          {tables.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-4">ยังไม่มีโต๊ะในสาขานี้</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {tables.map(t => (
                <div key={t.id} className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate">/{t.code} · {t.seats} ที่นั่ง</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${t.activeOrderId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {t.activeOrderId ? 'เปิด' : 'ว่าง'}
                    </span>
                  </div>
                  <div className="flex justify-end space-x-1 mt-2">
                    <button onClick={() => showTableQR(t)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-primary-500">
                      <QrCode size={16} />
                    </button>
                    <button onClick={() => openTableEdit(t)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-primary-500">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => removeTable(t)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Department modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24" onClick={() => setShowDeptModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{editingDept ? 'แก้ไขแผนก' : 'เพิ่มแผนก'}</h3>
              <button onClick={() => setShowDeptModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="ชื่อแผนก เช่น ครัว, น้ำ"
                value={deptForm.name}
                onChange={e => setDeptForm({ ...deptForm, name: e.target.value, code: deptForm.code || slugify(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
              />
              <input
                placeholder="รหัส (slug สำหรับ URL)"
                value={deptForm.code}
                onChange={e => setDeptForm({ ...deptForm, code: slugify(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
              />
              <div className="flex items-center space-x-3">
                <label className="text-sm text-slate-600">สี</label>
                <input
                  type="color"
                  value={deptForm.color}
                  onChange={e => setDeptForm({ ...deptForm, color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setShowDeptModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
              <button onClick={saveDept} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Table modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24" onClick={() => setShowTableModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{editingTable ? 'แก้ไขโต๊ะ' : 'เพิ่มโต๊ะ'}</h3>
              <button onClick={() => setShowTableModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="ชื่อโต๊ะ เช่น T01, โต๊ะ 5"
                value={tableForm.name}
                onChange={e => setTableForm({ ...tableForm, name: e.target.value, code: tableForm.code || slugify(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
              />
              <input
                placeholder="รหัสโต๊ะ (slug สำหรับ URL)"
                value={tableForm.code}
                onChange={e => setTableForm({ ...tableForm, code: slugify(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
              />
              <input
                type="number"
                placeholder="จำนวนที่นั่ง"
                value={tableForm.seats}
                onChange={e => setTableForm({ ...tableForm, seats: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
              />
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setShowTableModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
              <button onClick={saveTable} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24" onClick={() => setQrTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto text-center" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{qrTarget.type === 'table' ? 'QR โต๊ะ' : 'QR แผนก'} · {qrTarget.name}</h3>
              <button onClick={() => setQrTarget(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <img src={qrTarget.dataUrl} alt="QR" className="w-full max-w-[280px] mx-auto" />
            <p className="text-xs text-slate-500 mt-3 break-all">{qrTarget.url}</p>
            <div className="flex space-x-2 mt-4">
              <button onClick={copyUrl} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm flex items-center justify-center space-x-1">
                <Copy size={14} /><span>คัดลอกลิงก์</span>
              </button>
              <button onClick={printQR} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center space-x-1">
                <Printer size={14} /><span>พิมพ์</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
