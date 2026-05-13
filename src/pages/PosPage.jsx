import { useState, useEffect, useMemo } from 'react'
import { Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, Receipt, X, ChevronRight, Package } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopProductService, saleService, cartService, getStats, authService } from '../services/mockData'

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

  const products = useMemo(() => {
    if (!user?.shopId) return []
    if (!search.trim()) return shopProductService.getByShop(user.shopId)
    return shopProductService.search(user.shopId, search)
  }, [search, user])

  useEffect(() => {
    if (user?.shopId) {
      setStats(getStats(user.shopId))
    }
    const savedCart = cartService.get()
    if (savedCart) setCart(savedCart)
  }, [user])

  useEffect(() => {
    cartService.set(cart)
  }, [cart])

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

    // Update stock
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

  const categories = [...new Set(products.map(p => p.category))]

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header Mobile */}
        <div className="md:hidden bg-white border-b border-slate-100 px-4 py-3 safe-top">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-800">ขายหน้าร้าน</h1>
              <p className="text-xs text-slate-400">วันนี้: ฿{stats.todayRevenue.toLocaleString()} · {stats.todayOrders} ออเดอร์</p>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center"
            >
              <ShoppingCart size={20} className="text-primary-600" />
              {cartItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartItems}
                </span>
              )}
            </button>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้าหรือบาร์โค้ด..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ขายหน้าร้าน</h1>
            <p className="text-sm text-slate-400">วันนี้: ฿{stats.todayRevenue.toLocaleString()} · {stats.todayOrders} ออเดอร์</p>
          </div>
          <div className="relative w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้าหรือบาร์โค้ด..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          {categories.map(cat => (
            <div key={cat} className="mb-6">
              <h3 className="text-sm font-semibold text-slate-500 mb-3 px-1">{cat}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {products.filter(p => p.category === cat).map(product => {
                  const inCart = cart.find(c => c.id === product.id)
                  const isLowStock = product.stock <= product.minStock
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                      className={`relative bg-white rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                        product.stock <= 0
                          ? 'border-slate-100 opacity-50'
                          : inCart
                          ? 'border-primary-300 ring-1 ring-primary-200 shadow-sm'
                          : 'border-slate-100 hover:border-slate-200 shadow-sm'
                      }`}
                    >
                      {isLowStock && product.stock > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 rounded-full"></span>
                      )}
                      {inCart && (
                        <span className="absolute top-2 right-2 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {inCart.qty}
                        </span>
                      )}
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-2">
                        <Package size={18} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-800 line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-primary-600">฿{product.salePrice.toLocaleString()}</span>
                        <span className={`text-xs ${product.stock <= 0 ? 'text-red-400' : isLowStock ? 'text-amber-500' : 'text-slate-400'}`}>
                          {product.stock <= 0 ? 'หมด' : `${product.stock} ${product.unit}`}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="text-center py-12">
              <Package size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่พบสินค้า</p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart Sidebar */}
      <div className="hidden md:flex flex-col w-96 bg-white border-l border-slate-200 h-screen sticky top-0">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center space-x-2">
            <ShoppingCart size={20} className="text-primary-600" />
            <span>รายการ ({cartItems})</span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart size={40} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center space-x-3 bg-slate-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">฿{item.salePrice.toLocaleString()} / {item.unit}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-600">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-600">
                    <Plus size={14} />
                  </button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-5 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">รวม {cartItems} ชิ้น</span>
            <span className="font-bold text-xl text-slate-800">฿{cartTotal.toLocaleString()}</span>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">รายการสินค้า ({cartItems})</h2>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart size={40} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center space-x-3 bg-slate-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">฿{item.salePrice.toLocaleString()} / {item.unit}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-100 safe-bottom space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">รวมทั้งหมด</span>
                <span className="font-bold text-2xl text-slate-800">฿{cartTotal.toLocaleString()}</span>
              </div>
              <button
                onClick={() => { setShowCart(false); setShowPayment(true) }}
                disabled={cart.length === 0}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <CreditCard size={18} />
                <span>ชำระเงิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
            <h2 className="text-lg font-bold text-slate-800 mb-4">ชำระเงิน</h2>
            <div className="text-center mb-6">
              <p className="text-sm text-slate-400">ยอดรวมที่ต้องชำระ</p>
              <p className="text-3xl font-bold text-primary-600 mt-1">฿{cartTotal.toLocaleString()}</p>
            </div>
            <div className="space-y-2 mb-6">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`w-full flex items-center space-x-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash' ? 'border-primary-500 bg-primary-50' : 'border-slate-100'
                }`}
              >
                <Banknote size={24} className={paymentMethod === 'cash' ? 'text-primary-600' : 'text-slate-400'} />
                <span className="font-medium text-slate-700">เงินสด</span>
              </button>
              <button
                onClick={() => setPaymentMethod('transfer')}
                className={`w-full flex items-center space-x-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'transfer' ? 'border-primary-500 bg-primary-50' : 'border-slate-100'
                }`}
              >
                <CreditCard size={24} className={paymentMethod === 'transfer' ? 'text-primary-600' : 'text-slate-400'} />
                <span className="font-medium text-slate-700">โอนเงิน / QR Code</span>
              </button>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCheckout}
                className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Receipt size={28} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">ชำระเงินสำเร็จ</h2>
              <p className="text-sm text-slate-400">ใบเสร็จเลขที่ {lastSale.id}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">จำนวนรายการ</span>
                <span className="font-medium">{lastSale.items} ชิ้น</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">วิธีชำระเงิน</span>
                <span className="font-medium">{lastSale.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน'}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="font-semibold">ยอดรวม</span>
                <span className="font-bold text-primary-600 text-lg">฿{lastSale.total.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setShowReceipt(false)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl"
            >
              ขายต่อ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
