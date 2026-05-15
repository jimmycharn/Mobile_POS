// Supabase API Layer — replaces mockData services
// Mirrors the same API so pages need minimal changes

import { supabase } from '../lib/supabase'

// ============================================================
// Auth
// ============================================================
export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, shops:id (id)')
      .eq('id', data.user.id)
      .single()

    if (!profile) return { error: 'Profile not found' }

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
  async getById(id) {
    const { data } = await supabase.from('shops').select('*').eq('id', id).single()
    return data
  },
  async update(id, changes) {
    const { data } = await supabase.from('shops').update(changes).eq('id', id).select().single()
    return data
  },
}

// ============================================================
// Branches
// ============================================================
export const branchService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('branches').select('*').eq('shop_id', shopId).order('created_at')
    return data || []
  },
  async getById(id) {
    const { data } = await supabase.from('branches').select('*').eq('id', id).single()
    return data
  },
  async create(branch) {
    const { data } = await supabase.from('branches').insert(branch).select().single()
    return data
  },
  async update(id, changes) {
    const { data } = await supabase.from('branches').update(changes).eq('id', id).select().single()
    return data
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
    return data || []
  },
  async create(product) {
    const { data } = await supabase.from('products').insert(product).select().single()
    return data
  },
  async update(id, changes) {
    const { data } = await supabase.from('products').update(changes).eq('id', id).select().single()
    return data
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
    return data || []
  },
  async getByBranch(branchId) {
    const { data } = await supabase.from('shop_products').select('*').eq('branch_id', branchId)
    return data || []
  },
  async getById(id) {
    const { data } = await supabase.from('shop_products').select('*').eq('id', id).single()
    return data
  },
  async create(sp) {
    const { data } = await supabase.from('shop_products').insert(sp).select().single()
    return data
  },
  async update(id, changes) {
    const { data } = await supabase.from('shop_products').update(changes).eq('id', id).select().single()
    return data
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
    return data || []
  },
}

// ============================================================
// Sales
// ============================================================
export const saleService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('sales').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
    return data || []
  },
  async getByBranch(branchId) {
    const { data } = await supabase.from('sales').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
    return data || []
  },
  async create(sale) {
    const { data } = await supabase.from('sales').insert(sale).select().single()
    return data
  },
}

// ============================================================
// Users / Staff
// ============================================================
export const userService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('profiles').select('*').eq('shop_id', shopId).neq('role', 'owner')
    return data || []
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
    const { data } = await supabase.from('profiles').update(changes).eq('id', id).select().single()
    return data
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
    return data || []
  },
  async getById(id) {
    const { data } = await supabase.from('packages').select('*').eq('id', id).single()
    return data
  },
}

// ============================================================
// Activity Logs
// ============================================================
export const logService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('activity_logs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
    return data || []
  },
  async create(log) {
    const { data } = await supabase.from('activity_logs').insert(log).select().single()
    return data
  },
}

// ============================================================
// Bank Accounts
// ============================================================
export const bankAccountService = {
  async getByShop(shopId) {
    const { data } = await supabase.from('bank_accounts').select('*').eq('shop_id', shopId)
    return data || []
  },
  async getById(id) {
    const { data } = await supabase.from('bank_accounts').select('*').eq('id', id).single()
    return data
  },
  async create(account) {
    const { data } = await supabase.from('bank_accounts').insert(account).select().single()
    return data
  },
  async update(id, changes) {
    const { data } = await supabase.from('bank_accounts').update(changes).eq('id', id).select().single()
    return data
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

  const [{ data: sales }, { data: products }] = await Promise.all([
    salesQuery,
    productsQuery,
  ])

  const todaySales = (sales || []).filter(s => new Date(s.created_at) >= today)

  return {
    totalSales: (sales || []).length,
    todayRevenue: todaySales.reduce((sum, s) => sum + (s.total || 0), 0),
    todayOrders: todaySales.length,
    lowStock: (products || []).filter(p => (p.stock || 0) <= (p.min_stock || 0)).length,
    totalProducts: (products || []).length,
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
