import { useState, useEffect } from 'react'
import { Shield, Check, Users, Package, Plus, Pencil, Trash2, X, Eye, EyeOff, ShoppingCart } from 'lucide-react'
import { packageService } from '../../services/supabaseApi'

const emptyForm = {
  name: '',
  price: '',
  maxUsers: '',
  maxProducts: '',
  salesLimit: '',
  isUnlimited: true,
  isVisible: true,
  features: [''],
}

export default function SuperadminPackages() {
  const [packages, setPackages] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const refresh = async () => {
    const data = await packageService.getAll()
    setPackages(data)
  }

  useEffect(() => {
    refresh()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (pkg) => {
    setEditing(pkg)
    setForm({
      name: pkg.name || '',
      price: pkg.price ?? '',
      maxUsers: pkg.maxUsers ?? '',
      maxProducts: pkg.maxProducts ?? '',
      salesLimit: pkg.salesLimit ?? '',
      isUnlimited: pkg.salesLimit == null,
      isVisible: pkg.isVisible !== false,
      features: (pkg.features || []).length > 0 ? [...pkg.features] : [''],
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        price: Number(form.price) || 0,
        maxUsers: Number(form.maxUsers) || 0,
        maxProducts: Number(form.maxProducts) || 0,
        salesLimit: form.isUnlimited ? null : (Number(form.salesLimit) || 0),
        isVisible: form.isVisible,
        features: form.features.filter(f => f.trim()),
      }
      if (editing) {
        await packageService.update(editing.id, payload)
      } else {
        await packageService.create(payload)
      }
      setShowForm(false)
      await refresh()
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    }
  }

  const handleDelete = async (pkg) => {
    if (!confirm(`ลบแพ็คเกจ "${pkg.name}"?`)) return
    try {
      await packageService.remove(pkg.id)
      await refresh()
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    }
  }

  const updateFeature = (i, val) => {
    const next = [...form.features]
    next[i] = val
    if (val.trim() && i === next.length - 1) next.push('')
    setForm({ ...form, features: next.filter((f, idx) => f.trim() || idx < next.length - 1) })
  }

  return (
    <div className="h-full">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">แพ็คเกจราคา</h1>
          <p className="text-sm text-slate-400">จัดการแพ็คเกจและราคาค่าบริการ</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          <span>เพิ่มแพ็คเกจ</span>
        </button>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Shield size={20} className="text-primary-600" />
                </div>
                <div className="flex items-center space-x-1">
                  {pkg.price === 0 && (
                    <span className="px-2.5 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-lg">ฟรี</span>
                  )}
                  {pkg.isVisible === false && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-lg" title="ซ่อนจากลูกค้า"><EyeOff size={12} /></span>
                  )}
                  <button onClick={() => openEdit(pkg)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(pkg)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800">{pkg.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-primary-600">฿{pkg.price.toLocaleString()}</span>
                <span className="text-sm text-slate-400">/เดือน</span>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Users size={16} className="text-slate-400" />
                  <span>ผู้ใช้สูงสุด {pkg.maxUsers} คน</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Package size={16} className="text-slate-400" />
                  <span>สินค้าสูงสุด {pkg.maxProducts?.toLocaleString?.() ?? '-'} รายการ</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <ShoppingCart size={16} className="text-slate-400" />
                  <span>รายการขาย/เดือน {pkg.salesLimit == null ? 'ไม่จำกัด' : pkg.salesLimit.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 mb-2">ฟีเจอร์:</p>
                <ul className="space-y-2">
                  {(pkg.features || []).map((f, i) => (
                    <li key={i} className="flex items-start space-x-2 text-sm text-slate-600">
                      <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขแพ็คเกจ' : 'เพิ่มแพ็คเกจ'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อแพ็คเกจ</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ราคา/เดือน (บาท)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ผู้ใช้สูงสุด</label>
                  <input type="number" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">สินค้าสูงสุด</label>
                  <input type="number" value={form.maxProducts} onChange={e => setForm({ ...form, maxProducts: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">รายการขาย/เดือน</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={form.isUnlimited ? '' : form.salesLimit}
                      disabled={form.isUnlimited}
                      onChange={e => setForm({ ...form, salesLimit: e.target.value })}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm disabled:bg-slate-100 disabled:text-slate-400"
                      placeholder={form.isUnlimited ? 'ไม่จำกัด' : ''}
                    />
                    <label className="flex items-center space-x-1.5 text-xs text-slate-600 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isUnlimited}
                        onChange={e => setForm({ ...form, isUnlimited: e.target.checked })}
                        className="w-4 h-4 accent-primary-600"
                      />
                      <span>ไม่จำกัด</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={form.isVisible}
                  onChange={e => setForm({ ...form, isVisible: e.target.checked })}
                  className="w-4 h-4 accent-primary-600"
                />
                <label htmlFor="isVisible" className="text-sm text-slate-700 cursor-pointer flex items-center space-x-1.5">
                  <Eye size={14} className="text-slate-400" />
                  <span>แสดงให้ลูกค้าเห็น</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ฟีเจอร์</label>
                <div className="space-y-2">
                  {form.features.map((f, i) => (
                    <input
                      key={i}
                      value={f}
                      onChange={e => updateFeature(i, e.target.value)}
                      placeholder={i === form.features.length - 1 ? 'เพิ่มฟีเจอร์...' : ''}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                    />
                  ))}
                </div>
              </div>
              <div className="flex space-x-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-medium text-sm">บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
