import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  {
    section: 'HOME', icon: 'ðŸ ',
    items: [
      { label: 'Hub Home', path: '/hub', icon: 'ðŸ ' },
      { label: 'Executive Dashboard', path: '/executive-dahoard', icon: 'ðŸ“Š' },
      { label: 'Dashboard Builder', path: '/dashboard-builder', icon: 'ðŸŽ¨' },
    ]
  },
  {
    section: 'DATA', icon: 'ðŸ—„ï¸',
    items: [
      { label: 'Data Blending', path: '/data-blending', icon: 'ðŸ”€' },
      { label: 'Data Table', path: '/data-table', icon: 'ðŸ“‹' },
      { label: 'KPI Dashboard', path: '/kpi-dashboard', icon: 'ðŸ”¢' },
      { label: 'Data Summary', path: '/data-summary', icon: 'ðŸ“' },
      { label: 'Data Quality', path: '/data-quality', icon: 'âœ…' },
      { label: 'Data Cleaner', path: '/data-cleaner', icon: 'ðŸ§¹' },
      { label: 'Advanced Filter', path: '/advanced-filter', icon: 'ðŸ”' },
      { label: 'Value Frequency', path: '/value-frequency', icon: 'ðŸ“Š' },
      { label: 'Connect Data', path: '/connect-data', icon: 'ðŸ”Œ' },
      { label: 'Data Pipelines', path: '/data-pipelines', icon: 'âš™ï¸' },
    ]
  },
  {
    section: 'ANALYSIS', icon: 'ðŸ”¬',
    items: [
      { label: 'Pivot Table', path: '/pivot-table', icon: 'ðŸ”„' },
      { label: 'What-If Scenarios', path: '/what-if', icon: 'ðŸ¤”' },
      { label: 'Anomaly Detection', path: '/anomaly-detection', icon: 'âš ï¸' },
      { label: 'Period Comparison', path: '/period-comparison', icon: 'ðŸ“…' },
      { label: 'Variance Analysis', path: '/variance-analysis', icon: 'ðŸ“' },
      { label: 'Regression Analysis', path: '/regression', icon: 'ðŸ“ˆ' },
      { label: 'Correlation Matrix', path: '/correlation', icon: 'ðŸ”—' },
      { label: 'Cohort Analysis', path: '/cohort-analysis', icon: 'ðŸ‘¥' },
      { label: 'Trend Analysis', path: '/trend-analysis', icon: 'ðŸ“‰' },
      { label: 'RFM Analysis', path: '/rfm', icon: 'ðŸŽ¯' },
      { label: 'Pareto Analysis', path: '/pareto', icon: '80%' },
      { label: 'Customer Segmentation', path: '/segmentation', icon: 'ðŸŽ¯' },
    ]
  },
  {
    section: 'FORECASTING', icon: 'ðŸ”®',
    items: [
      { label: 'Forecasting', path: '/forecasting', icon: 'ðŸ”®' },
      { label: 'Goal Tracker', path: '/goal-tracker', icon: 'ðŸ' },
      { label: 'Break-Even Calculator', path: '/break-even', icon: 'âš–ï¸' },
      { label: 'Rolling Average', path: '/rolling-average', icon: 'ã€°ï¸' },
    ]
  },
  {
    section: 'VISUALISATION', icon: 'ðŸ“Š',
    items: [
      { label: 'Bar Chart', path: '/bar-chart', icon: 'ðŸ“Š' },
      { label: 'Line Chart', path: '/line-chart', icon: 'ðŸ“ˆ' },
      { label: 'Pie Chart', path: '/pie-chart', icon: 'ðŸ¥§' },
      { label: 'Heatmap', path: '/heatmap', icon: 'ðŸŒ¡ï¸' },
      { label: 'Waterfall', path: '/waterfall', icon: 'ðŸ’§' },
      { label: 'Scatter Plot', path: '/scatter-plot', icon: 'âœ¦' },
      { label: 'Combo Chart', path: '/combo-chart', icon: 'ðŸ“‰' },
      { label: 'Funnel Chart', path: '/funnel-chart', icon: 'ðŸ”»' },
      { label: 'Box Plot', path: '/box-plot', icon: 'ðŸ“¦' },
    ]
  },
  {
    section: 'FINANCE', icon: 'ðŸ’°',
    items: [
      { label: 'NPV Calculator', path: '/npv', icon: 'ðŸ’°' },
    ]
  },
  {
    section: 'AI & FORMULAS', icon: 'ðŸ¤–',
    items: [
      { label: 'Formula Engine', path: '/formula-engine', icon: 'Úš—ï¸' },
      { label: 'Excel Functions', path: '/excel-functions', icon: 'ðŸ“—' },
      { label: 'Formula Builder AI', path: '/formula-builder', icon: 'ðŸ”§' },
      { label: 'Ask Your Data', path: '/ask-your-data', icon: 'ðŸ’¬' },
      { label: 'Auto Report', path: '/auto-report', icon: 'ðŸ“„' },
      { label: 'AI Narrative', path: '/ai-narrative', icon: 'âœï¸' },
      { label: 'Conditional Format', path: '/conditional-format', icon: 'ðŸŽ¨' },
      { label: 'AI Insights', path: '/ai-insights', icon: 'ðŸ§ ' },
    ]
  },
  {
    section: 'OPERATIONS', icon: 'âš™ï¸',
    items: [
      { label: 'Scheduled Reports', path: '/scheduled-reports', icon: 'â°' },
      { label: 'Integrations', path: '/integrations', icon: 'ðŸ”Œ' },
      { label: 'Workspace & Roles', path: '/workspace-roles', icon: 'ðŸ‘¥' },
      { label: 'Audit Log', path: '/audit-log', icon: 'ðŸ“œ' },
      { label: 'AI Settings', path: '/ai-settings', icon: 'âš™ï¸' },
    ]
  },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collapsed, setCollapsed] = useState({})

  const handleLogout = () => { logout(); navigate('/login') }
  const toggleSection = (s) => setCollapsed(p => ({ ...p, [s]: !p[s] }))

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f2f8' }}>
      <aside style={{ width: sidebarOpen ? 240 : 64, background: '#0c1446', display: 'flex', flexDirection: 'column', transition: 'width 0.25s', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0, fontSize: '0.85rem' }}>D</div>
          {sidebarOpen && <div><div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>DataHub Pro</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>v3.8 Analytics Platform</div></div>}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {NAV.map(({ section, icon, items }) => (
            <div key={section}>
              {sidebarOpen ? (
                <button onClick={() => toggleSection(section)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span>{section}</span>
                  <span style={{ fontSize: '0.6rem' }}>{collapsed[section] ? 'â–¶' : 'â–¼'}</span>
                </button>
              ) : (
                <div style={{ padding: '8px 0 4px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem' }}>{icon}</div>
              )}
              {!collapsed[section] && items.map(item => (
                <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
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
            <span>â†’</span>
            {sidebarOpen && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#6b7280', fontSize: '1.2rem' }}>
            â˜°
          </button>
          <div style={{ flex: 1 }} />
          <NavLink to="/files" style={{ padding: '6px 14px', background: '#e91e8c', color: '#fff', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
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
    </div>
  )
}
