import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, Receipt, X, ScanBarcode, Store, QrCode, ArrowRight, Building2, AlertTriangle, Printer } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BranchSwitcher from '../components/BranchSwitcher'
import { shopProductService, productService, saleService, cartService, getStats, authService, shopService, bankAccountService, branchService, recipeService, productUnitService, convertToBaseUnit } from '../services/supabaseApi'
import { generatePromptPayQrUrl, isPromptPayId } from '../utils/promptpay'
import { isStandardBarcode } from '../utils/barcode'

export default function PosPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [carts, setCarts] = useState([])
  const [activeCartId, setActiveCartId] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [lastSale, setLastSale] = useState(null)
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, totalProducts: 0 })
  const [receivedAmount, setReceivedAmount] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [discountType, setDiscountType] = useState('amount') // 'amount' | 'percent'
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeColor, setActiveColor] = useState('')
  const [activeSize, setActiveSize] = useState('')
  const [shop, setShop] = useState(null)
  const [allProducts, setAllProducts] = useState([])
  const [shopBankAccounts, setShopBankAccounts] = useState([])
  const [selectedBankAccount, setSelectedBankAccount] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [scannedGlobal, setScannedGlobal] = useState(null)
  const [globalPrice, setGlobalPrice] = useState('')
  const [globalStock, setGlobalStock] = useState('')
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [qrUrl, setQrUrl] = useState(null)
  const videoRef = useRef(null)
  const scanCooldownRef = useRef(0)
  const [showRecipeWarning, setShowRecipeWarning] = useState(false)
  const [recipeShortages, setRecipeShortages] = useState([])
  const [pendingCheckout, setPendingCheckout] = useState(false)
  const [recipeAvailability, setRecipeAvailability] = useState({}) // { shopProductId: { maxServings, isLow } }
  const [lowIngredients, setLowIngredients] = useState([]) // [{ id, name, stock, unit, minStock }]
  const [showLowIngredientList, setShowLowIngredientList] = useState(false)
  const loadedBranchId = useRef(null)
  const allProductsRef = useRef([])
  const discountInputRef = useRef(null)
  const receivedInputRef = useRef(null)

  useEffect(() => {
    allProductsRef.current = allProducts
  }, [allProducts])

  // Hide mobile nav when payment modal is open
  useEffect(() => {
    if (showPayment) {
      document.body.classList.add('payment-modal-open')
    } else {
      document.body.classList.remove('payment-modal-open')
    }
  }, [showPayment])

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1800, ctx.currentTime)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.18)
    } catch (e) {}
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (user?.shopId) {
        const stats = await getStats(user.shopId, user.branchId)
        const shopData = await shopService.getById(user.shopId)
        if (cancelled) return
        setStats(stats)
        setShop(shopData)
      }
      if (user?.branchId) {
        loadedBranchId.current = user.branchId
        const savedCarts = cartService.getBranchCarts(user.branchId)
        const savedActive = cartService.getActiveCartId(user.branchId)
        if (cancelled) return
        setCarts(savedCarts.length ? savedCarts : [{ id: 'cart-1', name: 'บิล 1', items: [] }])
        setActiveCartId(savedActive || 'cart-1')
      }
    }
    init()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (loadedBranchId.current === user?.branchId && user?.branchId) {
      cartService.setBranchCarts(user.branchId, carts)
    }
  }, [carts, user?.branchId])

  useEffect(() => {
    if (loadedBranchId.current === user?.branchId && user?.branchId) {
      cartService.setActiveCartId(user.branchId, activeCartId)
    }
  }, [activeCartId, user?.branchId])

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
            setScanMsg('เบราว์เซอร์ไม่รองรับสแกนอัตโนมัติ กรุณาถ่ายรูปหรือกรอกบาร์โค้ด')
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
            const products = allProductsRef.current
            const product = products.find(p => p.barcode === code)
            if (product) {
              if (product.stock > 0) {
                addToCart(product)
                const variantLabel = [product.color, product.size].filter(Boolean).join(', ')
                setScanMsg(`+ ${product.name}${variantLabel ? ` (${variantLabel})` : ''}`)
                playBeep()
                if (navigator.vibrate) navigator.vibrate(150)
              } else {
                setScanMsg(`${product.name} หมดสต็อก`)
              }
            } else {
              const globalProd = await productService.getByBarcode(code)
              if (globalProd && isStandardBarcode(code)) {
                setScannedGlobal(globalProd)
                setGlobalPrice('')
                setGlobalStock('')
                setScanMsg(`เจอในคลังกลาง: ${globalProd.name}`)
                playBeep()
                if (navigator.vibrate) navigator.vibrate(150)
              } else {
                setScanMsg('ไม่พบสินค้าในระบบ')
              }
            }
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
  }, [showScanner])

  useEffect(() => {
    const load = async () => {
      if (!user?.branchId) { setAllProducts([]); return }
      const data = await shopProductService.getByBranch(user.branchId)
      // Hide ingredient-only products from POS; show only sellable items
      setAllProducts((data || []).filter(p => p.category !== 'วัตถุดิบ'))
    }
    load()
  }, [user?.branchId])

  // Compute max servings for each recipe product based on ingredient stock
  useEffect(() => {
    const compute = async () => {
      const recipeProducts = allProducts.filter(p => p.isRecipe)
      const fullList = await shopProductService.getByBranch(user.branchId)
      // Update low ingredient list (always)
      const ingredients = fullList.filter(p => p.category === 'วัตถุดิบ')
      setLowIngredients(ingredients.filter(p => p.stock <= (p.minStock || 0)))
      if (recipeProducts.length === 0) { setRecipeAvailability({}); return }
      const ingredientMap = Object.fromEntries(fullList.map(p => [p.id, p]))
      const result = {}
      for (const dish of recipeProducts) {
        try {
          const recipe = await recipeService.getByShopProduct(dish.id)
          if (!recipe || !recipe.recipeItems || recipe.recipeItems.length === 0) {
            result[dish.id] = { maxServings: 0, isLow: true, missing: true }
            continue
          }
          let maxServings = Infinity
          for (const ri of recipe.recipeItems) {
            const ing = ingredientMap[ri.ingredientShopProductId]
            if (!ing) { maxServings = 0; break }
            const units = await productUnitService.getByProduct(ing.id)
            const baseQty = convertToBaseUnit(ri.quantity, ri.unit, units)
            if (baseQty <= 0) continue
            const possible = Math.floor(ing.stock / baseQty)
            if (possible < maxServings) maxServings = possible
          }
          if (maxServings === Infinity) maxServings = 0
          result[dish.id] = { maxServings, isLow: maxServings <= 5 }
        } catch (err) {
          result[dish.id] = { maxServings: 0, isLow: true }
        }
      }
      setRecipeAvailability(result)
    }
    compute()
  }, [allProducts, user?.branchId])

  const categories = useMemo(() => {
    const cats = [...new Set(allProducts.map(p => p.category))]
    return ['all', ...cats]
  }, [allProducts])

  const colors = useMemo(() => [...new Set(allProducts.map(p => p.color).filter(Boolean))], [allProducts])
  const sizes = useMemo(() => [...new Set(allProducts.map(p => p.size).filter(Boolean))], [allProducts])

  const products = useMemo(() => {
    let list = allProducts
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(search) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q))
      )
    }
    if (activeCategory !== 'all') {
      list = list.filter(p => p.category === activeCategory)
    }
    if (activeColor) {
      list = list.filter(p => p.color === activeColor)
    }
    if (activeSize) {
      list = list.filter(p => p.size === activeSize)
    }
    return list
  }, [allProducts, search, activeCategory, activeColor, activeSize])

  const activeCart = useMemo(() => carts.find(c => c.id === activeCartId) || { items: [] }, [carts, activeCartId])
  const cart = activeCart.items
  const cartTotal = cart.reduce((sum, item) => sum + item.salePrice * item.qty, 0)
  const cartItems = cart.reduce((sum, item) => sum + item.qty, 0)

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0
    if (discountType === 'percent') return Math.round(cartTotal * (val / 100))
    return val
  }, [cartTotal, discountValue, discountType])

  const finalTotal = Math.max(0, cartTotal - discountAmount)

  const change = useMemo(() => {
    const received = parseFloat(receivedAmount) || 0
    return received - finalTotal
  }, [receivedAmount, finalTotal])

  const setActiveCartItems = (updater) => {
    setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, items: typeof updater === 'function' ? updater(c.items) : updater } : c))
  }

  const addToCart = (product) => {
    const isRecipe = product.isRecipe
    const maxQty = isRecipe ? (recipeAvailability[product.id]?.maxServings ?? 0) : product.stock
    if (!isRecipe && product.stock <= 0) return
    setActiveCartItems(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        if (maxQty > 0 && existing.qty >= maxQty) {
          if (!confirm(`${isRecipe ? 'วัตถุดิบ' : 'สต็อก'}อาจไม่พอ ต้องการเพิ่มต่อหรือไม่?`)) return prev
        }
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      }
      if (isRecipe && maxQty <= 0) {
        if (!confirm('วัตถุดิบหมด ต้องการขายต่อหรือไม่?')) return prev
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setActiveCartItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const cap = item.isRecipe ? Infinity : item.stock
      const newQty = Math.max(1, Math.min(item.qty + delta, cap))
      return { ...item, qty: newQty }
    }))
  }

  const removeFromCart = (id) => {
    setActiveCartItems(prev => prev.filter(item => item.id !== id))
  }

  const createNewCart = () => {
    const newId = 'cart-' + Date.now()
    const newName = 'บิล ' + (carts.length + 1)
    const newCart = { id: newId, name: newName, items: [] }
    setCarts(prev => [...prev, newCart])
    setActiveCartId(newId)
  }

  const switchCart = (id) => {
    setActiveCartId(id)
  }

  const closeCart = (id) => {
    const target = carts.find(c => c.id === id)
    if (target && target.items.length > 0) {
      if (!confirm(`ปิด ${target.name}? สินค้าในบิลนี้จะถูกลบ`)) return
    }
    const filtered = carts.filter(c => c.id !== id)
    if (filtered.length === 0) {
      const emptyCart = { id: 'cart-1', name: 'บิล 1', items: [] }
      setCarts([emptyCart])
      setActiveCartId(emptyCart.id)
      return
    }
    if (activeCartId === id) {
      const idx = carts.findIndex(c => c.id === id)
      const nextActive = filtered[Math.min(idx, filtered.length - 1)]
      setActiveCartId(nextActive.id)
    }
    setCarts(filtered)
  }

  const clearActiveCart = () => {
    setActiveCartItems([])
  }

  useEffect(() => {
    const load = async () => {
      if (!user?.shopId) { setShopBankAccounts([]); setSelectedBankAccount(null); return }
      const accounts = await bankAccountService.getByShop(user.shopId)
      setShopBankAccounts(accounts)
      // Auto-select first account or keep current selection if still valid
      setSelectedBankAccount(prev => {
        if (prev && accounts.find(a => a.id === prev.id)) return prev
        return accounts[0] || null
      })
    }
    load()
  }, [user?.shopId])

  useEffect(() => {
    async function generateQr() {
      if (paymentMethod === 'transfer' && selectedBankAccount?.type === 'promptpay' && isPromptPayId(selectedBankAccount.accountNo)) {
        const url = await generatePromptPayQrUrl(selectedBankAccount.accountNo, finalTotal)
        setQrUrl(url)
      } else {
        setQrUrl(null)
      }
    }
    generateQr()
  }, [paymentMethod, finalTotal, selectedBankAccount])

  const handleCheckout = async (force = false) => {
    try {
      if (cart.length === 0) return
      if (!user?.shopId || !user?.branchId) {
        alert('ไม่พบข้อมูลร้านค้าหรือสาขา กรุณาออกจากระบบและเข้าสู่ระบบใหม่')
        return
      }

      // Validate cash payment has enough received amount
      if (paymentMethod === 'cash' && change < 0) {
        alert('เงินที่รับมาไม่พอชำระ')
        return
      }

      // Check recipe ingredient availability
      const shortages = []
      const deductions = [] // { id, stock }

      for (const item of cart) {
        const sp = await shopProductService.getById(item.id)
        if (!sp) continue

        if (sp.isRecipe) {
          const recipe = await recipeService.getByShopProduct(item.id)
          if (recipe && recipe.recipeItems) {
            for (const ri of recipe.recipeItems) {
              const ingredient = await shopProductService.getById(ri.ingredientShopProductId)
              if (!ingredient) continue
              const units = await productUnitService.getByProduct(ingredient.id)
              const baseQty = convertToBaseUnit(ri.quantity * item.qty, ri.unit, units)
              const newStock = ingredient.stock - baseQty
              if (newStock < 0 && !force) {
                shortages.push({
                  dish: sp.name,
                  ingredient: ingredient.name,
                  required: Math.abs(newStock),
                  unit: ingredient.unit,
                })
              }
              deductions.push({ id: ingredient.id, stock: newStock })
            }
          }
        } else {
          deductions.push({ id: item.id, stock: sp.stock - item.qty })
        }
      }

      if (shortages.length > 0 && !force) {
        setRecipeShortages(shortages)
        setShowRecipeWarning(true)
        return
      }

      const sale = await saleService.create({
        shop_id: user.shopId,
        branch_id: user.branchId,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          salePrice: item.salePrice,
          costPrice: item.costPrice,
          unit: item.unit,
          isRecipe: item.isRecipe || false,
        })),
        total: finalTotal,
        discount: discountAmount,
        discount_type: discountType,
        payment_method: paymentMethod,
        received: paymentMethod === 'cash' ? (parseFloat(receivedAmount) || 0) : finalTotal,
        change: paymentMethod === 'cash' ? Math.max(0, change) : 0,
        staff_id: user.id,
      })

      // Deduct stock (regular products + recipe ingredients)
      for (const d of deductions) {
        await shopProductService.update(d.id, { stock: Math.round(d.stock) })
      }

      await authService.logActivity('SALE', `ขายสินค้า ${cartItems} รายการ ยอดสุทธิ ฿${finalTotal.toLocaleString()}`)

      setLastSale(sale)
      setShowPayment(false)
      setShowReceipt(true)
      setShowRecipeWarning(false)
      setRecipeShortages([])
      setPendingCheckout(false)
      setReceivedAmount('')
      setDiscountValue('')
      setDiscountType('amount')
      const newStats = await getStats(user.shopId, user.branchId)
      setStats(newStats)
      // Refresh products so recipe availability recomputes
      const refreshed = await shopProductService.getByBranch(user.branchId)
      setAllProducts((refreshed || []).filter(p => p.category !== 'วัตถุดิบ'))
      // Close active cart after checkout
      const filtered = carts.filter(c => c.id !== activeCartId)
      if (filtered.length === 0) {
        const emptyCart = { id: 'cart-1', name: 'บิล 1', items: [] }
        setCarts([emptyCart])
        setActiveCartId(emptyCart.id)
      } else {
        const idx = carts.findIndex(c => c.id === activeCartId)
        const nextActive = filtered[Math.min(idx, filtered.length - 1)]
        setCarts(filtered)
        setActiveCartId(nextActive.id)
      }
    } catch (err) {
      console.error('checkout error:', err)
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถบันทึกการขายได้'))
    }
  }

  const catLabel = (cat) => {
    if (cat === 'all') return 'ทั้งหมด'
    return cat
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-white w-full max-w-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative w-full overflow-hidden">

        {/* Top Banner - Shop Info (Mobile + Desktop unified style) */}
        <div className="shrink-0 bg-gradient-to-r from-primary-600 to-primary-500 text-white px-4 pt-4 pb-3 safe-top shadow-sm">
          <div className="flex items-center justify-between">
            {/* Scan button */}
            <button
              onClick={() => { setShowScanner(true); setScanMsg('') }}
              className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center active:bg-white/30 transition-colors"
            >
              <ScanBarcode size={24} />
            </button>

            {/* Center: Shop name + branch */}
            <div className="flex-1 text-center px-2">
              <h1 className="text-lg font-bold truncate">{shop?.name || 'ร้านค้า'}</h1>
              <div className="md:hidden">
                <BranchSwitcher variant="light" />
              </div>
              <p className="hidden md:block text-xs text-primary-100">ยอดขายวันนี้: ฿{stats.todayRevenue.toLocaleString()}</p>
            </div>

            {/* Cart button */}
            <button
              onClick={() => setShowCart(true)}
              className="relative w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center md:hidden"
            >
              <ShoppingCart size={20} />
              {cartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-400 text-primary-800 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category / Search strip */}
        <div className="shrink-0 mt-3 w-full overflow-x-auto overscroll-x-contain no-scrollbar">
          <div className="flex items-center space-x-2 w-max px-4 pb-1">
            {/* Fixed Search icon */}
            <button
              onClick={() => {
                if (showSearchInput) {
                  setShowSearchInput(false)
                  setSearch('')
                  setActiveCategory('all')
                } else {
                  setShowSearchInput(true)
                  setActiveCategory('all')
                }
              }}
              className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm transition-colors ${
                showSearchInput
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white border-slate-100 text-slate-600'
              }`}
            >
              <Search size={20} />
            </button>

            {showSearchInput ? (
              <div className="relative flex-shrink-0 w-full max-w-[calc(100vw-5.5rem)]">
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาสินค้า..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-primary-300 outline-none text-sm shadow-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X size={14} className="text-slate-600" />
                  </button>
                )}
              </div>
            ) : (
              <>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setActiveColor(''); setActiveSize('') }}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      activeCategory === cat
                        ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                        : 'bg-white border border-slate-100 text-slate-600'
                    }`}
                  >
                    {catLabel(cat)}
                  </button>
                ))}
              </>
            )}

          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-24 md:pb-4 no-scrollbar">
          {/* Color / Size Filters — shown when not searching and data exists */}
          {!showSearchInput && (colors.length > 0 || sizes.length > 0) && (
            <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
              {colors.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <span className="text-xs text-slate-400 shrink-0">สี:</span>
                  <button
                    onClick={() => setActiveColor('')}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeColor === '' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    ทั้งหมด
                  </button>
                  {colors.map(c => (
                    <button
                      key={c}
                      onClick={() => setActiveColor(c)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeColor === c ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {sizes.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <span className="text-xs text-slate-400 shrink-0">ขนาด:</span>
                  <button
                    onClick={() => setActiveSize('')}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeSize === '' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    ทั้งหมด
                  </button>
                  {sizes.map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSize(s)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeSize === s ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Low ingredient alert banner */}
          {lowIngredients.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setShowLowIngredientList(true)}
                className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <p className="text-sm font-medium text-amber-800 text-left">
                    มีวัตถุดิบ <span className="font-bold">{lowIngredients.length}</span> รายการใกล้หมด
                  </p>
                </div>
                <span className="text-xs text-amber-600 font-medium">ดูรายการ →</span>
              </button>
            </div>
          )}
          <h3 className="text-sm font-semibold text-slate-500 mb-2 px-1">
            {activeCategory === 'all' ? 'เมนูทั้งหมด' : catLabel(activeCategory)}
            {(activeColor || activeSize) && (
              <span className="font-normal text-slate-400 ml-1">
                {activeColor && `สี ${activeColor}`}{activeColor && activeSize && ' · '}{activeSize && `ขนาด ${activeSize}`}
              </span>
            )}
            <span className="font-normal text-slate-400 ml-1">({products.length})</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map(product => {
              const inCart = cart.find(c => c.id === product.id)
              const recipeAvail = product.isRecipe ? recipeAvailability[product.id] : null
              const effectiveStock = product.isRecipe ? (recipeAvail?.maxServings ?? 0) : product.stock
              const isLowStock = product.isRecipe ? (recipeAvail?.isLow ?? true) : (product.stock <= product.minStock)
              const isOut = product.isRecipe ? (effectiveStock <= 0) : (product.stock <= 0)
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                    isOut ? 'border-slate-100 opacity-60' : 'border-slate-100 shadow-sm'
                  }`}
                >
                  {/* Product Image Area */}
                  <div className="relative bg-slate-100 h-28 flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 bg-white/60 rounded-xl flex items-center justify-center">
                        <Store size={24} className="text-slate-300" />
                      </div>
                    )}
                    {isOut && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <span className="px-3 py-1 bg-black/60 text-white text-xs font-medium rounded-full">{product.isRecipe ? 'วัตถุดิบหมด' : 'หมด'}</span>
                      </div>
                    )}
                    {isLowStock && !isOut && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-400 text-white text-[10px] font-bold rounded-md">{product.isRecipe ? 'วัตถุดิบใกล้หมด' : 'ใกล้หมด'}</span>
                    )}
                    {product.isRecipe && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-md">สูตร</span>
                    )}
                    {inCart && (
                      <span className="absolute top-2 right-2 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                        {inCart.qty}
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{product.name}</p>
                    {(product.color || product.size) && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {product.color && `สี: ${product.color}`}{product.color && product.size && ' · '}{product.size && `ขนาด: ${product.size}`}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold text-primary-600">฿{product.salePrice.toLocaleString()}</span>
                      <span className="text-xs text-slate-400">
                        {product.isRecipe ? `~${effectiveStock} ที่` : `${product.stock} ${product.unit}`}
                      </span>
                    </div>
                    {/* Add Button */}
                    <button
                      onClick={() => addToCart(product)}
                      disabled={isOut}
                      className="w-full mt-2 h-9 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-200 text-white font-semibold text-sm transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {products.length === 0 && (
            <div className="text-center py-12">
              <Search size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">ไม่พบสินค้า</p>
            </div>
          )}
        </div>

        {/* Bottom Cart Bar (Mobile) - show when any cart has items */}
        {carts.some(c => c.items.length > 0) && (
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 safe-bottom">
            <button
              onClick={() => setShowCart(true)}
              className="w-full bg-primary-600 text-white rounded-2xl px-5 py-3.5 shadow-lg shadow-primary-200/50 flex items-center justify-between transition-all active:scale-[0.98]"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <ShoppingCart size={22} />
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 text-primary-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartItems}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-primary-200">{cartItems} รายการ</p>
                  <p className="text-lg font-bold leading-tight">฿{cartTotal.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-sm font-medium">
                <span>ดูตะกร้า</span>
                <ArrowRight size={16} />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Desktop Cart Sidebar */}
      <div className="hidden md:flex flex-col w-[380px] bg-white border-l border-slate-100 h-full overflow-hidden">
        {/* Cart Tabs */}
        <div className="shrink-0 px-4 pt-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {carts.map(c => {
              const itemCount = c.items.reduce((sum, i) => sum + i.qty, 0)
              const isActive = c.id === activeCartId
              return (
                <div key={c.id} className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer select-none ${isActive ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  <button onClick={() => switchCart(c.id)} className="flex items-center gap-1.5">
                    {c.name}
                    {itemCount > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {itemCount}
                      </span>
                    )}
                  </button>
                  {carts.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); closeCart(c.id) }} className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center ${isActive ? 'hover:bg-white/20' : 'hover:bg-slate-200'}`}>
                      <X size={10} />
                    </button>
                  )}
                </div>
              )
            })}
            <button onClick={createNewCart} className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center space-x-2">
            <ShoppingCart size={20} className="text-primary-600" />
            <span>รายการ ({cartItems})</span>
          </h2>
          {cart.length > 0 && (
            <button onClick={clearActiveCart} className="text-xs text-red-400 hover:text-red-600">ล้าง</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า</p>
              <p className="text-xs text-slate-300 mt-1">คลิก + เพื่อเพิ่มสินค้า</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center space-x-3 bg-slate-50 rounded-xl p-3">
                <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    ฿{item.salePrice.toLocaleString()} / {item.unit}
                    {(item.color || item.size) && (
                      <span className="ml-1">
                        {item.color && ` · ${item.color}`}{item.color && item.size && ' · '}{item.size && `${item.size}`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-semibold w-5 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">
                    <Plus size={14} />
                  </button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-5 border-t border-slate-100 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">รวม {cartItems} ชิ้น</span>
            <span className="font-bold text-2xl text-slate-800">฿{cartTotal.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center space-x-2"
          >
            <CreditCard size={18} />
            <span>ชำระเงิน</span>
          </button>
        </div>
      </div>

      {/* Mobile Cart Sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-3xl h-[calc(100vh-4rem)] flex flex-col animate-slide-up">
            {/* Fixed Header */}
            <div className="flex-shrink-0 flex flex-col p-5 border-b border-slate-100 bg-white rounded-t-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">ตะกร้าสินค้า</h2>
                  <p className="text-xs text-slate-400">{cartItems} รายการ</p>
                </div>
                <div className="flex items-center space-x-3">
                  {cart.length > 0 && (
                    <button onClick={clearActiveCart} className="text-sm text-red-400">ล้าง</button>
                  )}
                  <button onClick={() => setShowCart(false)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
              </div>
              {/* Cart Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {carts.map(c => {
                  const itemCount = c.items.reduce((sum, i) => sum + i.qty, 0)
                  const isActive = c.id === activeCartId
                  return (
                    <div key={c.id} className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer select-none ${isActive ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      <button onClick={() => switchCart(c.id)} className="flex items-center gap-1.5">
                        {c.name}
                        {itemCount > 0 && (
                          <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {itemCount}
                          </span>
                        )}
                      </button>
                      {carts.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); closeCart(c.id) }} className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center ${isActive ? 'hover:bg-white/20' : 'hover:bg-slate-200'}`}>
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  )
                })}
                <button onClick={createNewCart} className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingCart size={48} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center space-x-3 bg-slate-50 rounded-xl p-3">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Store size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        ฿{item.salePrice.toLocaleString()} / {item.unit}
                        {(item.color || item.size) && (
                          <span className="ml-1">
                            {item.color && ` · ${item.color}`}{item.color && item.size && ' · '}{item.size && `${item.size}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {/* Fixed Footer */}
            <div className="flex-shrink-0 p-5 border-t border-slate-100 space-y-4 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">รวมทั้งหมด</span>
                <span className="font-bold text-3xl text-slate-800">฿{cartTotal.toLocaleString()}</span>
              </div>
              <button
                onClick={() => { setShowCart(false); setShowPayment(true) }}
                disabled={cart.length === 0}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center space-x-2 text-lg"
              >
                <CreditCard size={20} />
                <span>ชำระเงิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-sm animate-slide-up h-[100dvh] flex flex-col">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <p className="text-sm text-slate-400">ยอดรวมที่ต้องชำระ</p>
                <p className="text-4xl font-bold text-primary-600 mt-2">฿{cartTotal.toLocaleString()}</p>
              </div>

              {/* Payment Method Selector */}
            <div className="space-y-2 mb-6">
              {/* Cash */}
              <button
                onClick={() => { setPaymentMethod('cash'); setSelectedBankAccount(null); }}
                className={`w-full flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>
                  <Banknote size={24} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800">เงินสด</p>
                  <p className="text-xs text-slate-400">ชำระด้วยเงินสดหน้าร้าน</p>
                </div>
              </button>

              {/* PromptPay (separate from banks) */}
              {shopBankAccounts.filter(a => a.type === 'promptpay').map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setPaymentMethod('transfer'); setSelectedBankAccount(acc); }}
                  className={`w-full flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>
                    <QrCode size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">PromptPay / QR Code</p>
                    <p className="text-xs text-slate-400">{acc.name}</p>
                  </div>
                </button>
              ))}

              {/* Bank Accounts */}
              {shopBankAccounts.filter(a => a.type === 'bank').map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setPaymentMethod('transfer'); setSelectedBankAccount(acc); }}
                  className={`w-full flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${paymentMethod === 'transfer' && selectedBankAccount?.id === acc.id ? 'bg-blue-500 text-white' : 'bg-white text-slate-400'}`}>
                    <Building2 size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">{acc.name}</p>
                    <p className="text-xs text-slate-400">{acc.bankName}</p>
                  </div>
                </button>
              ))}

              {shopBankAccounts.length === 0 && (
                <div className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-center text-sm text-slate-400">
                  ยังไม่มีบัญชีรับเงิน
                </div>
              )}
            </div>

            {/* ─── Discount (All Payment Methods) ─── */}
            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">ส่วนลด</p>
                <div className="flex space-x-2 mb-3">
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${discountType === 'amount' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    จำนวนเงิน
                  </button>
                  <button
                    onClick={() => setDiscountType('percent')}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${discountType === 'percent' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    เปอร์เซ็นต์
                  </button>
                </div>
                <div className="relative">
                  <input
                    ref={discountInputRef}
                    type="number"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percent' ? 'เช่น 10 = 10%' : 'เช่น 50'}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm font-medium"
                  />
                  {discountValue !== '' && (
                    <button
                      type="button"
                      onClick={() => { setDiscountValue(''); discountInputRef.current?.focus() }}
                      className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    {discountType === 'percent' ? '%' : '฿'}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ยอดรวม</span>
                  <span className="font-medium text-slate-700">฿{cartTotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">ส่วนลด</span>
                    <span className="font-medium text-red-500">-฿{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2.5">
                  <span className="text-slate-800">ยอดสุทธิ</span>
                  <span className="text-primary-600">฿{finalTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Cash-specific: Received & Change */}
              {paymentMethod === 'cash' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">เงินที่รับมา</label>
                    <div className="relative">
                      <input
                        ref={receivedInputRef}
                        type="number"
                        value={receivedAmount}
                        onChange={e => setReceivedAmount(e.target.value)}
                        placeholder="กรอกจำนวนเงิน"
                        className="w-full px-4 py-3 pr-10 rounded-xl border-2 border-slate-200 focus:border-primary-500 outline-none text-lg font-bold text-center text-slate-800"
                      />
                      {receivedAmount !== '' && (
                        <button
                          type="button"
                          onClick={() => { setReceivedAmount(''); receivedInputRef.current?.focus() }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {/* Quick amount buttons */}
                    <div className="flex space-x-2 mt-2">
                      {[100, 500, 1000].map(amt => (
                        <button
                          key={amt}
                          onClick={() => setReceivedAmount(String(amt))}
                          className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors"
                        >
                          ฿{amt.toLocaleString()}
                        </button>
                      ))}
                      <button
                        onClick={() => setReceivedAmount(String(finalTotal))}
                        className="flex-1 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-xs font-medium text-primary-700 transition-colors"
                      >
                        พอดี
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-2xl p-4 text-center ${change >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-sm text-slate-500 mb-1">เงินทอน</p>
                    <p className={`text-2xl font-bold ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      ฿{Math.abs(change).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ─── PromptPay QR ─── */}
            {paymentMethod === 'transfer' && selectedBankAccount?.type === 'promptpay' && qrUrl && (
              <div className="mb-6 flex flex-col items-center">
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4">
                  <img src={qrUrl} alt="PromptPay QR" className="w-56 h-56" />
                </div>
                <p className="text-sm text-slate-500 mt-3 text-center">
                  สแกนด้วยแอปธนาคารเพื่อโอนเงิน<br />
                  <span className="text-xs text-slate-400">{selectedBankAccount.name} · {selectedBankAccount.accountNo}</span>
                </p>
              </div>
            )}
            {paymentMethod === 'transfer' && selectedBankAccount?.type === 'promptpay' && !qrUrl && (
              <div className="mb-6 text-center text-sm text-red-400">
                ไม่สามารถสร้าง QR Code ได้ (ตรวจสอบเบอร์ PromptPay)
              </div>
            )}

            {/* ─── Bank Transfer Details ─── */}
            {paymentMethod === 'transfer' && selectedBankAccount?.type === 'bank' && (
              <div className="mb-6 bg-blue-50 rounded-2xl p-5 space-y-3">
                <p className="text-sm font-semibold text-blue-800 text-center">โอนเงินผ่านธนาคาร</p>
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-500">{selectedBankAccount.bankName}</p>
                  <p className="text-xl md:text-2xl font-bold text-slate-800 font-mono tracking-wider whitespace-nowrap">{selectedBankAccount.accountNo}</p>
                  <p className="text-sm text-slate-600">{selectedBankAccount.accountHolder}</p>
                </div>
                <div className="flex justify-between text-xs text-slate-400 border-t border-blue-100 pt-3">
                  <span>ชื่อบัญชี</span>
                  <span>{selectedBankAccount.accountHolder}</span>
                </div>
              </div>
            )}

            </div>

            {/* Fixed Actions Footer */}
            <div className="shrink-0 px-4 py-2 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowPayment(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleCheckout(false)}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm"
                >
                  ยืนยันชำระเงิน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="shrink-0 flex items-center justify-between p-4 bg-black/50">
            <h3 className="text-white font-bold text-lg">สแกนบาร์โค้ด / QR Code</h3>
            <button onClick={() => { setShowScanner(false); setScannedGlobal(null); setGlobalPrice(''); setGlobalStock(''); setScanMsg('') }} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
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
                  onChange={(e) => {
                    setScanMsg('ถ่ายรูปแล้ว กรุณากรอกบาร์โค้ดด้านล่าง')
                  }}
                />
                <div className="w-full py-3 rounded-xl bg-white/20 text-white text-center text-sm font-medium">ถ่ายรูปบาร์โค้ด</div>
              </label>
            )}
            <div className="flex space-x-2">
              <input
                id="manual-barcode"
                type="text"
                placeholder="กรอกบาร์โค้ดเอง"
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/50 outline-none text-sm"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const code = e.target.value
                    const product = allProducts.find(p => p.barcode === code)
                    if (product && product.stock > 0) {
                      addToCart(product)
                      const variantLabel = [product.color, product.size].filter(Boolean).join(', ')
                      setScanMsg(`+ ${product.name}${variantLabel ? ` (${variantLabel})` : ''}`)
                      playBeep()
                      if (navigator.vibrate) navigator.vibrate(150)
                    } else if (product) {
                      setScanMsg(`${product.name} หมดสต็อก`)
                    } else {
                      const globalProd = await productService.getByBarcode(code)
                      if (globalProd && isStandardBarcode(code)) {
                        setScannedGlobal(globalProd)
                        setGlobalPrice('')
                        setGlobalStock('')
                        setScanMsg(`เจอในคลังกลาง: ${globalProd.name}`)
                        playBeep()
                        if (navigator.vibrate) navigator.vibrate(150)
                      } else {
                        setScanMsg('ไม่พบสินค้าในระบบ')
                      }
                    }
                    e.target.value = ''
                  }
                }}
              />
            </div>

            {/* Global Product Quick Add */}
            {scannedGlobal && (
              <div className="bg-white/10 rounded-xl p-4 space-y-3">
                <div className="text-center">
                  <p className="text-xs text-white/60">สินค้าจากคลังกลาง</p>
                  <p className="text-white font-semibold">{scannedGlobal.name}</p>
                  <p className="text-xs text-white/50">{scannedGlobal.barcode} · {scannedGlobal.category} · {scannedGlobal.unit}</p>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="ราคาขาย"
                    value={globalPrice}
                    onChange={e => setGlobalPrice(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/50 outline-none text-sm"
                  />
                  <input
                    type="number"
                    placeholder="สต็อกเริ่มต้น"
                    value={globalStock}
                    onChange={e => setGlobalStock(e.target.value)}
                    className="w-28 px-3 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/50 outline-none text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (!user?.shopId || !user?.branchId) {
                        alert('ไม่พบข้อมูลร้านค้าหรือสาขา กรุณาออกจากระบบและเข้าสู่ระบบใหม่')
                        return
                      }
                      const price = parseFloat(globalPrice)
                      if (!price || price <= 0) return
                      try {
                        const newSp = await shopProductService.create({
                          shopId: user.shopId,
                          branchId: user.branchId,
                          productId: scannedGlobal.id,
                          salePrice: price,
                          costPrice: 0,
                          stock: Number(globalStock) || 9999,
                          minStock: 5,
                          isStandard: true,
                        })
                        const data = await shopProductService.getByBranch(user.branchId)
                        setAllProducts(data || [])
                        const merged = data.find(p => p.id === newSp.id)
                        if (merged) addToCart(merged)
                        setScanMsg(`+ ${scannedGlobal.name} ฿${price}`)
                        setScannedGlobal(null)
                        setGlobalPrice('')
                        setGlobalStock('')
                        playBeep()
                        if (navigator.vibrate) navigator.vibrate(150)
                      } catch (err) {
                        console.error('import error:', err)
                        setScanMsg('นำเข้าไม่สำเร็จ: ' + err.message)
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium"
                  >
                    นำเข้าและเพิ่ม
                  </button>
                  <button
                    onClick={() => { setScannedGlobal(null); setGlobalPrice(''); setGlobalStock('') }}
                    className="px-3 py-2.5 rounded-xl bg-white/10 text-white text-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            <p className="text-white/50 text-xs text-center">วางบาร์โค้ดให้อยู่ในกรอบ สแกนต่อเนื่องได้จนกว่าจะกดปิด</p>
          </div>
        </div>
      )}

      {/* Recipe Ingredient Warning Modal */}
      {showRecipeWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-amber-700 flex items-center gap-2">
                <AlertTriangle size={20} />
                วัตถุดิบไม่พอ
              </h2>
              <button onClick={() => setShowRecipeWarning(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {recipeShortages.map((s, i) => (
                <div key={i} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <p className="text-sm font-medium text-slate-800">{s.dish}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    ขาด {s.ingredient} {s.required.toFixed(2)} {s.unit}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowRecipeWarning(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setShowRecipeWarning(false)
                  handleCheckout(true)
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm"
              >
                ขายต่อ (ติดลบ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low Ingredient List Modal */}
      {showLowIngredientList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowLowIngredientList(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={20} className="text-amber-600" />
                <h2 className="text-lg font-bold text-slate-800">วัตถุดิบใกล้หมด</h2>
              </div>
              <button onClick={() => setShowLowIngredientList(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-2">
              {lowIngredients.map(ing => (
                <div key={ing.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{ing.name}</p>
                    <p className="text-xs text-slate-400">ขั้นต่ำ: {ing.minStock} {ing.unit}</p>
                  </div>
                  <span className={`text-sm font-bold ${ing.stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {ing.stock} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">ไปที่หน้า "จัดการสต็อก" เพื่อรับสินค้าเข้า</p>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">ชำระเงินสำเร็จ!</h2>
              <p className="text-sm text-slate-400 mt-1">ใบเสร็จ #{lastSale.id.slice(-6)}</p>
            </div>
            {/* Item list */}
            {Array.isArray(lastSale.items) && lastSale.items.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">รายการสินค้า</p>
                {lastSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.qty} × ฿{(item.salePrice || 0).toLocaleString()}</p>
                    </div>
                    <span className="font-medium text-slate-800 shrink-0">฿{((item.salePrice || 0) * (item.qty || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-slate-50 rounded-2xl p-5 mb-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">จำนวนรายการ</span>
                <span className="font-medium text-slate-800">{Array.isArray(lastSale.items) ? lastSale.items.reduce((s, i) => s + (i.qty || 0), 0) : (lastSale.items || 0)} ชิ้น</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">วิธีชำระเงิน</span>
                <span className="font-medium text-slate-800">
                  {lastSale.paymentMethod === 'cash' ? 'เงินสด' : (lastSale.paymentMethod === 'transfer' ? 'โอนเงิน / PromptPay' : lastSale.paymentMethod)}
                </span>
              </div>
              {lastSale.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ส่วนลด</span>
                  <span className="font-medium text-red-500">-฿{lastSale.discount.toLocaleString()}</span>
                </div>
              )}
              {lastSale.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">รับเงินมา</span>
                    <span className="font-medium text-slate-800">฿{lastSale.received.toLocaleString()}</span>
                  </div>
                  {lastSale.change > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">เงินทอน</span>
                      <span className="font-medium text-emerald-600">฿{lastSale.change.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
              <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                <span className="font-semibold text-slate-800">ยอดรวม</span>
                <span className="font-bold text-primary-600 text-2xl">฿{lastSale.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => printReceipt(lastSale, shop)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-2xl text-sm flex items-center justify-center space-x-2"
              >
                <Printer size={16} />
                <span>พิมพ์</span>
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-[2] bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-2xl text-lg"
              >
                ขายต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Open a printable receipt window for thermal printers (58/80mm)
function printReceipt(sale, shop) {
  const date = new Date(sale.createdAt || Date.now())
  const dateStr = date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
  const itemsHtml = Array.isArray(sale.items) ? sale.items.map(i => `
    <tr>
      <td style="padding:2px 0">${escapeHtml(i.name)}<br><span style="color:#666;font-size:10px">${i.qty} × ฿${(i.salePrice || 0).toLocaleString()}</span></td>
      <td style="padding:2px 0;text-align:right;vertical-align:top">฿${((i.salePrice || 0) * (i.qty || 0)).toLocaleString()}</td>
    </tr>`).join('') : ''
  const itemCount = Array.isArray(sale.items) ? sale.items.reduce((s, i) => s + (i.qty || 0), 0) : 0
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบเสร็จ #${sale.id.slice(-6)}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: 'Sarabun', 'Tahoma', sans-serif; width: 72mm; margin: 0; color: #000; font-size: 12px; }
      h1 { font-size: 14px; margin: 4px 0; text-align: center; }
      .center { text-align: center; }
      .muted { color: #666; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; }
      hr { border: none; border-top: 1px dashed #999; margin: 6px 0; }
      .total { font-size: 16px; font-weight: bold; }
      @media print { button { display: none; } }
    </style></head><body>
    <h1>${escapeHtml(shop?.name || 'ร้านค้า')}</h1>
    <div class="center muted">${escapeHtml(shop?.address || '')}</div>
    ${shop?.phone ? `<div class="center muted">โทร: ${escapeHtml(shop.phone)}</div>` : ''}
    <hr>
    <div class="muted">เลขที่: #${sale.id.slice(-6)}</div>
    <div class="muted">วันที่: ${dateStr}</div>
    <hr>
    <table>${itemsHtml}</table>
    <hr>
    <table>
      <tr><td>รายการรวม</td><td style="text-align:right">${itemCount} ชิ้น</td></tr>
      ${sale.discount > 0 ? `<tr><td>ส่วนลด</td><td style="text-align:right">-฿${sale.discount.toLocaleString()}</td></tr>` : ''}
      <tr class="total"><td>ยอดสุทธิ</td><td style="text-align:right">฿${sale.total.toLocaleString()}</td></tr>
      ${sale.paymentMethod === 'cash' ? `
        <tr><td>รับเงิน</td><td style="text-align:right">฿${(sale.received || 0).toLocaleString()}</td></tr>
        <tr><td>เงินทอน</td><td style="text-align:right">฿${(sale.change || 0).toLocaleString()}</td></tr>
      ` : `<tr><td colspan="2" class="center">ชำระโดย ${sale.paymentMethod === 'transfer' ? 'โอนเงิน / PromptPay' : sale.paymentMethod}</td></tr>`}
    </table>
    <hr>
    <div class="center muted">ขอบคุณที่ใช้บริการ</div>
    <div style="text-align:center; margin-top:10px">
      <button onclick="window.print()" style="padding:6px 12px;font-size:12px">พิมพ์</button>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
    </body></html>`
  const w = window.open('', '_blank', 'width=400,height=600')
  if (!w) { alert('กรุณาอนุญาต popup เพื่อพิมพ์ใบเสร็จ'); return }
  w.document.write(html)
  w.document.close()
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
