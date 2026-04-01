import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // N04: Always call /auth/me — works whether auth is via HttpOnly cookie
    // or Bearer token in localStorage. This is the single source of truth.
    authApi.me()
      .then(res => {
        setUser(res.data)
        // Keep localStorage in sync for components that read it directly
        if (res.data) {
          localStorage.setItem('user', JSON.stringify(res.data))
        }
      })
      .catch(() => {
        // Not authenticated — clear any stale local data
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = (tokenData) => {
    // Store access_token so the axios interceptor can attach it as Bearer
    // (cookie will also be set by the server on cross-origin requests)
    if (tokenData.access_token) {
      localStorage.setItem('access_token', tokenData.access_token)
    }
    localStorage.setItem('user', JSON.stringify(tokenData.user))
    setUser(tokenData.user)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
