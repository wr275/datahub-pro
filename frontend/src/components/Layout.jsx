import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

var navSections = [
  {
    title: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' },
      { path: '/files', label: 'My Files', icon: '📂' },
    ]
  },
  {
    title: 'Analytics',
    items: [
      { path: '/analytics', label: 'Analytics', icon: '📋' },
      { path: '/ai-insights', label: 'AI Insights', icon: '🧠' },
      { path: '/rfm', label: 'RFM Analysis', icon: '👥' },
      { path: '/trends', label: 'Trends', icon: '📈' },
      { path: '/npv', label: 'NPV / Financial', icon: '💰' },
    ]
  },
  {
    title: 'Account',
    items: [
      { path: '/billing', label: 'Billing', icon: '💳' },
      { path: '/team', label: 'Team', icon: '🤝' },
      { path: '/settings', label: 'Settings', icon: '⚙️' },
    ]
  }
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f2f8' }}>
      <aside style={{ width: sidebarOpen ? 240 : 64, background: '#0c1446', display: 'flex', flexDirection: 'column', transition: 'width 0.25s', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>D</div>
          {sidebarOpen && <div><div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>DataHub Pro</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Analytics Platform</div></div>}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}>
          {navSections.map(function(section) {
            return (
              <div key={section.title}>
                {sidebarOpen && (
                  <div style={{ padding: '10px 16px 4px', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {section.title}
                  </div>
                )}
                {section.items.map(function(item) {
                  return (
                    <NavLink key={item.path} to={item.path} style={function(p) { return {
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                      color: p.isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                      background: p.isActive ? 'rgba(233,30,140,0.25)' : 'transparent',
                      borderLeft: p.isActive ? '3px solid #e91e8c' : '3px solid transparent',
                      fontSize: '0.85rem', fontWeight: p.isActive ? 600 : 400, transition: 'all 0.15s',
                      whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none'
                    }}}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
                      {sidebarOpen && <span>{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
          {sidebarOpen && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginBottom: 10 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>{user?.full_name || user?.email}</div>
              <div>{user?.organisation?.name}</div>
            </div>
          )}
          <button onClick={handleLogout} style={{ width: '100%', padding: sidebarOpen ? '8px' : '8px 0', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>&#8594;</span>
            {sidebarOpen && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#6b7280', fontSize: '1.1rem' }}>
            {sidebarOpen ? '←' : '→'}
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
              {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {user?.organisation?.subscription_tier && (
              <span style={{ padding: '2px 10px', background: '#e91e8c22', color: '#e91e8c', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                {user.organisation.subscription_tier}
              </span>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
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
      <aside style={{ width: sidebarOpen ? 240 : 64, background: '#0c1446', display: 'flex', flexDirection: 'column', transition: 'width 0.25s', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>D</div>
          {sidebarOpen && <div><div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>DataHub Pro</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>Enterprise Analytics</div></div>}
        </div>
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
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
          {sidebarOpen && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginBottom: 10 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>{user?.full_name || user?.email}</div>
              <div>{user?.organisation?.name}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>{sidebarOpen ? '← Hide' : '→'}</button>
            {sidebarOpen && <button onClick={handleLogout} style={{ flex: 1, background: 'rgba(233,30,140,0.3)', border: 'none', color: '#fff', padding: '6px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>Logout</button>}
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', background: '#f0f2f8' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e5f1', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '0.9rem', color: '#4a5280' }}>Welcome back, <strong>{user?.full_name?.split(' ')[0] || 'there'}</strong></div>
          <NavLink to="/analytics" style={{ background: '#e91e8c', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
            📊 Analytics
          </NavLink>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </main>
    </div>
  )
}
