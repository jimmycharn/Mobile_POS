import { useState, useEffect } from 'react'
import { Search, Package, Plus, Minus, AlertTriangle, ArrowUpDown, Trash2, Edit3, X, Save, Barcode } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopProductService, productService, authService } from '../services/mockData'

export default function InventoryPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showStockIn, setShowStockIn] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [stockInQty, setStockInQty] = useState('')
  const [form, setForm] = useState({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '' })
  const [filter, setFilter] = useState('all') // all, low, standard, custom

  useEffect(() => {
    if (user?.shopId) refresh()
  }, [user])

  const refresh = () => {
    let list = shopProductService.getByShop(user.shopId)
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
    if (filter === 'low') list = list.filter(p => p.stock <= p.minStock)
    if (filter === 'standard') list = list.filter(p => p.isStandard)
    if (filter === 'custom') list = list.filter(p => !p.isStandard)
    setProducts(list)
  }

  useEffect(() => {
    refresh()
  }, [search, filter])

  const handleSave = () => {
    if (selectedProduct) {
      shopProductService.update(selectedProduct.id, {
        name: form.name,
        barcode: form.barcode,
        category: form.category,
        unit: form.unit,
        costPrice: Number(form.costPrice),
        salePrice: Number(form.salePrice),
        minStock: Number(form.minStock),
      })
      authService.logActivity(user.id, user.shopId, 'EDIT_PRODUCT', `แก้ไขสินค้า ${form.name}`)
    } else {
      const newProduct = shopProductService.create({
        shopId: user.shopId,
        productId: null,
        name: form.name,
        barcode: form.barcode || 'SHOP' + Date.now(),
        category: form.category || 'ทั่วไป',
        unit: form.unit || 'ชิ้น',
        costPrice: Number(form.costPrice) || 0,
        salePrice: Number(form.salePrice) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 5,
        isStandard: false,
      })
      authService.logActivity(user.id, user.shopId, 'ADD_PRODUCT', `เพิ่มสินค้าใหม่ ${form.name}`)
    }
    setShowForm(false)
    setSelectedProduct(null)
    setForm({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '' })
    refresh()
  }

  const handleDelete = (id) => {
    if (!confirm('ยืนยันลบสินค้านี้?')) return
    shopProductService.remove(id)
    refresh()
  }

  const openEdit = (p) => {
    setSelectedProduct(p)
    setForm({
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      unit: p.unit,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      stock: p.stock,
      minStock: p.minStock,
    })
    setShowForm(true)
  }

  const handleStockIn = () => {
    if (!selectedProduct || !stockInQty) return
    const newStock = selectedProduct.stock + Number(stockInQty)
    shopProductService.update(selectedProduct.id, { stock: newStock })
    authService.logActivity(user.id, user.shopId, 'STOCK_IN', `รับสินค้า ${selectedProduct.name} จำนวน ${stockInQty} ${selectedProduct.unit} (คงเหลือ ${newStock})`)
    setShowStockIn(false)
    setSelectedProduct(null)
    setStockInQty('')
    refresh()
  }

  const categories = [...new Set(shopProductService.getByShop(user.shopId).map(p => p.category))]

  // Permission check: owner always can manage, staff needs canManageInventory flag
  const canManage = user.role === 'owner' || (user.role === 'staff' && (user.canManageInventory ?? true))

  return (
    <div className="h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800">จัดการสินค้าและสต็อก</h1>
            <p className="text-sm text-slate-400">รับสินค้าเข้า ตรวจสอบ และจัดการสต็อก</p>
          </div>
          {canManage && (
            <div className="flex space-x-2">
              <button
                onClick={() => { setShowForm(true); setSelectedProduct(null); setForm({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '' }) }}
                className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={18} />
                <span>เพิ่มสินค้า</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 outline-none text-sm"
            />
          </div>
          <div className="flex space-x-2 overflow-x-auto no-scrollbar">
            {[
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'low', label: 'ใกล้หมด' },
              { key: 'standard', label: 'มาตรฐาน' },
              { key: 'custom', label: 'เฉพาะร้าน' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === f.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {products.some(p => p.stock <= p.minStock) && filter !== 'low' && (
        <div className="mx-4 md:mx-6 mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center space-x-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">สินค้าใกล้หมดสต็อก</p>
            <p className="text-xs text-amber-600">มี {products.filter(p => p.stock <= p.minStock).length} รายการที่เหลือน้อยกว่าจำนวนขั้นต่ำ</p>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="p-4 md:p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">สินค้า</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">บาร์โค้ด</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">ราคาขาย</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">ต้นทุน</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">สต็อก</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">ขั้นต่ำ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(product => {
                  const isLow = product.stock <= product.minStock
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                            <Package size={16} className="text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{product.name}</p>
                            <p className="text-xs text-slate-400">{product.category} · {product.isStandard ? 'มาตรฐาน' : 'เฉพาะร้าน'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{product.barcode}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">฿{product.salePrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500">฿{product.costPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                          isLow ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {product.stock} {product.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-500 hidden md:table-cell">{product.minStock}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => { setSelectedProduct(product); setShowStockIn(true); setStockInQty('') }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600"
                              title="รับสินค้าเข้า"
                            >
                              <ArrowUpDown size={16} />
                            </button>
                            <button
                              onClick={() => openEdit(product)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600"
                              title="แก้ไข"
                            >
                              <Edit3 size={16} />
                            </button>
                            {!product.isStandard && (
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                                title="ลบ"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">{selectedProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อสินค้า</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">บาร์โค้ด</label>
                <input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">หมวดหมู่</label>
                  <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} list="cats" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                  <datalist id="cats">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">หน่วย</label>
                  <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ราคาต้นทุน</label>
                  <input type="number" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ราคาขาย</label>
                  <input type="number" value={form.salePrice} onChange={e => setForm({...form, salePrice: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
              </div>
              {!selectedProduct && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">สต็อกเริ่มต้น</label>
                    <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">สต็อกขั้นต่ำ</label>
                    <input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                  </div>
                </div>
              )}
              <button onClick={handleSave} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl text-sm">
                <Save size={16} className="inline mr-2" />
                {selectedProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock In Modal */}
      {showStockIn && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">รับสินค้าเข้า</h2>
              <button onClick={() => setShowStockIn(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-medium text-slate-800">{selectedProduct.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">สต็อกปัจจุบัน: {selectedProduct.stock} {selectedProduct.unit}</p>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">จำนวนที่รับเข้า</label>
              <input
                type="number"
                value={stockInQty}
                onChange={e => setStockInQty(e.target.value)}
                placeholder="ระบุจำนวน"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-lg font-semibold text-center"
                autoFocus
              />
            </div>
            <button
              onClick={handleStockIn}
              disabled={!stockInQty || Number(stockInQty) <= 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              ยืนยันรับสินค้าเข้า
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
