import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Package, Plus, Minus, AlertTriangle, ArrowUpDown, Trash2, Edit3, X, Save, Barcode, Ban, Camera as CameraIcon, ScanBarcode, Tag, ChevronDown, FolderOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopProductService, productService, authService, branchService, storageService, recipeService, productUnitService } from '../services/supabaseApi'
import { isStandardBarcode } from '../utils/barcode'

export default function InventoryPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showStockIn, setShowStockIn] = useState(false)
  const [showStockOut, setShowStockOut] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [stockInQty, setStockInQty] = useState('')
  const [stockInCost, setStockInCost] = useState('')
  const [stockOutQty, setStockOutQty] = useState('')
  const [stockOutReason, setStockOutReason] = useState('spoilage')
  const [form, setForm] = useState({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '', imageUrl: '', color: '', size: '', isRecipe: false })
  const [centralProduct, setCentralProduct] = useState(null)
  const [filter, setFilter] = useState('all') // all, low, standard, custom
  const [showScanner, setShowScanner] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [categories, setCategories] = useState([])
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [branchName, setBranchName] = useState('สาขาหลัก')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const catDropdownRef = useRef(null)
  const videoRef = useRef(null)
  const scanCooldownRef = useRef(0)

  // Recipe / BOM states
  const [recipeItems, setRecipeItems] = useState([])
  const [showIngredientPicker, setShowIngredientPicker] = useState(false)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientQty, setIngredientQty] = useState('')
  const [ingredientUnit, setIngredientUnit] = useState('')
  const [productUnitsMap, setProductUnitsMap] = useState({})
  const [showUnitManager, setShowUnitManager] = useState(false)
  const [unitForm, setUnitForm] = useState({ unitName: '', conversionRate: '1', isBase: false })
  const [currentProductForUnits, setCurrentProductForUnits] = useState(null)
  const [ingredientDropdownOpen, setIngredientDropdownOpen] = useState(false)
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const ingredientDropdownRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!user?.branchId) return
    try {
      let list = await shopProductService.getByBranch(user.branchId)
      if (search.trim()) list = list.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search))
      if (filter === 'low') list = list.filter(p => p.stock <= p.minStock)
      if (filter === 'standard') list = list.filter(p => p.isStandard)
      if (filter === 'custom') list = list.filter(p => !p.isStandard)
      setProducts(list)
      setCategories([...new Set(list.map(p => p.category))])
      setColors([...new Set(list.map(p => p.color).filter(Boolean))])
      setSizes([...new Set(list.map(p => p.size).filter(Boolean))])
    } catch (err) {
      console.error('refresh error:', err)
    }
  }, [user?.branchId, search, filter])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (user?.branchId) {
      branchService.getById(user.branchId).then(b => { if (b?.name) setBranchName(b.name) })
    }
  }, [user?.branchId])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) {
        setCatDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ingredientDropdownRef.current && !ingredientDropdownRef.current.contains(e.target)) {
        setIngredientDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBarcodeInput = useCallback(async (code) => {
    setForm(prev => ({ ...prev, barcode: code }))
    if (!code || code.length < 3) {
      setCentralProduct(null)
      return
    }
    if (isStandardBarcode(code)) {
      const central = await productService.getByBarcode(code)
      if (central) {
        setCentralProduct(central)
        setForm(prev => ({
          ...prev,
          name: prev.name || central.name,
          category: prev.category || central.category,
          unit: prev.unit || central.unit,
          imageUrl: prev.imageUrl || central.imageUrl,
        }))
      } else {
        setCentralProduct(null)
      }
    } else {
      setCentralProduct(null)
    }
  }, [])

  useEffect(() => {
    if (!showScanner) return
    let stream = null
    let animId = null
    const COOLDOWN = 1200

    const start = async () => {
      try {
        const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        if (!hasCamera) {
          setScanMsg('เบราว์เซอร์ไม่รองรับกล้อง')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if ('BarcodeDetector' in window) {
            detectLoop()
          } else {
            setScanMsg('เบราว์เซอร์ไม่รองรับสแกนอัตโนมัติ')
          }
        }
      } catch (err) {
        setScanMsg('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาติการใช้กล้อง')
      }
    }

    const detectLoop = async () => {
      if (!showScanner || !videoRef.current) return
      try {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128', 'code_39'] })
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0) {
          const now = Date.now()
          if (now - scanCooldownRef.current > COOLDOWN) {
            scanCooldownRef.current = now
            const code = barcodes[0].rawValue
            setForm(prev => ({ ...prev, barcode: code }))
            handleBarcodeInput(code)
            setScanMsg(`บาร์โค้ด: ${code}`)
            if (navigator.vibrate) navigator.vibrate(150)
            setTimeout(() => setShowScanner(false), 800)
          }
        }
      } catch (e) {}
      animId = requestAnimationFrame(detectLoop)
    }

    start()
    return () => {
      if (animId) cancelAnimationFrame(animId)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [showScanner, handleBarcodeInput])

  const handleSave = async () => {
    try {
      if (!user?.shopId) {
        alert('ไม่พบข้อมูลร้านค้า กรุณาออกจากระบบและเข้าสู่ระบบใหม่')
        return
      }
      if (!user?.branchId) {
        alert('ไม่พบข้อมูลสาขา กรุณาเลือกสาขาก่อน')
        return
      }
      if (selectedProduct) {
        // Editing existing shop product
        const updates = {
          costPrice: Number(form.costPrice),
          salePrice: Number(form.salePrice),
          minStock: Number(form.minStock),
          color: form.color || '',
          size: form.size || '',
        }

        // For standard products, save override fields only if they differ from central
        if (selectedProduct.productId && centralProduct) {
          updates.name = form.name !== centralProduct.name ? form.name : null
          updates.category = form.category !== centralProduct.category ? form.category : null
          updates.unit = form.unit !== centralProduct.unit ? form.unit : null
          updates.imageUrl = form.imageUrl !== centralProduct.imageUrl ? (form.imageUrl || null) : null
          // Don't update barcode for standard products (it lives in products table)
        } else {
          // Non-standard: save everything
          updates.name = form.name
          updates.barcode = form.barcode || 'SHOP' + Date.now()
          updates.category = form.category || 'ทั่วไป'
          updates.unit = form.unit || 'ชิ้น'
          updates.imageUrl = form.imageUrl || null
        }

        // Recipe products have no stock of their own
        if (form.isRecipe) {
          updates.stock = 0
          updates.minStock = 0
        }

        await shopProductService.update(selectedProduct.id, updates)

        // Handle recipe update
        const existingRecipe = await recipeService.getByShopProduct(selectedProduct.id)
        if (form.isRecipe) {
          const itemsPayload = recipeItems.map(i => ({
            ingredientShopProductId: i.ingredientShopProductId,
            quantity: Number(i.quantity),
            unit: i.unit,
          }))
          if (existingRecipe) {
            await recipeService.update(existingRecipe.id, { name: form.name, items: itemsPayload })
          } else {
            await recipeService.create({
              branchId: user.branchId,
              shopProductId: selectedProduct.id,
              name: form.name,
              items: itemsPayload,
            })
          }
        } else if (existingRecipe) {
          await recipeService.remove(existingRecipe.id)
        }

        await authService.logActivity('EDIT_PRODUCT', `แก้ไขสินค้า ${form.name}`)
      } else {
        // Creating new product
        const std = isStandardBarcode(form.barcode)

        if (std) {
          // Standard product: link to central, auto-contribute if not exists
          let central = centralProduct || await productService.getByBarcode(form.barcode)
          if (!central) {
            // Auto-add to central warehouse so other shops can reuse this barcode
            try {
              central = await productService.create({
                barcode: form.barcode,
                name: form.name,
                category: form.category || 'ทั่วไป',
                unit: form.unit || 'ชิ้น',
                imageUrl: form.imageUrl || null,
                isStandard: true,
              })
              await authService.logActivity('CONTRIBUTE_CENTRAL', `เพิ่มสินค้ามาตรฐานเข้าคลังกลาง ${form.name} (${form.barcode})`)
            } catch (err) {
              console.error('contribute central error:', err)
              alert('ไม่สามารถบันทึกสินค้าเข้าคลังกลางได้: ' + err.message)
              return
            }
          }

          const payload = {
            shopId: user.shopId,
            branchId: user.branchId,
            productId: central.id,
            // Override fields: null if same as central, otherwise the shop's value
            name: form.name !== central.name ? form.name : null,
            category: form.category !== central.category ? form.category : null,
            unit: form.unit !== central.unit ? form.unit : null,
            imageUrl: form.imageUrl !== central.imageUrl ? (form.imageUrl || null) : null,
            barcode: null, // standard barcode lives in products table
            costPrice: Number(form.costPrice) || 0,
            salePrice: Number(form.salePrice) || 0,
            stock: form.isRecipe ? 0 : (Number(form.stock) || 0),
            minStock: form.isRecipe ? 0 : (Number(form.minStock) || 5),
            isStandard: true,
            color: form.color || '',
            size: form.size || '',
          }
          const created = await shopProductService.create(payload)
          if (form.isRecipe) {
            await recipeService.create({
              branchId: user.branchId,
              shopProductId: created.id,
              name: form.name,
              items: recipeItems.map(i => ({
                ingredientShopProductId: i.ingredientShopProductId,
                quantity: Number(i.quantity),
                unit: i.unit,
              })),
            })
          }
          await authService.logActivity('ADD_PRODUCT', `เพิ่มสินค้าจากคลังกลาง ${form.name}`)
        } else {
          // Non-standard product: create directly in shop_products
          const payload = {
            shopId: user.shopId,
            branchId: user.branchId,
            productId: null,
            name: form.name,
            barcode: form.barcode || 'SHOP' + Date.now(),
            category: form.category || 'ทั่วไป',
            unit: form.unit || 'ชิ้น',
            costPrice: Number(form.costPrice) || 0,
            salePrice: Number(form.salePrice) || 0,
            stock: form.isRecipe ? 0 : (Number(form.stock) || 0),
            minStock: form.isRecipe ? 0 : (Number(form.minStock) || 5),
            isStandard: false,
            imageUrl: form.imageUrl || '',
            color: form.color || '',
            size: form.size || '',
          }
          const created = await shopProductService.create(payload)
          if (form.isRecipe) {
            await recipeService.create({
              branchId: user.branchId,
              shopProductId: created.id,
              name: form.name,
              items: recipeItems.map(i => ({
                ingredientShopProductId: i.ingredientShopProductId,
                quantity: Number(i.quantity),
                unit: i.unit,
              })),
            })
          }
          await authService.logActivity('ADD_PRODUCT', `เพิ่มสินค้าใหม่ ${form.name}`)
        }
      }
      setShowForm(false)
      setSelectedProduct(null)
      setCentralProduct(null)
      setRecipeItems([])
      setForm({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '', imageUrl: '', color: '', size: '', isRecipe: false })
      await refresh()
    } catch (err) {
      console.error('handleSave error:', err)
      alert('เกิดข้อผิดพลาด: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('ยืนยันลบสินค้านี้?')) return
    await shopProductService.remove(id)
    await refresh()
  }

  const openEdit = async (p) => {
    setSelectedProduct(p)
    if (p.productId) {
      try {
        const central = await productService.getById(p.productId)
        setCentralProduct(central)
      } catch {
        setCentralProduct(null)
      }
    } else {
      setCentralProduct(null)
    }
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category,
      unit: p.unit,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      stock: p.stock,
      minStock: p.minStock,
      imageUrl: p.imageUrl || '',
      color: p.color || '',
      size: p.size || '',
      isRecipe: p.isRecipe || false,
    })

    // Load recipe if product is a recipe
    if (p.isRecipe) {
      try {
        const recipe = await recipeService.getByShopProduct(p.id)
        if (recipe && recipe.recipeItems) {
          setRecipeItems(recipe.recipeItems.map(item => ({
            ingredientShopProductId: item.ingredientShopProductId,
            quantity: item.quantity,
            unit: item.unit,
            id: item.id,
          })))
          // Load units for each ingredient
          const unitMap = {}
          for (const item of recipe.recipeItems) {
            const units = await productUnitService.getByProduct(item.ingredientShopProductId)
            unitMap[item.ingredientShopProductId] = units
          }
          setProductUnitsMap(unitMap)
        } else {
          setRecipeItems([])
        }
      } catch (err) {
        console.error('load recipe error:', err)
        setRecipeItems([])
      }
    } else {
      setRecipeItems([])
      setProductUnitsMap({})
    }

    setShowForm(true)
  }

  const handleStockIn = async () => {
    if (!user?.shopId || !user?.branchId) {
      alert('ไม่พบข้อมูลร้านค้าหรือสาขา กรุณาออกจากระบบและเข้าสู่ระบบใหม่')
      return
    }
    if (!selectedProduct || !stockInQty) return
    const inQty = Number(stockInQty)
    const newStock = selectedProduct.stock + inQty
    const updates = { stock: newStock }
    if (stockInCost && Number(stockInCost) > 0) {
      const inCost = Number(stockInCost)
      const avgCost = ((selectedProduct.stock * selectedProduct.costPrice) + (inQty * inCost)) / newStock
      updates.costPrice = Math.round(avgCost * 100) / 100
    }
    await shopProductService.update(selectedProduct.id, updates)
    const logDetail = stockInCost && Number(stockInCost) > 0
      ? `รับสินค้า ${selectedProduct.name} จำนวน ${inQty} ${selectedProduct.unit} (ทุนล็อตใหม่ ${Number(stockInCost)} บ./หน่วย) (คงเหลือ ${newStock})`
      : `รับสินค้า ${selectedProduct.name} จำนวน ${inQty} ${selectedProduct.unit} (คงเหลือ ${newStock})`
    await authService.logActivity('STOCK_IN', logDetail)
    setShowStockIn(false)
    setSelectedProduct(null)
    setStockInQty('')
    setStockInCost('')
    await refresh()
  }

  const handleStockOut = async () => {
    if (!user?.shopId || !user?.branchId) {
      alert('ไม่พบข้อมูลร้านค้าหรือสาขา กรุณาออกจากระบบและเข้าสู่ระบบใหม่')
      return
    }
    if (!selectedProduct || !stockOutQty) return
    const qty = Number(stockOutQty)
    if (qty <= 0 || qty > selectedProduct.stock) {
      alert(`จำนวนตัดสต็อกต้องไม่เกิน ${selectedProduct.stock} ${selectedProduct.unit}`)
      return
    }
    const newStock = selectedProduct.stock - qty
    await shopProductService.update(selectedProduct.id, { stock: newStock })
    const reasonLabels = { spoilage: 'เน่าเสีย', expiry: 'หมดอายุ', damage: 'เสียหาย', loss: 'สูญหาย' }
    await authService.logActivity('STOCK_OUT', `ตัดสต็อก ${selectedProduct.name} ${qty} ${selectedProduct.unit} (${reasonLabels[stockOutReason]}) (คงเหลือ ${newStock})`)
    setShowStockOut(false)
    setSelectedProduct(null)
    setStockOutQty('')
    setStockOutReason('spoilage')
    await refresh()
  }

  // Permission check: owner always can manage, staff needs canManageInventory flag
  const canManage = user.role === 'owner' || (user.role === 'staff' && (user.canManageInventory ?? true))

  return (
    <div className="h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800">สินค้าและสต็อก ({branchName})</h1>
            <p className="text-sm text-slate-400">รับสินค้าเข้า ตรวจสอบ และจัดการสต็อก</p>
          </div>
          {canManage && (
            <div className="flex space-x-2">
              <button
                onClick={() => { setShowCategoryModal(true); setNewCategoryName('') }}
                className="flex items-center space-x-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Tag size={18} />
                <span>หมวดหมู่</span>
              </button>
              <button
                onClick={() => { setShowForm(true); setSelectedProduct(null); setRecipeItems([]); setProductUnitsMap({}); setForm({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '', imageUrl: '', color: '', size: '', isRecipe: false }) }}
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
      <div className="p-4 md:p-6 pb-20 md:pb-6">
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
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{product.name}</p>
                            <p className="text-xs text-slate-400">
                              {product.category}
                              {product.color && ` · สี: ${product.color}`}
                              {product.size && ` · ขนาด: ${product.size}`}
                              {' · '}{product.isStandard ? 'มาตรฐาน' : 'เฉพาะร้าน'}
                            </p>
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
                              onClick={() => { setSelectedProduct(product); setShowStockIn(true); setStockInQty(''); setStockInCost('') }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600"
                              title="รับสินค้าเข้า"
                            >
                              <ArrowUpDown size={16} />
                            </button>
                            <button
                              onClick={() => { setSelectedProduct(product); setShowStockOut(true); setStockOutQty(''); setStockOutReason('spoilage') }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                              title="ตัดสต็อกสูญเสีย"
                            >
                              <Ban size={16} />
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
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 pb-24 md:pb-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">{selectedProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
              <button onClick={() => { setShowForm(false); setSelectedProduct(null); setCentralProduct(null); setRecipeItems([]); setProductUnitsMap({}); setForm({ name: '', barcode: '', category: '', unit: '', costPrice: '', salePrice: '', stock: '', minStock: '', imageUrl: '', color: '', size: '', isRecipe: false }) }} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              {centralProduct && (
                <div className="px-3 py-2 bg-primary-50 border border-primary-200 rounded-xl">
                  <p className="text-xs text-primary-600 font-medium">จากคลังสินค้ากลาง</p>
                  <p className="text-sm text-slate-700">{centralProduct.name}</p>
                  <p className="text-xs text-slate-400">{centralProduct.barcode} · {centralProduct.category}</p>
                </div>
              )}
              {selectedProduct?.productId && !centralProduct && (
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium">สินค้ามาตรฐาน (จากคลังกลาง)</p>
                </div>
              )}
              {!selectedProduct && form.barcode && !centralProduct && isStandardBarcode(form.barcode) && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-600 font-medium">บาร์โค้ดมาตรฐาน — ยังไม่มีในคลังกลาง ข้อมูลจะบันทึกในส่วนกลาง</p>
                </div>
              )}
              {form.barcode && !isStandardBarcode(form.barcode) && (
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium">บาร์โค้ดเฉพาะร้าน (ไม่มาตรฐาน) — บันทึกเฉพาะร้านนี้</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อสินค้า</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">บาร์โค้ด</label>
                <div className="relative">
                  <input value={form.barcode} onChange={e => handleBarcodeInput(e.target.value)} className="w-full pr-12 pl-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                  <button
                    type="button"
                    onClick={() => { setShowScanner(true); setScanMsg('') }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary-50 hover:bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 transition-colors"
                  >
                    <ScanBarcode size={18} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">รูปสินค้า</label>
                <div className="flex items-center space-x-3">
                  {form.imageUrl && (
                    <div className="relative shrink-0">
                      <img src={form.imageUrl} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                      <button
                        onClick={() => setForm({ ...form, imageUrl: '' })}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]"
                      >
                        x
                      </button>
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files[0]
                        if (!file) return
                        try {
                          setForm(prev => ({ ...prev, imageUrl: 'uploading...' }))
                          const url = await storageService.uploadProductImage(file, user.shopId)
                          setForm(prev => ({ ...prev, imageUrl: url }))
                        } catch (err) {
                          console.error('upload error:', err)
                          alert('อัปโหลดรูปไม่สำเร็จ: ' + err.message)
                          setForm(prev => ({ ...prev, imageUrl: '' }))
                        }
                      }}
                    />
                    <div className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50 transition-colors">
                      <CameraIcon size={18} className="text-slate-400" />
                      <span className="text-sm text-slate-500">เลือกรูป</span>
                    </div>
                  </label>
                </div>
              </div>
              {/* Recipe toggle */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">สินค้าสูตรอาหาร</p>
                  <p className="text-xs text-slate-400">ไม่มีสต็อกตัวเอง ตัดวัตถุดิบตามสูตร</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isRecipe: !form.isRecipe })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.isRecipe ? 'bg-primary-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isRecipe ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">หมวดหมู่</label>
                  <div className="relative" ref={catDropdownRef}>
                    <button
                      type="button"
                      onClick={() => { setCatDropdownOpen(o => !o); if (!catDropdownOpen) setNewCategory('') }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm flex items-center justify-between bg-white"
                    >
                      <span className={form.category ? 'text-slate-800' : 'text-slate-400'}>
                        {form.category || 'เลือก'}
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${catDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {catDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-[60] max-h-72 overflow-y-auto animate-scale-in">
                        {categories.length === 0 ? (
                          <div className="px-4 py-6 text-center">
                            <FolderOpen size={32} className="text-slate-200 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">ยังไม่มีหมวดหมู่</p>
                          </div>
                        ) : (
                          <div className="py-1">
                            {categories.map(cat => {
                              const count = products.filter(p => p.category === cat).length
                              return (
                                <div key={cat} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 mx-1 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => { setForm({...form, category: cat}); setCatDropdownOpen(false) }}
                                    className="flex-1 text-left text-sm text-slate-700"
                                  >
                                    {cat}
                                  </button>
                                  <span className="text-xs text-slate-400 mr-2">{count}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm(`ลบหมวดหมู่ "${cat}"?\nสินค้าในหมวดหมู่นี้จะถูกย้ายไปหมวดหมู่ "ทั่วไป"`)) return
                                      const all = await shopProductService.getByBranch(user.branchId)
                                      for (const p of all.filter(p => p.category === cat)) {
                                        await shopProductService.update(p.id, { category: 'ทั่วไป' })
                                      }
                                      setCategories(prev => prev.filter(c => c !== cat))
                                      if (form.category === cat) setForm({...form, category: ''})
                                      await refresh()
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <div className="p-2 border-t border-slate-100 space-y-2">
                          <div className="flex space-x-2">
                            <input
                              placeholder="หมวดหมู่ใหม่"
                              value={newCategory}
                              onChange={e => setNewCategory(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && newCategory.trim()) {
                                  const trimmed = newCategory.trim()
                                  setCategories(prev => [...new Set([...prev, trimmed])])
                                  setForm({...form, category: trimmed})
                                  setNewCategory('')
                                  setCatDropdownOpen(false)
                                }
                              }}
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!newCategory.trim()) return
                                const trimmed = newCategory.trim()
                                setCategories(prev => [...new Set([...prev, trimmed])])
                                setForm({...form, category: trimmed})
                                setNewCategory('')
                                setCatDropdownOpen(false)
                              }}
                              className="px-3 py-2 rounded-xl bg-primary-600 text-white"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setShowCategoryModal(true); setCatDropdownOpen(false); setNewCategoryName('') }}
                            className="w-full text-center text-xs text-primary-600 hover:text-primary-700 font-medium py-1"
                          >
                            จัดการหมวดหมู่
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">หน่วย</label>
                  <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">สี</label>
                  <input value={form.color} onChange={e => setForm({...form, color: e.target.value})} list="colors" placeholder="เช่น แดง, น้ำเงิน" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                  <datalist id="colors">
                    {colors.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ขนาด</label>
                  <input value={form.size} onChange={e => setForm({...form, size: e.target.value})} list="sizes" placeholder="เช่น S, M, 1.5" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
                  <datalist id="sizes">
                    {sizes.map(s => <option key={s} value={s} />)}
                  </datalist>
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
              {/* Recipe Builder */}
              {form.isRecipe && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <p className="text-sm font-medium text-slate-700">สูตรอาหาร (วัตถุดิบ)</p>
                  {recipeItems.length > 0 && (
                    <div className="space-y-2">
                      {recipeItems.map((item, idx) => {
                        const ing = products.find(p => p.id === item.ingredientShopProductId)
                        return (
                          <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-2 border border-slate-100">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 truncate">{ing?.name || 'วัตถุดิบ'}</p>
                              <p className="text-xs text-slate-400">{item.quantity} {item.unit}</p>
                            </div>
                            <button onClick={() => setRecipeItems(prev => prev.filter((_, i) => i !== idx))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="relative" ref={ingredientDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIngredientDropdownOpen(o => !o)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm flex items-center justify-between"
                      >
                        <span className="text-slate-400">{ingredientSearch || 'เลือกวัตถุดิบ...'}</span>
                        <ChevronDown size={14} className="text-slate-400" />
                      </button>
                      {ingredientDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-[60] max-h-60 overflow-y-auto">
                          <input
                            type="text"
                            placeholder="ค้นหาวัตถุดิบ..."
                            value={ingredientSearch}
                            onChange={e => setIngredientSearch(e.target.value)}
                            className="w-full px-3 py-2 border-b border-slate-100 text-sm outline-none"
                          />
                          {products.filter(p => !p.isRecipe && (p.name || '').toLowerCase().includes((ingredientSearch || '').toLowerCase())).map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedIngredientId(p.id)
                                setIngredientSearch(p.name)
                                setIngredientUnit(p.unit || 'ชิ้น')
                                productUnitService.getByProduct(p.id).then(units => {
                                  setProductUnitsMap(prev => ({ ...prev, [p.id]: units }))
                                  if (units.length > 0) setIngredientUnit(units[0].unitName)
                                })
                                setIngredientDropdownOpen(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-700"
                            >
                              {p.name} (คงเหลือ: {p.stock} {p.unit})
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setIngredientDropdownOpen(false)
                              const name = prompt('ชื่อวัตถุดิบใหม่:')
                              if (!name) return
                              const unit = prompt('หน่วยพื้นฐาน (เช่น กรัม, ฟอง):') || 'ชิ้น'
                              shopProductService.create({
                                shopId: user.shopId,
                                branchId: user.branchId,
                                name,
                                category: 'วัตถุดิบ',
                                unit,
                                costPrice: 0,
                                salePrice: 0,
                                stock: 0,
                                minStock: 0,
                              }).then(newIng => {
                                refresh().then(() => {
                                  setSelectedIngredientId(newIng.id)
                                  setIngredientSearch(newIng.name)
                                  setIngredientUnit(newIng.unit || 'ชิ้น')
                                })
                              })
                            }}
                            className="w-full text-left px-3 py-2 text-primary-600 text-sm font-medium border-t border-slate-100"
                          >
                            + สร้างวัตถุดิบใหม่
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedIngredientId && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={ingredientQty}
                          onChange={e => setIngredientQty(e.target.value)}
                          placeholder="จำนวน"
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                        />
                        <select
                          value={ingredientUnit}
                          onChange={e => setIngredientUnit(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                        >
                          {(productUnitsMap[selectedIngredientId] || []).map(u => (
                            <option key={u.id} value={u.unitName}>{u.unitName}</option>
                          ))}
                          <option value={products.find(p => p.id === selectedIngredientId)?.unit || 'ชิ้น'}>
                            {products.find(p => p.id === selectedIngredientId)?.unit || 'ชิ้น'} (default)
                          </option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedIngredientId || !ingredientQty) return
                            setRecipeItems(prev => [...prev, {
                              ingredientShopProductId: selectedIngredientId,
                              quantity: Number(ingredientQty),
                              unit: ingredientUnit,
                            }])
                            setSelectedIngredientId('')
                            setIngredientSearch('')
                            setIngredientQty('')
                            setIngredientUnit('')
                          }}
                          className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  {recipeItems.length > 0 && (
                    <div className="bg-primary-50 rounded-lg p-3 border border-primary-100">
                      <p className="text-xs font-medium text-primary-700 mb-1">สูตรโดยสรุป</p>
                      <p className="text-xs text-primary-600">
                        1 {form.unit || 'ชิ้น'} {form.name || 'สินค้า'} = {recipeItems.map(item => {
                          const ing = products.find(p => p.id === item.ingredientShopProductId)
                          return `${ing?.name || '?'} ${item.quantity}${item.unit}`
                        }).join(' + ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!selectedProduct && !form.isRecipe && (
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
              {selectedProduct && !form.isRecipe && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">สต็อกขั้นต่ำ</label>
                  <input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
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
              <p className="text-xs text-slate-400 mt-0.5">สต็อกปัจจุบัน: {selectedProduct.stock} {selectedProduct.unit} · ทุนเฉลี่ยปัจจุบัน: {selectedProduct.costPrice} บ./หน่วย</p>
            </div>
            <div className="mb-4">
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
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ราคาทุนต่อหน่วยของล็อตนี้ (บาท)</label>
              <input
                type="number"
                value={stockInCost}
                onChange={e => setStockInCost(e.target.value)}
                placeholder="ระบุราคาทุน (ไม่บังคับ)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-lg font-semibold text-center"
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

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="shrink-0 flex items-center justify-between p-4 bg-black/50">
            <h3 className="text-white font-bold text-lg">สแกนบาร์โค้ด / QR Code</h3>
            <button onClick={() => setShowScanner(false)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
              <X size={22} />
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-2 border-white/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            {scanMsg && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
                <span className="bg-black/70 text-white px-5 py-2.5 rounded-full text-sm font-medium backdrop-blur">{scanMsg}</span>
              </div>
            )}
          </div>
          <div className="shrink-0 p-5 bg-black/50 space-y-3">
            {!('BarcodeDetector' in window) && (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { setScanMsg('ถ่ายรูปแล้ว กรุณากรอกบาร์โค้ดด้านล่าง') }}
                />
                <div className="w-full py-3 rounded-xl bg-white/20 text-white text-center text-sm font-medium">ถ่ายรูปบาร์โค้ด</div>
              </label>
            )}
            <input
              type="text"
              placeholder="กรอกบาร์โค้ดเอง"
              className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/50 outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setForm(prev => ({ ...prev, barcode: e.target.value }))
                  setShowScanner(false)
                }
              }}
            />
            <p className="text-white/50 text-xs text-center">วางบาร์โค้ดให้อยู่ในกรอบแล้วรอสักครู่</p>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-scale-in my-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">จัดการหมวดหมู่</h2>
              <button onClick={() => setShowCategoryModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {categories.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีหมวดหมู่</p>
              )}
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat).length
                return (
                  <div key={cat} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <Tag size={16} className="text-primary-500" />
                      <span className="text-sm font-medium text-slate-800">{cat}</span>
                      <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`ลบหมวดหมู่ "${cat}"?\nสินค้า ${count} รายการจะถูกย้ายไปหมวดหมู่ "ทั่วไป"`)) return
                        const all = await shopProductService.getByBranch(user.branchId)
                        for (const p of all.filter(p => p.category === cat)) {
                          await shopProductService.update(p.id, { category: 'ทั่วไป' })
                        }
                        await refresh()
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="p-5 border-t border-slate-100 space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="ชื่อหมวดหมู่ใหม่..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCategoryName.trim()) {
                      const trimmed = newCategoryName.trim()
                      setCategories(prev => [...new Set([...prev, trimmed])])
                      setForm(prev => ({ ...prev, category: trimmed }))
                      setNewCategoryName('')
                      setShowCategoryModal(false)
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!newCategoryName.trim()) return
                    const trimmed = newCategoryName.trim()
                    setCategories(prev => [...new Set([...prev, trimmed])])
                    setForm(prev => ({ ...prev, category: trimmed }))
                    setNewCategoryName('')
                    setShowCategoryModal(false)
                  }}
                  disabled={!newCategoryName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-primary-600 disabled:bg-slate-200 text-white text-sm font-medium transition-colors"
                >
                  เพิ่ม
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center">กด Enter หรือปุ่ม "เพิ่ม" เพื่อสร้างหมวดหมู่ใหม่</p>
            </div>
          </div>
        </div>
      )}

      {/* Stock Out Modal */}
      {showStockOut && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">ตัดสต็อกสูญเสีย</h2>
              <button onClick={() => setShowStockOut(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-medium text-slate-800">{selectedProduct.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">สต็อกปัจจุบัน: {selectedProduct.stock} {selectedProduct.unit}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">เหตุผล</label>
              <select
                value={stockOutReason}
                onChange={e => setStockOutReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
              >
                <option value="spoilage">เน่าเสีย</option>
                <option value="expiry">หมดอายุ</option>
                <option value="damage">เสียหาย</option>
                <option value="loss">สูญหาย</option>
              </select>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">จำนวนที่ตัดสต็อก</label>
              <input
                type="number"
                value={stockOutQty}
                onChange={e => setStockOutQty(e.target.value)}
                placeholder="ระบุจำนวน"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-lg font-semibold text-center"
                autoFocus
              />
            </div>
            <button
              onClick={handleStockOut}
              disabled={!stockOutQty || Number(stockOutQty) <= 0 || Number(stockOutQty) > selectedProduct.stock}
              className="w-full bg-red-500 hover:bg-red-600 disabled:bg-slate-200 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              ยืนยันตัดสต็อกสูญเสีย
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
