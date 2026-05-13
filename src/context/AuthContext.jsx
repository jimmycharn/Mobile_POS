import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/mockData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = authService.getSession()
    setUser(session)
    setLoading(false)
  }, [])

  const login = (email, password) => {
    const result = authService.login(email, password)
    if (result.error) return result
    setUser(result.user)
    return result
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const signup = (email, password, name, shopName, phone, packageId) => {
    const result = authService.signup(email, password, name, shopName, phone, packageId)
    if (result.error) return result
    setUser(result.user)
    return result
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
