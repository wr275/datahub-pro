import { createContext, useContext, useState, useEffect } from 'react'
import '../theme.css'   // global CSS variables — imported here so any consumer gets them

const ThemeContext = createContext({ theme: 'gold', toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('dhp-theme') || 'gold' } catch { return 'gold' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('dhp-theme', theme) } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'gold' ? 'light' : 'gold')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
