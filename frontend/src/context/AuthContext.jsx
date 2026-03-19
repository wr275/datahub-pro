import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      authApi.me()
        .then(res => setUser(res.data))
        .catch(() => { localStorage.removeItem('access_token'); localStorage.removeItem('user') })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (tokenData) => {
    localStorage.setItem('access_token', tokenData.access_token)
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
