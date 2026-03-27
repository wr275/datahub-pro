import React, { useState, useRef, useEffect } from 'react'
import OnboardingTour from './OnboardingTour'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  {
    section: 'HOME', icon: '🏠',
    items: [
      { label: 'Hub Home', path: '/hub', icon: '🏠' },
      { label: 'Executive Dashboard', path: '/executive-dashboard', icon: '📊' },
      { label: 'Dashboard Builder', path: '/dashboard-builder', icon: '🎨' },
    ]
  },
  {
    section: 'DATA', icon: '🗄️',
    items: [
      { label: 'Data Blending', path: '/data-blending', icon: '🔀' },
      { label: 'Data Table', path: '/data-table', icon: '📋' },
      { label: 'KPI Dashboard', path: '/kpi-dashboard', icon: '🔢' },
      { label: 'Data Summary', path: '/data-summary', icon: '📝' },
      { label: 'Data Quality', path: '/data-quality', icon: '✅' },
      { label: 'Data Cleaner', path: '/data-cleaner', icon: '🧹' },
      { label: 'Advanced Filter', path: '/advanced-filter', icon: '🔍' },
      { label: 'Value Frequency', path: '/value-frequency', icon: '📊' },
    ]
  },
  {
    section: 'ANALYSIS', icon: '🔬',
    items: [
      { label: 'Pivot Table', path: '/pivot-table', icon: '🔄' },
      { label: 'What-If Scenarios', path: '/what-if', icon: '🤔' },
      { label: 'Anomaly Detection', path: '/anomaly-detection', icon: '⚠️' },
      { label: 'Period Comparison', path: '/period-comparison', icon: '📅' },
      { label: 'Variance Analysis', path: '/variance-analysis', icon: '📐' },
      { label: 'Regression Analysis', path: '/regression', icon: '📈' },
      { label: 'Correlation Matrix', path: '/correlation', icon: '🔗' },
      { label: 'Cohort Analysis', path: '/cohort-analysis', icon: '👥' },
      { label: 'Trend Analysis', path: '/trend-analysis', icon: '📉' },
      { label: 'RFM Analysis', path: '/rfm', icon: '🎯' },
      { label: 'Pareto Analysis', path: '/pareto', icon: '80%' },
      { label: 'Customer Segmentation', path: '/segmentation', icon: '🎯' },
    ]
  },
  {
    section: 'FORECASTING', icon: '🔮',
    items: [
      { label: 'Forecasting', path: '/forecasting', icon: '🔮' },
      { label: 'Goal Tracker', path: '/goal-tracker', icon: '🏁' },
      { label: 'Break-Even Calculator', path: '/break-even', icon: '⚖️' },
      { label: 'Rolling Average', path: '/rolling-average', icon: '〰️' },
    ]
  },
  {
    section: 'VISUALISATION', icon: '📊',
    items: [
      { label: 'Bar Chart', path: '/bar-chart', icon: '📊' },
      { label: 'Line Chart', path: '/line-chart', icon: '📈' },
      { label: 'Pie Chart', path: '/pie-chart', icon: '🥧' },
      { label: 'Heatmap', path: '/heatmap', icon: '🌡️' },
      { label: 'Waterfall', path: '/waterfall', icon: '💧' },
      { label: 'Scatter Plot', path: '/scatter-plot', icon: '✦' },
      { label: 'Combo Chart', path: '/combo-chart', icon: '📉' },
      { label: 'Funnel Chart', path: '/funnel-chart', icon: '🔻' },
      { label: 'Box Plot', path: '/box-plot', icon: '📦' },
    ]
  },
  {
    section: 'FINANCE', icon: '💰',
    items: [
      { label: 'NPV Calculator', path: '/npv', icon: '💰' },
    ]
  },
  {
    section: 'AI & FORMULAS', icon: '🤖',
    items: [
      { label: 'Formula Engine', path: '/formula-engine', icon: '⚗️' },
      { label: 'Excel Functions', path: '/excel-functions', icon: '📗' },
      { label: 'Formula Builder AI', path: '/formula-builder', icon: '🔧' },
      { label: 'Ask Your Data', path: '/ask-your-data', icon: '💬' },
      { label: 'Auto Report', path: '/auto-report', icon: '📄' },
      { label: 'AI Narrative', path: '/ai-narrative', icon: '✍️' },
      { label: 'Conditional Format', path: '/conditional-format', icon: '🎨' },
      { label: 'AI Insights', path: '/ai-insights', icon: '🧠' },
    ]
  },
  {
    section: 'OPERATIONS', icon: '⚙️',
    items: [
      { label: 'Scheduled Reports', path: '/scheduled-reports', icon: '⏰' },
      { label: 'Integrations', path: '/integrations', icon: '🔌' },
      { label: 'Workspace & Roles', path: '/workspace-roles', icon: '👥' },
      { label: 'Audit Log', path: '/audit-log', icon: '📜' },
      { label: 'AI Settings', path: '/ai-settings', icon: '⚙️' },
    ]
  },
]

