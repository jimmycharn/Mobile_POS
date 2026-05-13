import { useState, useEffect } from 'react'
import { Package, Search, Plus, Barcode, X, Save, Tag } from 'lucide-react'
import { productService } from '../../services/mockData'

export default function SuperadminProducts() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', barcode: '', category: '', unit: '' })

  useEffect(() => {
    refresh()
  }, [])

  const refresh = () => {
    let list = productService.getAll()
    if (search.trim()) {
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
    }
    setProducts(list)
  }

  useEffect(() => {
    refresh()
  }, [search])

  const handleSave = () => {
    productService.create(form)
    setShowForm(false)
    setForm({ name: '', barcode: '', category: '', unit: '' })
    refresh()
  }

  const handleDelete = (id) => {
    if (!confirm('ลบสินค้านี้ออกจากคลังกลาง?')) return
    productService.remove(id)
    refresh()
  }

  return (
    <div className="h-full">
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">คลังสินค้ากลาง</h1>
            <p className="text-sm text-slate-400">สินค้ามาตรฐานที่ทุกร้านสามารถดึงไปใช้ได้</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setForm({ name: '', barcode: '', category: '', unit: '' }) }}
            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
          >
            <Plus size={18} />
            <span>เพิ่มสินค้า</span>
          </button>
        </div>
        <div className="relative mt-4 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">สินค้า</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">บาร์โค้ด</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">หมวดหมู่</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">หน่วย</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Package size={16} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{p.barcode}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">{p.category}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{p.unit}</td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => handleDelete(p.id)} className="text-slate-300 hover:text-red-500">
                        <X size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length === 0 && (
            <div className="text-center py-12">
              <Package size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่พบสินค้า</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-800 mb-4">เพิ่มสินค้ากลาง</h3>
            <div className="space-y-3">
              <input placeholder="ชื่อสินค้า" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="บาร์โค้ด" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="หมวดหมู่" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="หน่วย (เช่น ขวด, ซอง)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
