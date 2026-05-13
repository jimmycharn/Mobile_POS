import { useState, useEffect, useMemo } from 'react'
import { Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, Receipt, X, ScanBarcode, Store, QrCode, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopProductService, saleService, cartService, getStats, authService, shopService } from '../services/mockData'

export default function PosPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [lastSale, setLastSale] = useState(null)
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, totalProducts: 0 })
  const [activeCategory, setActiveCategory] = useState('all')
  const [shop, setShop] = useState(null)

  useEffect(() => {
    if (user?.shopId) {
      setStats(getStats(user.shopId))
      setShop(shopService.getById(user.shopId))
    }
    const savedCart = cartService.get()
    if (savedCart) setCart(savedCart)
  }, [user])

  useEffect(() => {
    cartService.set(cart)
  }, [cart])

  const allProducts = useMemo(() => {
    if (!user?.shopId) return []
    return shopProductService.getByShop(user.shopId)
  }, [user])

  const categories = useMemo(() => {
    const cats = [...new Set(allProducts.map(p => p.category))]
    return ['all', ...cats]
  }, [allProducts])

  const products = useMemo(() => {
    let list = allProducts
    if (search.trim()) {
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
    }
    if (activeCategory !== 'all') {
      list = list.filter(p => p.category === activeCategory)
    }
    return list
  }, [allProducts, search, activeCategory])

  const addToCart = (product) => {
    if (product.stock <= 0) return
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) return prev
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item
      const newQty = Math.max(1, Math.min(item.qty + delta, item.stock))
      return { ...item, qty: newQty }
    }))
  }

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.salePrice * item.qty, 0)
  const cartItems = cart.reduce((sum, item) => sum + item.qty, 0)

  const handleCheckout = () => {
    if (cart.length === 0) return

    const sale = saleService.create({
      shopId: user.shopId,
      items: cartItems,
      total: cartTotal,
      paymentMethod,
      createdBy: user.id,
      cartDetails: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.salePrice })),
    })

    cart.forEach(item => {
      const sp = shopProductService.getById(item.id)
      if (sp) {
        shopProductService.update(item.id, { stock: sp.stock - item.qty })
      }
    })

    authService.logActivity(user.id, user.shopId, 'SALE', `ขายสินค้า ${cartItems} รายการ ยอดรวม ฿${cartTotal.toLocaleString()}`)

    setLastSale(sale)
    setCart([])
    setShowPayment(false)
    setShowReceipt(true)
    setStats(getStats(user.shopId))
  }

  const catLabel = (cat) => {
    if (cat === 'all') return 'ทั้งหมด'
    return cat
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-white w-full max-w-full overflow-x-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative w-full">

        {/* Top Banner - Shop Info (Mobile + Desktop unified style) */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white px-4 pt-4 pb-6 safe-top rounded-b-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Store size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{shop?.name || 'ร้านค้า'}</h1>
                <p className="text-xs text-primary-100">ยอดขายวันนี้: ฿{stats.todayRevenue.toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center md:hidden"
            >
              <ShoppingCart size={20} />
              {cartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-400 text-primary-800 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartItems}
                </span>
              )}
            </button>
          </div>

          {/* Scan Barcode Banner */}
          <button
            onClick={() => { alert('สแกนบาร์โค้ด / QR Code (จำลอง)'); setSearch('88512345600' + Math.floor(Math.random() * 9) + 1) }}
            className="w-full flex items-center justify-between bg-white/20 backdrop-blur rounded-xl px-4 py-3 active:bg-white/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                <ScanBarcode size={22} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">สแกนบาร์โค้ด / QR Code</p>
                <p className="text-xs text-primary-100">กดเพื่อสแกนสินค้า</p>
              </div>
            </div>
            <QrCode size={24} className="text-white/70" />
          </button>
        </div>

        {/* Search + Category Tabs */}
        <div className="px-4 -mt-3 z-10">
          <div className="bg-white rounded-2xl shadow-md shadow-slate-200/50 p-3">
            {/* Search */}
            <div className="relative mb-3">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาสินค้า..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-primary-300 outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Category Scroll - horizontal strip, only this row scrolls */}
        <div className="mt-3 w-full overflow-x-auto overscroll-x-contain no-scrollbar">
          <div className="flex space-x-2 w-max px-4 pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                    : 'bg-white border border-slate-100 text-slate-600'
                }`}
              >
                {catLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-24 no-scrollbar">
          <h3 className="text-sm font-semibold text-slate-500 mb-2 px-1">
            {activeCategory === 'all' ? 'เมนูทั้งหมด' : catLabel(activeCategory)}
            <span className="font-normal text-slate-400 ml-1">({products.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {products.map(product => {
              const inCart = cart.find(c => c.id === product.id)
              const isLowStock = product.stock <= product.minStock
              const isOut = product.stock <= 0
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                    isOut ? 'border-slate-100 opacity-60' : 'border-slate-100 shadow-sm'
                  }`}
                >
                  {/* Product Image Area */}
                  <div className="relative bg-slate-100 h-28 flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/60 rounded-xl flex items-center justify-center">
                      <Store size={24} className="text-slate-300" />
                    </div>
                    {isOut && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <span className="px-3 py-1 bg-black/60 text-white text-xs font-medium rounded-full">หมด</span>
                      </div>
                    )}
                    {isLowStock && !isOut && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-400 text-white text-[10px] font-bold rounded-md">ใกล้หมด</span>
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
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold text-primary-600">฿{product.salePrice.toLocaleString()}</span>
                      <span className="text-xs text-slate-400">{product.stock} {product.unit}</span>
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

        {/* Bottom Cart Bar (Mobile) - hidden when empty */}
        {cartItems > 0 && (
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
      <div className="hidden md:flex flex-col w-[380px] bg-white border-l border-slate-100 h-screen sticky top-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center space-x-2">
            <ShoppingCart size={20} className="text-primary-600" />
            <span>รายการ ({cartItems})</span>
          </h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600">ล้าง</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า</p>
              <p className="text-xs text-slate-300 mt-1">คลิก + เพื่อเพิ่มสินค้า</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center space-x-3 bg-slate-50 rounded-xl p-3">
                <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                  <Store size={18} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">฿{item.salePrice.toLocaleString()} / {item.unit}</p>
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
        <div className="p-5 border-t border-slate-100 space-y-4">
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
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[92vh] mb-2 flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">ตะกร้าสินค้า</h2>
                <p className="text-xs text-slate-400">{cartItems} รายการ</p>
              </div>
              <div className="flex items-center space-x-3">
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-sm text-red-400">ล้าง</button>
                )}
                <button onClick={() => setShowCart(false)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingCart size={48} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center space-x-3 bg-slate-50 rounded-xl p-3">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center shrink-0">
                      <Store size={20} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">฿{item.salePrice.toLocaleString()} / {item.unit}</p>
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
            <div className="p-5 pb-8 border-t border-slate-100 safe-bottom space-y-4 bg-white">
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
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="text-center mb-6">
              <p className="text-sm text-slate-400">ยอดรวมที่ต้องชำระ</p>
              <p className="text-4xl font-bold text-primary-600 mt-2">฿{cartTotal.toLocaleString()}</p>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`w-full flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50'
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

              <button
                onClick={() => setPaymentMethod('transfer')}
                className={`w-full flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'transfer' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${paymentMethod === 'transfer' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>
                  <QrCode size={24} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800">PromptPay / QR Code</p>
                  <p className="text-xs text-slate-400">โอนเงินผ่าน QR Code</p>
                </div>
              </button>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCheckout}
                className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
              >
                ยืนยันชำระเงิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">ชำระเงินสำเร็จ!</h2>
              <p className="text-sm text-slate-400 mt-1">ใบเสร็จ #{lastSale.id.slice(-6)}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">จำนวนรายการ</span>
                <span className="font-medium text-slate-800">{lastSale.items} ชิ้น</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">วิธีชำระเงิน</span>
                <span className="font-medium text-slate-800">{lastSale.paymentMethod === 'cash' ? 'เงินสด' : 'PromptPay'}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                <span className="font-semibold text-slate-800">ยอดรวม</span>
                <span className="font-bold text-primary-600 text-2xl">฿{lastSale.total.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setShowReceipt(false)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl text-lg"
            >
              ขายต่อ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