const ALL_ITEMS = NAV.flatMap(({ section, items }) =>
  items.map(item => ({ ...item, section }))
)

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collapsed, setCollapsed] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef(null)

  const handleLogout = () => { logout(); navigate('/login') }
  const toggleSection = (s) => setCollapsed(p => ({ ...p, [s]: !p[s] }))

  const searchResults = searchQuery.trim().length > 0
    ? ALL_ITEMS.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.section.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  const handleSearchSelect = (path) => {
    navigate(path)
    setSearchQuery('')
    setSearchFocused(false)
  }

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f2f8' }}>
      <aside style={{ width: sidebarOpen ? 240 : 64, background: '#0c1446', display: 'flex', flexDirection: 'column', transition: 'width 0.25s', flexShrink: 0, overflow: 'hidden' }}>

        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0, fontSize: '0.85rem' }}>D</div>
          {sidebarOpen && <div><div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>DataHub Pro</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>v3.8 Analytics Platform</div></div>}
        </div>

        {sidebarOpen && (
          <div ref={searchRef} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', border: `1px solid ${searchFocused ? 'rgba(233,30,140,0.7)' : 'rgba(255,255,255,0.15)'}`, transition: 'border-color 0.15s' }}>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginRight: 6, flexShrink: 0 }}>🔍</span>
              <input
                type='text'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder='Search tools…'
                style={{ background: 'none', border: 'none', outline: 'none', width: '100%', color: '#fff', fontSize: '0.8rem' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.85rem' }}>✕</button>
              )}
            </div>
            {searchFocused && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 1000, overflow: 'hidden', border: '1px solid #e8eaf4', marginTop: 2 }}>
                {searchResults.map((item, i) => (
                  <button key={item.path} onClick={() => handleSearchSelect(item.path)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < searchResults.length - 1 ? '1px solid #f4f5f9' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ fontSize: '0.9rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0c1446' }}>{item.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{item.section}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchFocused && searchQuery.trim().length > 0 && searchResults.length === 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 1000, padding: '12px 14px', marginTop: 2, border: '1px solid #e8eaf4' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>No tools found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {NAV.map(({ section, icon, items }) => (
            <div key={section}>
              {sidebarOpen ? (
                <button onClick={() => toggleSection(section)} data-tour={section === 'DATA' ? 'nav-data' : undefined} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span>{section}</span>
                  <span style={{ fontSize: '0.6rem' }}>{collapsed[section] ? '▶' : '▼'}</span>
                </button>
              ) : (
                <div style={{ padding: '8px 0 4px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem' }}>{icon}</div>
              )}
              {!collapsed[section] && items.map(item => (
                <NavLink key={item.path} to={item.path} data-tour={item.path === '/dashboard-builder' ? 'nav-dashboard' : undefined} style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '7px 16px' : '10px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(233,30,140,0.22)' : 'transparent',
                  borderLeft: isActive ? '3px solid #e91e8c' : '3px solid transparent',
                  fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, transition: 'all 0.12s',
                  whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none'
                })}>
                  <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{item.icon}</span>
                  {sidebarOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
          {sidebarOpen && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginBottom: 10 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>{user?.full_name || user?.email}</div>
              <div>{user?.organisation?.name}</div>
            </div>
          )}
          <button onClick={handleLogout} style={{ width: '100%', padding: sidebarOpen ? '8px' : '8px 0', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>→</span>
            {sidebarOpen && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#6b7280', fontSize: '1.2rem' }}>
            ☰
          </button>
          <div style={{ flex: 1 }} />
          <NavLink to="/files" data-tour="upload-btn" style={{ padding: '6px 14px', background: '#e91e8c', color: '#fff', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
            + Upload Data
          </NavLink>
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
    <OnboardingTour />
    </div>
  )
}
