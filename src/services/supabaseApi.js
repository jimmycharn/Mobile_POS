// Supabase API Layer — replaces mockData services
// Mirrors the same API so pages need minimal changes

import { supabase } from '../lib/supabase'

// Helper: camelCase ↔ snake_case
const toSnake = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toSnake)
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    result[snakeKey] = typeof value === 'object' && value !== null ? toSnake(value) : value
  }
  return result
}

const toCamel = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toCamel)
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = typeof value === 'object' && value !== null ? toCamel(value) : value
  }
  return result
}

// ============================================================
// Storage (รูปภาพสินค้า)
// ============================================================
export const storageService = {
  async uploadProductImage(file, shopId) {
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${shopId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })
    if (error) {
      console.error('[storageService.uploadProductImage] error:', error.message)
      throw new Error(error.message)
    }
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(data.path)
    return pub.publicUrl
  },
}

// ============================================================
// Auth
// ============================================================
export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) return { error: 'Profile not found in database' }

    const user = {
      id: data.user.id,
      email: data.user.email,
      name: profile.name,
      role: profile.role,
      shopId: profile.shop_id,
      branchId: profile.branch_id,
      avatar: profile.avatar,
      createdAt: profile.created_at,
      isActive: profile.is_active,
    }

    sessionStorage.setItem('pos_session', JSON.stringify(user))
    return { user }
  },

  async signup(email, password, name, shopName, phone, packageId) {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) return { error: authError.message }
    if (!authData.user) return { error: 'ไม่สามารถสร้างผู้ใช้ได้ (อาจต้องยืนยันอีเมลก่อน)' }

    const userId = authData.user.id

    // 2. Create profile FIRST (shops.owner_id has FK -> profiles.id)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, email, name, role: 'owner' })
    if (profileError) return { error: 'สร้างโปรไฟล์ไม่สำเร็จ: ' + profileError.message }

    // 3. Create shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert({ name: shopName, owner_id: userId, phone, package_id: packageId })
      .select()
      .single()
    if (shopError) return { error: 'สร้างร้านไม่สำเร็จ: ' + shopError.message }

    // 4. Create default branch
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({ shop_id: shop.id, name: 'สาขาหลัก' })
      .select()
      .single()
    if (branchError) return { error: 'สร้างสาขาไม่สำเร็จ: ' + branchError.message }

    // 5. Update profile with shop_id / branch_id
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ shop_id: shop.id, branch_id: branch.id })
      .eq('id', userId)
      .select()
      .single()
    if (updateError) return { error: 'อัปเดตโปรไฟล์ไม่สำเร็จ: ' + updateError.message }

    const user = {
      id: userId,
      email,
      name,
      role: 'owner',
      shopId: shop.id,
      branchId: branch.id,
      createdAt: profile.created_at,
      isActive: true,
    }

    sessionStorage.setItem('pos_session', JSON.stringify(user))
    return { user }
  },

  getSession() {
    const raw = sessionStorage.getItem('pos_session')
    return raw ? JSON.parse(raw) : null
  },

  async logout() {
    await supabase.auth.signOut()
    sessionStorage.removeItem('pos_session')
  },

  async logActivity(action, details = '') {
    const session = this.getSession()
    if (!session) return
    await supabase.from('activity_logs').insert({
      shop_id: session.shopId,
      branch_id: session.branchId,
      user_id: session.id,
      action,
      details,
    })
  },
}

