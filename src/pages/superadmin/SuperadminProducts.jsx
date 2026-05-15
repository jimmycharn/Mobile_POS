import { useState, useEffect, useRef } from 'react'
import { Package, Search, Plus, Barcode, X, Save, Tag, Edit3, ScanBarcode } from 'lucide-react'
import { productService } from '../../services/supabaseApi'

export default function SuperadminProducts() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', barcode: '', category: '', unit: '' })
  const [scanningBarcode, setScanningBarcode] = useState(false)
  const scanVideoRef = useRef(null)
  const scanAnimRef = useRef(null)

  useEffect(() => {
    refresh()
  }, [])

  const refresh = async () => {
    let list = await productService.getAll()
    if (search.trim()) {
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
    }
    setProducts(list)
  }

  useEffect(() => {
    refresh()
  }, [search])

  useEffect(() => {
    if (!scanningBarcode) return
    let stream = null
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (scanVideoRef.current) {
          scanVideoRef.current.srcObject = stream
          await scanVideoRef.current.play()
          if ('BarcodeDetector' in window) {
            const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128', 'code_39'] })
            const loop = async () => {
              if (!scanningBarcode || !scanVideoRef.current) return
              try {
                const barcodes = await detector.detect(scanVideoRef.current)
                if (barcodes.length > 0) {
                  setForm(f => ({ ...f, barcode: barcodes[0].rawValue }))
                  setScanningBarcode(false)
                  return
                }
              } catch (e) {}
              scanAnimRef.current = requestAnimationFrame(loop)
            }
            loop()
          }
        }
      } catch (err) {
        alert('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาติการใช้กล้อง')
        setScanningBarcode(false)
      }
    }
    start()
    return () => {
      if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [scanningBarcode])

  const handleSave = async () => {
    if (editingId) {
      await productService.update(editingId, form)
      setEditingId(null)
    } else {
      await productService.create(form)
    }
    setShowForm(false)
    setForm({ name: '', barcode: '', category: '', unit: '' })
    await refresh()
  }

  const handleEdit = (p) => {
    setEditingId(p.id)
    setForm({ name: p.name, barcode: p.barcode, category: p.category, unit: p.unit })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('ลบสินค้านี้ออกจากคลังกลาง?')) return
    await productService.remove(id)
    await refresh()
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
                      <button onClick={() => handleEdit(p)} className="text-slate-300 hover:text-primary-500 mr-2">
                        <Edit3 size={18} />
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{editingId ? 'แก้ไขสินค้ากลาง' : 'เพิ่มสินค้ากลาง'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', barcode: '', category: '', unit: '' }); setScanningBarcode(false) }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input placeholder="บาร์โค้ด" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                <button onClick={() => setScanningBarcode(s => !s)} className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500" title="สแกนบาร์โค้ด">
                  <ScanBarcode size={18} />
                </button>
              </div>
              {scanningBarcode && (
                <div className="relative w-full h-40 rounded-xl overflow-hidden bg-black">
                  <video ref={scanVideoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                  <button onClick={() => setScanningBarcode(false)} className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-xs font-medium">ปิดกล้อง</button>
                </div>
              )}
              <input placeholder="ชื่อสินค้า" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="หมวดหมู่" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="หน่วย (เช่น ขวด, ซอง)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', barcode: '', category: '', unit: '' }); setScanningBarcode(false) }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
