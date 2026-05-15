import { createContext, useContext, useState, useEffect } from 'react'
import { authService, branchService } from '../services/supabaseApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState([])

  useEffect(() => {
    initSession()
  }, [])

  useEffect(() => {
    if (user?.shopId) {
      branchService.getByShop(user.shopId).then(setBranches)
    } else {
      setBranches([])
    }
  }, [user?.shopId])

  const initSession = async () => {
    const session = authService.getSession()
    if (session) {
      const userBranches = session.shopId ? await branchService.getByShop(session.shopId) : []
      const effectiveBranchId = session.branchId || (userBranches[0]?.id || null)
      setUser({ ...session, branchId: effectiveBranchId })
    }
    setLoading(false)
  }

  const login = async (email, password) => {
    const result = await authService.login(email, password)
    if (result.error) return result
    const userBranches = result.user.shopId ? await branchService.getByShop(result.user.shopId) : []
    const effectiveBranchId = result.user.branchId || (userBranches[0]?.id || null)
    const enrichedUser = { ...result.user, branchId: effectiveBranchId }
    setUser(enrichedUser)
    sessionStorage.setItem('pos_session', JSON.stringify(enrichedUser))
    return { user: enrichedUser }
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
    setBranches([])
  }

  const switchBranch = (branchId) => {
    if (!user) return
    if (user.branchId && user.role !== 'owner' && user.role !== 'superadmin') return
    const updated = { ...user, branchId }
    setUser(updated)
    sessionStorage.setItem('pos_session', JSON.stringify(updated))
  }

  const signup = async (email, password, name, shopName, phone, packageId) => {
    const result = await authService.signup(email, password, name, shopName, phone, packageId)
    if (result.error) return result
    setUser(result.user)
    return result
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, switchBranch, branches, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
