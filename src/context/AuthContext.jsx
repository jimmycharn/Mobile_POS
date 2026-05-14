import { createContext, useContext, useState, useEffect } from 'react'
import { authService, branchService } from '../services/mockData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Get branches list for the current shop (for owner)
  const branches = user?.shopId ? branchService.getByShop(user.shopId) : []

  useEffect(() => {
    const session = authService.getSession()
    if (session) {
      // If staff has a branchId, use it. If owner (no branchId), default to first branch
      const userBranches = session.shopId ? branchService.getByShop(session.shopId) : []
      const effectiveBranchId = session.branchId || (userBranches[0]?.id || null)
      setUser({ ...session, branchId: effectiveBranchId })
    }
    setLoading(false)
  }, [])

  const login = (email, password) => {
    const result = authService.login(email, password)
    if (result.error) return result
    const userBranches = result.user.shopId ? branchService.getByShop(result.user.shopId) : []
    const effectiveBranchId = result.user.branchId || (userBranches[0]?.id || null)
    const enrichedUser = { ...result.user, branchId: effectiveBranchId }
    setUser(enrichedUser)
    // Update session with branchId
    sessionStorage.setItem('pos_session', JSON.stringify(enrichedUser))
    return { user: enrichedUser }
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const switchBranch = (branchId) => {
    if (!user) return
    if (user.branchId && user.role !== 'owner' && user.role !== 'superadmin') return // Staff cannot switch
    const updated = { ...user, branchId }
    setUser(updated)
    sessionStorage.setItem('pos_session', JSON.stringify(updated))
  }

  const signup = (email, password, name, shopName, phone, packageId) => {
    const result = authService.signup(email, password, name, shopName, phone, packageId)
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
