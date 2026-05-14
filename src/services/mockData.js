// Mock Database Layer - simulates Supabase tables
// Uses localStorage for persistence

const DB_KEYS = {
  USERS: 'pos_users',
  SHOPS: 'pos_shops',
  BRANCHES: 'pos_branches',
  PRODUCTS: 'pos_products',
  SHOP_PRODUCTS: 'pos_shop_products',
  SALES: 'pos_sales',
  INVENTORY: 'pos_inventory',
  ACTIVITY_LOGS: 'pos_activity_logs',
  PACKAGES: 'pos_packages',
  CARTS: 'pos_carts',
  ACTIVE_CART: 'pos_active_cart',
}

// Seed initial data if not exists
function seedData() {
  if (!localStorage.getItem(DB_KEYS.PACKAGES)) {
    localStorage.setItem(DB_KEYS.PACKAGES, JSON.stringify([
      { id: 'pkg-1', name: 'Starter', price: 0, maxUsers: 2, maxProducts: 50, features: ['POS ขายหน้าร้าน', 'จัดการสต็อกพื้นฐาน', 'รายงานยอดขาย'] },
      { id: 'pkg-2', name: 'Basic', price: 299, maxUsers: 5, maxProducts: 200, features: ['ทุกอย่างใน Starter', 'จัดการพนักงาน', 'รายงานขั้นสูง', 'ซัพพอร์ตอีเมล'] },
      { id: 'pkg-3', name: 'Pro', price: 599, maxUsers: 15, maxProducts: 1000, features: ['ทุกอย่างใน Basic', 'API เชื่อมต่อ', 'ซัพพอร์ตโทรศัพท์', 'ระบบสาขา'] },
      { id: 'pkg-4', name: 'Enterprise', price: 1299, maxUsers: 999, maxProducts: 9999, features: ['ทุกอย่างใน Pro', 'Dedicated Support', 'Custom Integration', 'On-premise Option'] },
    ]))
  }

  if (!localStorage.getItem(DB_KEYS.USERS)) {
    const superAdmin = {
      id: 'user-super',
      email: 'superadmin@pos.com',
      password: 'admin123',
      name: 'Super Admin',
      role: 'superadmin',
      shopId: null,
      avatar: null,
      createdAt: new Date().toISOString(),
      isActive: true,
    }
    const shopOwner = {
      id: 'user-owner-1',
      email: 'owner@shop.com',
      password: 'owner123',
      name: 'คุณสมชาย',
      role: 'owner',
      shopId: 'shop-1',
      avatar: null,
      createdAt: new Date().toISOString(),
      isActive: true,
    }
    const shopStaff = {
      id: 'user-staff-1',
      email: 'staff@shop.com',
      password: 'staff123',
      name: 'นางสาวสมหญิง',
      role: 'staff',
      shopId: 'shop-1',
      branchId: 'branch-1',
      avatar: null,
      canManageInventory: true,
      createdAt: new Date().toISOString(),
      isActive: true,
    }
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify([superAdmin, shopOwner, shopStaff]))
  }

  if (!localStorage.getItem(DB_KEYS.SHOPS)) {
    localStorage.setItem(DB_KEYS.SHOPS, JSON.stringify([
      {
        id: 'shop-1',
        name: 'ร้านสมชายมินิมาร์ท',
        email: 'owner@shop.com',
        phone: '081-234-5678',
        address: '123 ถนนสุขุมวิท กรุงเทพฯ',
        packageId: 'pkg-2',
        createdAt: new Date().toISOString(),
        isActive: true,
      }
    ]))
  }

  if (!localStorage.getItem(DB_KEYS.BRANCHES)) {
    localStorage.setItem(DB_KEYS.BRANCHES, JSON.stringify([
      {
        id: 'branch-1',
        shopId: 'shop-1',
        name: 'สาขาสุขุมวิท',
        address: '123 ถนนสุขุมวิท กรุงเทพฯ',
        phone: '081-234-5678',
        isActive: true,
        createdAt: new Date().toISOString(),
      }
    ]))
  }

  if (!localStorage.getItem(DB_KEYS.PRODUCTS)) {
    localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify([
      { id: 'prod-central-1', barcode: '885123456001', name: 'น้ำดื่ม 600ml', category: 'เครื่องดื่ม', unit: 'ขวด', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-2', barcode: '885123456002', name: 'มาม่า รสต้มยำ', category: 'อาหารแห้ง', unit: 'ซอง', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-3', barcode: '885123456003', name: 'ขนมปังแซนวิช', category: 'ขนม/เบเกอรี่', unit: 'ชิ้น', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-4', barcode: '885123456004', name: 'โค้ก 1.25L', category: 'เครื่องดื่ม', unit: 'ขวด', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-5', barcode: '885123456005', name: 'ชาเขียว 500ml', category: 'เครื่องดื่ม', unit: 'ขวด', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-6', barcode: '885123456006', name: 'คุกกี้รสช็อก', category: 'ขนม/เบเกอรี่', unit: 'ห่อ', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-7', barcode: '885123456007', name: 'ทิชชู่กระดาษ', category: 'ของใช้ทั่วไป', unit: 'แพ็ค', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-8', barcode: '885123456008', name: 'ยาสีฟัน', category: 'ของใช้ส่วนตัว', unit: 'หลอด', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-9', barcode: '885123456009', name: 'แปรงสีฟัน', category: 'ของใช้ส่วนตัว', unit: 'ชิ้น', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-10', barcode: '885123456010', name: 'สบู่ก้อน', category: 'ของใช้ส่วนตัว', unit: 'ก้อน', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-11', barcode: '885123456011', name: 'น้ำมันพืช 1L', category: 'อาหารแห้ง', unit: 'ขวด', isStandard: true, createdAt: new Date().toISOString() },
      { id: 'prod-central-12', barcode: '885123456012', name: 'น้ำตาลทราย 1kg', category: 'อาหารแห้ง', unit: 'ถุง', isStandard: true, createdAt: new Date().toISOString() },
    ]))
  }

  if (!localStorage.getItem(DB_KEYS.SHOP_PRODUCTS)) {
    localStorage.setItem(DB_KEYS.SHOP_PRODUCTS, JSON.stringify([
      { id: 'sp-1', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-1', name: 'น้ำดื่ม 600ml', barcode: '885123456001', category: 'เครื่องดื่ม', unit: 'ขวด', costPrice: 5, salePrice: 10, stock: 120, minStock: 20, isStandard: true },
      { id: 'sp-2', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-2', name: 'มาม่า รสต้มยำ', barcode: '885123456002', category: 'อาหารแห้ง', unit: 'ซอง', costPrice: 6, salePrice: 12, stock: 80, minStock: 30, isStandard: true },
      { id: 'sp-3', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-3', name: 'ขนมปังแซนวิช', barcode: '885123456003', category: 'ขนม/เบเกอรี่', unit: 'ชิ้น', costPrice: 15, salePrice: 28, stock: 25, minStock: 10, isStandard: true },
      { id: 'sp-4', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-4', name: 'โค้ก 1.25L', barcode: '885123456004', category: 'เครื่องดื่ม', unit: 'ขวด', costPrice: 18, salePrice: 32, stock: 45, minStock: 15, isStandard: true },
      { id: 'sp-5', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-5', name: 'ชาเขียว 500ml', barcode: '885123456005', category: 'เครื่องดื่ม', unit: 'ขวด', costPrice: 12, salePrice: 20, stock: 60, minStock: 20, isStandard: true },
      { id: 'sp-6', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-6', name: 'คุกกี้รสช็อก', barcode: '885123456006', category: 'ขนม/เบเกอรี่', unit: 'ห่อ', costPrice: 20, salePrice: 35, stock: 40, minStock: 15, isStandard: true },
      { id: 'sp-7', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-7', name: 'ทิชชู่กระดาษ', barcode: '885123456007', category: 'ของใช้ทั่วไป', unit: 'แพ็ค', costPrice: 25, salePrice: 45, stock: 30, minStock: 10, isStandard: true },
      { id: 'sp-8', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-8', name: 'ยาสีฟัน', barcode: '885123456008', category: 'ของใช้ส่วนตัว', unit: 'หลอด', costPrice: 30, salePrice: 55, stock: 18, minStock: 10, isStandard: true },
      { id: 'sp-9', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-9', name: 'แปรงสีฟัน', barcode: '885123456009', category: 'ของใช้ส่วนตัว', unit: 'ชิ้น', costPrice: 15, salePrice: 25, stock: 50, minStock: 15, isStandard: true },
      { id: 'sp-10', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-10', name: 'สบู่ก้อน', barcode: '885123456010', category: 'ของใช้ส่วนตัว', unit: 'ก้อน', costPrice: 8, salePrice: 15, stock: 12, minStock: 15, isStandard: true },
      { id: 'sp-11', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-11', name: 'น้ำมันพืช 1L', barcode: '885123456011', category: 'อาหารแห้ง', unit: 'ขวด', costPrice: 35, salePrice: 55, stock: 22, minStock: 10, isStandard: true },
      { id: 'sp-12', shopId: 'shop-1', branchId: 'branch-1', productId: 'prod-central-12', name: 'น้ำตาลทราย 1kg', barcode: '885123456012', category: 'อาหารแห้ง', unit: 'ถุง', costPrice: 28, salePrice: 42, stock: 35, minStock: 10, isStandard: true },
      // Shop-specific products with color/size variants
      { id: 'sp-13', shopId: 'shop-1', branchId: 'branch-1', productId: null, name: 'เสื้อยืดคอกลม', barcode: 'SHIRT001R', category: 'เสื้อผ้า', unit: 'ตัว', costPrice: 150, salePrice: 290, stock: 25, minStock: 5, isStandard: false, color: 'แดง', size: 'M' },
      { id: 'sp-14', shopId: 'shop-1', branchId: 'branch-1', productId: null, name: 'เสื้อยืดคอกลม', barcode: 'SHIRT001B', category: 'เสื้อผ้า', unit: 'ตัว', costPrice: 150, salePrice: 290, stock: 18, minStock: 5, isStandard: false, color: 'น้ำเงิน', size: 'L' },
      { id: 'sp-15', shopId: 'shop-1', branchId: 'branch-1', productId: null, name: 'เสื้อยืดคอกลม', barcode: 'SHIRT001K', category: 'เสื้อผ้า', unit: 'ตัว', costPrice: 150, salePrice: 290, stock: 30, minStock: 5, isStandard: false, color: 'ดำ', size: 'XL' },
      { id: 'sp-16', shopId: 'shop-1', branchId: 'branch-1', productId: null, name: 'ข้าวเหนียวมะม่วง (เฉพาะร้าน)', barcode: 'SHOP0001', category: 'ขนมไทย', unit: 'จาน', costPrice: 40, salePrice: 80, stock: 8, minStock: 5, isStandard: false },
    ]))
  }

  if (!localStorage.getItem(DB_KEYS.SALES)) {
    const sales = []
    const now = new Date()
    for (let i = 0; i < 30; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const count = Math.floor(Math.random() * 8) + 2
      for (let j = 0; j < count; j++) {
        const items = Math.floor(Math.random() * 4) + 1
        const total = items * (Math.floor(Math.random() * 5) + 1) * 25
        sales.push({
          id: `sale-${i}-${j}`,
          shopId: 'shop-1',
          branchId: 'branch-1',
          items: items,
          total: total,
          paymentMethod: Math.random() > 0.5 ? 'cash' : 'transfer',
          createdAt: date.toISOString(),
          createdBy: Math.random() > 0.3 ? 'user-owner-1' : 'user-staff-1',
        })
      }
    }
    localStorage.setItem(DB_KEYS.SALES, JSON.stringify(sales))
  }

  if (!localStorage.getItem(DB_KEYS.ACTIVITY_LOGS)) {
    localStorage.setItem(DB_KEYS.ACTIVITY_LOGS, JSON.stringify([
      { id: 'log-1', userId: 'user-owner-1', shopId: 'shop-1', action: 'LOGIN', detail: 'เข้าสู่ระบบ', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'log-2', userId: 'user-staff-1', shopId: 'shop-1', action: 'SALE', detail: 'ขายสินค้า รายการ 3 ชิ้น', createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 'log-3', userId: 'user-staff-1', shopId: 'shop-1', action: 'STOCK_IN', detail: 'รับสินค้า น้ำดื่ม 600ml จำนวน 50 ขวด', createdAt: new Date(Date.now() - 10800000).toISOString() },
      { id: 'log-4', userId: 'user-owner-1', shopId: 'shop-1', action: 'EDIT_PRODUCT', detail: 'แก้ไขราคา น้ำดื่ม 600ml เป็น 12 บาท', createdAt: new Date(Date.now() - 86400000).toISOString() },
    ]))
  }
}

seedData()

// Generic CRUD helpers
function getAll(key) {
  return JSON.parse(localStorage.getItem(key) || '[]')
}

function setAll(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function getById(key, id) {
  return getAll(key).find(item => item.id === id)
}

function insert(key, item) {
  const data = getAll(key)
  data.push(item)
  setAll(key, data)
  return item
}

function update(key, id, changes) {
  const data = getAll(key)
  const idx = data.findIndex(item => item.id === id)
  if (idx >= 0) {
    data[idx] = { ...data[idx], ...changes }
    setAll(key, data)
    return data[idx]
  }
  return null
}

function remove(key, id) {
  const data = getAll(key).filter(item => item.id !== id)
  setAll(key, data)
}

// Auth
export const authService = {
  login(email, password) {
    const user = getAll(DB_KEYS.USERS).find(u => u.email === email && u.password === password && u.isActive)
    if (!user) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
    // Remove password before storing in session
    const { password: _, ...safeUser } = user
    sessionStorage.setItem('pos_session', JSON.stringify(safeUser))
    this.logActivity(user.id, user.shopId, 'LOGIN', 'เข้าสู่ระบบ')
    return { user: safeUser }
  },

  logout() {
    const session = JSON.parse(sessionStorage.getItem('pos_session') || 'null')
    if (session) {
      this.logActivity(session.id, session.shopId, 'LOGOUT', 'ออกจากระบบ')
    }
    sessionStorage.removeItem('pos_session')
  },

  getSession() {
    return JSON.parse(sessionStorage.getItem('pos_session') || 'null')
  },

  signup(email, password, name, shopName, phone, packageId) {
    const users = getAll(DB_KEYS.USERS)
    if (users.find(u => u.email === email)) {
      return { error: 'อีเมลนี้ถูกใช้งานแล้ว' }
    }
    const shopId = 'shop-' + Date.now()
    const userId = 'user-' + Date.now()

    const newShop = {
      id: shopId,
      name: shopName,
      email,
      phone: phone || '',
      address: '',
      packageId: packageId || 'pkg-1',
      createdAt: new Date().toISOString(),
      isActive: true,
    }
    insert(DB_KEYS.SHOPS, newShop)

    const newUser = {
      id: userId,
      email,
      password,
      name,
      role: 'owner',
      shopId,
      avatar: null,
      createdAt: new Date().toISOString(),
      isActive: true,
    }
    insert(DB_KEYS.USERS, newUser)

    const { password: _, ...safeUser } = newUser
    sessionStorage.setItem('pos_session', JSON.stringify(safeUser))
    return { user: safeUser }
  },

  logActivity(userId, shopId, action, detail) {
    insert(DB_KEYS.ACTIVITY_LOGS, {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      userId,
      shopId,
      action,
      detail,
      createdAt: new Date().toISOString(),
    })
  },
}

// Users
export const userService = {
  getAll() {
    return getAll(DB_KEYS.USERS).map(u => { const { password, ...safe } = u; return safe })
  },
  getByShop(shopId) {
    return getAll(DB_KEYS.USERS).filter(u => u.shopId === shopId).map(u => { const { password, ...safe } = u; return safe })
  },
  create(user) {
    const users = getAll(DB_KEYS.USERS)
    if (users.find(u => u.email === user.email)) return { error: 'อีเมลซ้ำ' }
    const newUser = { ...user, id: 'user-' + Date.now(), createdAt: new Date().toISOString(), isActive: true }
    insert(DB_KEYS.USERS, newUser)
    const { password, ...safe } = newUser
    return safe
  },
  update(id, changes) {
    return update(DB_KEYS.USERS, id, changes)
  },
  remove(id) {
    remove(DB_KEYS.USERS, id)
  },
}

// Shops
export const shopService = {
  getAll() { return getAll(DB_KEYS.SHOPS) },
  getById(id) { return getById(DB_KEYS.SHOPS, id) },
  create(shop) {
    return insert(DB_KEYS.SHOPS, { ...shop, id: 'shop-' + Date.now(), createdAt: new Date().toISOString(), isActive: true })
  },
  update(id, changes) { return update(DB_KEYS.SHOPS, id, changes) },
  remove(id) { remove(DB_KEYS.SHOPS, id) },
}

// Packages
export const packageService = {
  getAll() { return getAll(DB_KEYS.PACKAGES) },
  getById(id) { return getById(DB_KEYS.PACKAGES, id) },
}

// Products (central warehouse)
export const productService = {
  getAll() { return getAll(DB_KEYS.PRODUCTS) },
  create(product) {
    return insert(DB_KEYS.PRODUCTS, { ...product, id: 'prod-central-' + Date.now(), createdAt: new Date().toISOString() })
  },
  update(id, changes) { return update(DB_KEYS.PRODUCTS, id, changes) },
  remove(id) { remove(DB_KEYS.PRODUCTS, id) },
}

// Branches
export const branchService = {
  getByShop(shopId) { return getAll(DB_KEYS.BRANCHES).filter(b => b.shopId === shopId && b.isActive) },
  getById(id) { return getById(DB_KEYS.BRANCHES, id) },
  create(branch) {
    return insert(DB_KEYS.BRANCHES, { ...branch, id: 'branch-' + Date.now(), createdAt: new Date().toISOString(), isActive: true })
  },
  update(id, changes) { return update(DB_KEYS.BRANCHES, id, changes) },
  remove(id) { remove(DB_KEYS.BRANCHES, id) },
}

// Shop Products (inventory with pricing)
export const shopProductService = {
  getByShop(shopId) { return getAll(DB_KEYS.SHOP_PRODUCTS).filter(p => p.shopId === shopId) },
  getByBranch(branchId) { return getAll(DB_KEYS.SHOP_PRODUCTS).filter(p => p.branchId === branchId) },
  getById(id) { return getById(DB_KEYS.SHOP_PRODUCTS, id) },
  create(sp) {
    return insert(DB_KEYS.SHOP_PRODUCTS, { ...sp, id: 'sp-' + Date.now() })
  },
  update(id, changes) { return update(DB_KEYS.SHOP_PRODUCTS, id, changes) },
  remove(id) { remove(DB_KEYS.SHOP_PRODUCTS, id) },
  search(shopId, query) {
    return this.getByShop(shopId).filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.barcode.includes(query)
    )
  },
}

// Sales
export const saleService = {
  getByShop(shopId) {
    return getAll(DB_KEYS.SALES).filter(s => s.shopId === shopId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },
  getByBranch(branchId) {
    return getAll(DB_KEYS.SALES).filter(s => s.branchId === branchId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },
  getByDateRange(shopId, start, end) {
    return this.getByShop(shopId).filter(s => {
      const d = new Date(s.createdAt)
      return d >= start && d <= end
    })
  },
  create(sale) {
    return insert(DB_KEYS.SALES, { ...sale, id: 'sale-' + Date.now(), createdAt: new Date().toISOString() })
  },
}

// Activity Logs
export const logService = {
  getByShop(shopId) {
    const logs = getAll(DB_KEYS.ACTIVITY_LOGS).filter(l => l.shopId === shopId)
    const users = getAll(DB_KEYS.USERS)
    return logs.map(l => {
      const user = users.find(u => u.id === l.userId)
      return { ...l, userName: user ? user.name : 'ไม่ทราบ' }
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },
  getAll() {
    const logs = getAll(DB_KEYS.ACTIVITY_LOGS)
    const users = getAll(DB_KEYS.USERS)
    const shops = getAll(DB_KEYS.SHOPS)
    return logs.map(l => {
      const user = users.find(u => u.id === l.userId)
      const shop = shops.find(s => s.id === l.shopId)
      return { ...l, userName: user ? user.name : 'ไม่ทราบ', shopName: shop ? shop.name : 'Superadmin' }
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },
}

// Cart (multi-cart for parallel sales, keyed by branch)
const DEFAULT_BRANCH_CARTS = { 'branch-1': [{ id: 'cart-1', name: 'บิล 1', items: [] }] }
const DEFAULT_ACTIVE_CART_IDS = { 'branch-1': 'cart-1' }

export const cartService = {
  getBranchCarts(branchId) {
    const all = JSON.parse(sessionStorage.getItem(DB_KEYS.CARTS) || JSON.stringify(DEFAULT_BRANCH_CARTS))
    return all[branchId] || [{ id: 'cart-1', name: 'บิล 1', items: [] }]
  },
  setBranchCarts(branchId, carts) {
    const all = JSON.parse(sessionStorage.getItem(DB_KEYS.CARTS) || JSON.stringify(DEFAULT_BRANCH_CARTS))
    all[branchId] = carts
    sessionStorage.setItem(DB_KEYS.CARTS, JSON.stringify(all))
  },
  getActiveCartId(branchId) {
    const all = JSON.parse(sessionStorage.getItem(DB_KEYS.ACTIVE_CART) || JSON.stringify(DEFAULT_ACTIVE_CART_IDS))
    return all[branchId] || 'cart-1'
  },
  setActiveCartId(branchId, id) {
    const all = JSON.parse(sessionStorage.getItem(DB_KEYS.ACTIVE_CART) || JSON.stringify(DEFAULT_ACTIVE_CART_IDS))
    all[branchId] = id
    sessionStorage.setItem(DB_KEYS.ACTIVE_CART, JSON.stringify(all))
  },
  clear() {
    sessionStorage.removeItem(DB_KEYS.CARTS)
    sessionStorage.removeItem(DB_KEYS.ACTIVE_CART)
  },
}

export function getStats(shopId, branchId = null) {
  const sales = branchId ? saleService.getByBranch(branchId) : saleService.getByShop(shopId)
  const products = branchId ? shopProductService.getByBranch(branchId) : shopProductService.getByShop(shopId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todaySales = sales.filter(s => new Date(s.createdAt) >= today)

  return {
    totalSales: sales.length,
    todayRevenue: todaySales.reduce((sum, s) => sum + s.total, 0),
    todayOrders: todaySales.length,
    lowStock: products.filter(p => p.stock <= p.minStock).length,
    totalProducts: products.length,
  }
}
