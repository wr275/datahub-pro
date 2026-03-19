import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { path: '/files', label: 'My Files', icon: '📁' },
  { path: '/analytics', label: 'Analytics', icon: '📊' },
  { path: '/billing', label: 'Billing', icon: '💳' },
  { path: '/team', label: 'Team', icon: '👥' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f2f8' }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 240 : 64, background: '#0c1446', display: 'flex', flexDirection: 'column', transition: 'width 0.25s', flexShrink: 0, overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>D</div>
          {sidebarOpen && <div><div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>DataHub Pro</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>Enterprise Analytics</div></div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              background: isActive ? 'rgba(233,30,140,0.25)' : 'transparent',
              borderLeft: isActive ? '3px solid #e91e8c' : '3px solid transparent',
              fontSize: '0.85rem', fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
              whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none'
            })}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + collapse */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
          {sidebarOpen && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginBottom: 10 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>{user?.full_name || user?.email}</div>
              <div>{user?.organisation}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
              {sidebarOpen ? '← Hide' : '→'}
            </button>
            {sidebarOpen && <button onClick={handleLogout} style={{ flex: 1, background: 'rgba(233,30,140,0.3)', border: 'none', color: '#fff', padding: '6px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>Logout</button>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f0f2f8' }}>
        {/* Top bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e5f1', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: '0.9rem', color: '#4a5280' }}>Welcome back, <strong style={{ color: '#0c1446' }}>{user?.full_name?.split(' ')[0] || 'there'}</strong></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#fce4f1', color: '#e91e8c', borderRadius: 20, fontWeight: 700 }}>{user?.organisation || 'My Workspace'}</span>
            <NavLink to="/analytics" style={{ background: '#e91e8c', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              📊 Open Analytics
            </NavLink>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