// ============================================================
// Shops
// ============================================================
export const shopService = {
  async getAll() {
    const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getById(id) {
    const { data } = await supabase.from('shops').select('*').eq('id', id).single()
    return toCamel(data)
  },
  async update(id, changes) {
    const { data } = await supabase.from('shops').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
}

// ============================================================
// Branches
// ============================================================
export const branchService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('branches').select('*').eq('shop_id', shopId).order('created_at')
    return toCamel(data) || []
  },
  async getById(id) {
    const { data } = await supabase.from('branches').select('*').eq('id', id).single()
    return toCamel(data)
  },
  async create(branch) {
    const { data, error } = await supabase.from('branches').insert(toSnake(branch)).select()
    if (error) throw new Error(error.message)
    return toCamel(Array.isArray(data) ? data[0] : data)
  },
  async update(id, changes) {
    const { data, error } = await supabase.from('branches').update(toSnake(changes)).eq('id', id).select()
    if (error) throw new Error(error.message)
    return toCamel(Array.isArray(data) ? data[0] : data)
  },
  async remove(id) {
    const { error } = await supabase.from('branches').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

// ============================================================
// Global Products (central warehouse)
// ============================================================
export const productService = {
  async getAll() {
    const { data } = await supabase.from('products').select('*').order('name')
    return toCamel(data) || []
  },
  async getById(id) {
    const { data } = await supabase.from('products').select('*').eq('id', id).single()
    return toCamel(data)
  },
  async create(product) {
    const { data, error } = await supabase.from('products').insert(toSnake(product)).select().single()
    if (error) throw new Error(error.message)
    return toCamel(data)
  },
  async update(id, changes) {
    const { data } = await supabase.from('products').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
  async remove(id) {
    await supabase.from('products').delete().eq('id', id)
  },
  async getByBarcode(barcode) {
    const { data } = await supabase.from('products').select('*').eq('barcode', barcode).maybeSingle()
    return toCamel(data)
  },
}

// ============================================================
// Shop Products (branch inventory)
// ============================================================
// Merge helper: override fields from shop_products, fallback to products
function mergeShopProduct(sp) {
  if (!sp) return null
  // Supabase may return the FK relation as an array; normalize to a single object
  let p = sp.products
  if (Array.isArray(p)) p = p[0] || null
  p = p || {}
  const merged = {
    ...sp,
    name: sp.name || p.name,
    category: sp.category || p.category,
    unit: sp.unit || p.unit,
    imageUrl: sp.imageUrl || p.imageUrl,
    barcode: sp.barcode || p.barcode,
  }
  delete merged.products
  return merged
}

export const shopProductService = {
  async getByShop(shopId) {
    const { data } = await supabase
      .from('shop_products')
      .select(`
        id, shop_id, branch_id, product_id,
        name, category, unit, image_url, barcode,
        cost_price, sale_price, stock, min_stock, color, size, is_standard,
        products:product_id(name, category, unit, image_url, barcode)
      `)
      .eq('shop_id', shopId)
    return (toCamel(data) || []).map(mergeShopProduct)
  },
  async getByBranch(branchId) {
    const { data } = await supabase
      .from('shop_products')
      .select(`
        id, shop_id, branch_id, product_id,
        name, category, unit, image_url, barcode,
        cost_price, sale_price, stock, min_stock, color, size, is_standard,
        products:product_id(name, category, unit, image_url, barcode)
      `)
      .eq('branch_id', branchId)
    return (toCamel(data) || []).map(mergeShopProduct)
  },
  async getById(id) {
    const { data } = await supabase
      .from('shop_products')
      .select(`
        id, shop_id, branch_id, product_id,
        name, category, unit, image_url, barcode,
        cost_price, sale_price, stock, min_stock, color, size, is_standard,
        products:product_id(name, category, unit, image_url, barcode)
      `)
      .eq('id', id)
      .single()
    return mergeShopProduct(toCamel(data))
  },
  async create(sp) {
    const { data, error } = await supabase.from('shop_products').insert(toSnake(sp)).select()
    if (error) throw new Error(error.message)
    return toCamel(Array.isArray(data) ? data[0] : data)
  },
  async update(id, changes) {
    const { data, error } = await supabase.from('shop_products').update(toSnake(changes)).eq('id', id).select()
    if (error) throw new Error(error.message)
    return toCamel(Array.isArray(data) ? data[0] : data)
  },
  async remove(id) {
    await supabase.from('shop_products').delete().eq('id', id)
  },
  async search(shopId, query) {
    const { data } = await supabase
      .from('shop_products')
      .select(`
        id, shop_id, branch_id, product_id,
        name, category, unit, image_url, barcode,
        cost_price, sale_price, stock, min_stock, color, size, is_standard,
        products:product_id(name, category, unit, image_url, barcode)
      `)
      .eq('shop_id', shopId)
      .or(`name.ilike.%${query}%,products.name.ilike.%${query}%`)
    return (toCamel(data) || []).map(mergeShopProduct)
  },
  async getByBarcode(barcode, branchId) {
    let query = supabase
      .from('shop_products')
      .select(`
        id, shop_id, branch_id, product_id,
        name, category, unit, image_url, barcode,
        cost_price, sale_price, stock, min_stock, color, size, is_standard,
        products:product_id(name, category, unit, image_url, barcode)
      `)
    if (branchId) query = query.eq('branch_id', branchId)
    const { data } = await query
    const results = toCamel(data) || []
    const matched = results.find(sp =>
      (sp.barcode || '') === barcode || (sp.products?.barcode || '') === barcode
    )
    return mergeShopProduct(matched)
  },
}

// ============================================================
// Sales
// ============================================================
export const saleService = {
  async getAll() {
    const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByShop(shopId) {
    const { data } = await supabase.from('sales').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByBranch(branchId) {
    const { data } = await supabase.from('sales').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async create(sale) {
    const { data } = await supabase.from('sales').insert(toSnake(sale)).select().single()
    return toCamel(data)
  },
}

// ============================================================
// Users / Staff
// ============================================================
export const userService = {
  async getAll() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByShop(shopId) {
    const { data } = await supabase.from('profiles').select('*').eq('shop_id', shopId).neq('role', 'owner')
    return toCamel(data) || []
  },
  async create(user) {
    // 1. Create auth user for staff (email confirmation required by default, owner session stays intact)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
    })
    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error('ไม่สามารถสร้างผู้ใช้พนักงานได้')

    const staffId = authData.user.id

    // 2. Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: staffId,
        email: user.email,
        name: user.name,
        role: 'staff',
        shop_id: user.shopId,
        branch_id: user.branchId,
      })
      .select()
      .single()
    if (profileError) throw new Error('สร้างโปรไฟล์พนักงานไม่สำเร็จ: ' + profileError.message)

    return toCamel(profile)
  },
  async update(id, changes) {
    const { data } = await supabase.from('profiles').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
  async remove(id) {
    await supabase.from('profiles').delete().eq('id', id)
  },
}

// ============================================================
// Packages
// ============================================================
export const packageService = {
  async getAll() {
    const { data } = await supabase.from('packages').select('*').order('price')
    return toCamel(data) || []
  },
  async getById(id) {
    const { data } = await supabase.from('packages').select('*').eq('id', id).single()
    return toCamel(data)
  },
}

// ============================================================
// Activity Logs
// ============================================================
export const logService = {
  async getAll() {
    const { data } = await supabase.from('activity_logs').select('*, profiles(name, email)').order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByShop(shopId) {
    const { data } = await supabase.from('activity_logs').select('*, profiles(name, email)').eq('shop_id', shopId).order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByBranch(branchId) {
    const { data } = await supabase.from('activity_logs').select('*, profiles(name, email)').eq('branch_id', branchId).order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async create(log) {
    const { data } = await supabase.from('activity_logs').insert(toSnake(log)).select().single()
    return toCamel(data)
  },
}

// ============================================================
// Bank Accounts
// ============================================================
export const bankAccountService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('bank_accounts').select('*').eq('shop_id', shopId)
    return toCamel(data) || []
  },
  async getById(id) {
    const { data } = await supabase.from('bank_accounts').select('*').eq('id', id).single()
    return toCamel(data)
  },
  async create(account) {
    const { data, error } = await supabase.from('bank_accounts').insert(toSnake(account)).select()
    if (error) throw new Error(error.message)
    return toCamel(Array.isArray(data) ? data[0] : data)
  },
  async update(id, changes) {
    const { data, error } = await supabase.from('bank_accounts').update(toSnake(changes)).eq('id', id).select()
    if (error) throw new Error(error.message)
    return toCamel(Array.isArray(data) ? data[0] : data)
  },
  async remove(id) {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

// ============================================================
// Stats
// ============================================================
export async function getStats(shopId, branchId = null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let salesQuery = supabase.from('sales').select('*').eq('shop_id', shopId)
  let productsQuery = supabase.from('shop_products').select('*').eq('shop_id', shopId)

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
    productsQuery = productsQuery.eq('branch_id', branchId)
  }

  const [{ data: rawSales }, { data: rawProducts }] = await Promise.all([
    salesQuery,
    productsQuery,
  ])

  const sales = toCamel(rawSales) || []
  const products = toCamel(rawProducts) || []

  const todaySales = sales.filter(s => new Date(s.createdAt) >= today)

  return {
    totalSales: sales.length,
    todayRevenue: todaySales.reduce((sum, s) => sum + (s.total || 0), 0),
    todayOrders: todaySales.length,
    lowStock: products.filter(p => (p.stock || 0) <= (p.minStock || 0)).length,
    totalProducts: products.length,
  }
}

// ============================================================
// Cart (keep localStorage for speed / offline)
// ============================================================
const CART_KEY = 'pos_carts'
const ACTIVE_CART_KEY = 'pos_active_cart'

export const cartService = {
  getBranchCarts(branchId) {
    const all = JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    return all[branchId] || []
  },
  getActiveCartId(branchId) {
    const all = JSON.parse(localStorage.getItem(ACTIVE_CART_KEY) || '{}')
    return all[branchId] || ''
  },
  setBranchCarts(branchId, carts) {
    const all = JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    all[branchId] = carts
    localStorage.setItem(CART_KEY, JSON.stringify(all))
  },
  setActiveCartId(branchId, id) {
    const all = JSON.parse(localStorage.getItem(ACTIVE_CART_KEY) || '{}')
    all[branchId] = id
    localStorage.setItem(ACTIVE_CART_KEY, JSON.stringify(all))
  },
}
