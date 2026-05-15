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
// Auth
// ============================================================
export const authService = {
  async login(email, password) {
    console.log('[DEBUG] login called with:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[DEBUG] signInWithPassword error:', error.message)
      return { error: error.message }
    }
    console.log('[DEBUG] auth success, user id:', data.user.id)

    // Simple profile query without complex joins
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('[DEBUG] profile fetch error:', profileError.message)
    }
    console.log('[DEBUG] profile fetched:', profile)

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
    console.log('[DEBUG] login success, user:', user)
    return { user }
  },

  async signup(email, password, name, shopName, phone, packageId) {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) return { error: authError.message }

    const userId = authData.user.id

    // 2. Create shop
    const { data: shop } = await supabase
      .from('shops')
      .insert({ name: shopName, owner_id: userId, phone, package_id: packageId })
      .select()
      .single()

    // 3. Create default branch
    const { data: branch } = await supabase
      .from('branches')
      .insert({ shop_id: shop.id, name: 'สาขาหลัก' })
      .select()
      .single()

    // 4. Create profile
    const { data: profile } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        name,
        role: 'owner',
        shop_id: shop.id,
        branch_id: branch.id,
      })
      .select()
      .single()

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
    const { data } = await supabase.from('branches').insert(toSnake(branch)).select().single()
    return toCamel(data)
  },
  async update(id, changes) {
    const { data } = await supabase.from('branches').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
  async remove(id) {
    await supabase.from('branches').delete().eq('id', id)
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
  async create(product) {
    const { data } = await supabase.from('products').insert(toSnake(product)).select().single()
    return toCamel(data)
  },
  async update(id, changes) {
    const { data } = await supabase.from('products').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
  async remove(id) {
    await supabase.from('products').delete().eq('id', id)
  },
}

// ============================================================
// Shop Products (branch inventory)
// ============================================================
export const shopProductService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('shop_products').select('*').eq('shop_id', shopId)
    return toCamel(data) || []
  },
  async getByBranch(branchId) {
    const { data } = await supabase.from('shop_products').select('*').eq('branch_id', branchId)
    return toCamel(data) || []
  },
  async getById(id) {
    const { data } = await supabase.from('shop_products').select('*').eq('id', id).single()
    return toCamel(data)
  },
  async create(sp) {
    const { data } = await supabase.from('shop_products').insert(toSnake(sp)).select().single()
    return toCamel(data)
  },
  async update(id, changes) {
    const { data } = await supabase.from('shop_products').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
  async remove(id) {
    await supabase.from('shop_products').delete().eq('id', id)
  },
  async search(shopId, query) {
    const { data } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_id', shopId)
      .ilike('name', `%${query}%`)
    return toCamel(data) || []
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
    // Staff signup requires admin RPC or manual invite flow
    // For now: create auth user via admin API (requires service_role key on server)
    // Client-side fallback: store in localStorage (temporary)
    // TODO: move to serverless function for production
    const tempStaff = { ...user, id: 'staff-' + Date.now(), createdAt: new Date().toISOString(), isActive: true }
    // This is a placeholder — real implementation needs Edge Function
    return tempStaff
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
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByShop(shopId) {
    const { data } = await supabase.from('activity_logs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
    return toCamel(data) || []
  },
  async getByBranch(branchId) {
    const { data } = await supabase.from('activity_logs').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
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
    const { data } = await supabase.from('bank_accounts').insert(toSnake(account)).select().single()
    return toCamel(data)
  },
  async update(id, changes) {
    const { data } = await supabase.from('bank_accounts').update(toSnake(changes)).eq('id', id).select().single()
    return toCamel(data)
  },
  async remove(id) {
    await supabase.from('bank_accounts').delete().eq('id', id)
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
