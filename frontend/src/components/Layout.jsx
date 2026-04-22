import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ThemeProvider, useTheme } from '../context/ThemeContext'
import { adminApi } from '../api'
import OnboardingTour from './OnboardingTour'

const NAV = [
  {
    section: 'HOME', icon: '🏠',
    items: [
      { label: 'Hub Home',            path: '/hub',                icon: '🏠', tip: 'Your analytics command centre — all 50 tools at a glance' },
      { label: 'Executive Dashboard', path: '/executive-dashboard', icon: '📊', tip: 'High-level KPI overview with charts and trends' },
      { label: 'Dashboard Builder',   path: '/dashboard-builder',  icon: '🎨', tip: 'Build fully custom dashboards with drag-and-drop widgets' },
    ]
  },
  {
    section: 'DATA', icon: '🗄️',
    items: [
      { label: 'Data Blending',   path: '/data-blending',  icon: '🔀', tip: 'Merge two datasets using a common key column, like a SQL JOIN' },
      { label: 'Data Table',      path: '/data-table',     icon: '📋', tip: 'Browse and explore your raw data with sorting and filtering' },
      { label: 'KPI Dashboard',   path: '/kpi-dashboard',  icon: '🔢', tip: 'Live dashboard of your most important metrics' },
      { label: 'Data Summary',    path: '/data-summary',   icon: '📝', tip: 'Column-level statistics: mean, median, min, max, nulls' },
      { label: 'Data Quality',    path: '/data-quality',   icon: '✅', tip: 'Find missing values, duplicates, and inconsistencies' },
      { label: 'Data Cleaner',    path: '/data-cleaner',   icon: '🧹', tip: 'Remove duplicates and standardize values across your data' },
      { label: 'Advanced Filter', path: '/advanced-filter',icon: '🔍', tip: 'Multi-condition filters across any column' },
      { label: 'Value Frequency', path: '/value-frequency',icon: '📊', tip: 'See how often each unique value appears in any column' },
      { label: 'Connect Data',    path: '/connect-data',   icon: '🔌', tip: 'Pull live data from Shopify, QuickBooks and more' },
      { label: 'Data Pipelines',  path: '/data-pipelines', icon: '⚙️', tip: 'Build repeatable multi-step transforms automatically' },
    ]
  },
  {
    section: 'ANALYSIS', icon: '🔬',
    items: [
      { label: 'Pivot Table',          path: '/pivot-table',       icon: '🔄', tip: 'Drag-and-drop rows, columns and values to summarize data' },
      { label: 'What-If Scenarios',    path: '/what-if',           icon: '🤔', tip: 'Model scenarios by adjusting variables and seeing impact instantly' },
      { label: 'Anomaly Detection',    path: '/anomaly-detection', icon: '⚠️', tip: 'Automatically flag outliers and unusual data points' },
      { label: 'Period Comparison',    path: '/period-comparison', icon: '📅', tip: 'Compare any time period against a prior period' },
      { label: 'Variance Analysis',    path: '/variance-analysis', icon: '📐', tip: 'Measure the gap between actuals and budget' },
      { label: 'Regression Analysis',  path: '/regression',        icon: '📈', tip: 'Fit trend lines and forecast future values' },
      { label: 'Correlation Matrix',   path: '/correlation',       icon: '🔗', tip: 'Discover which columns in your data are strongly related' },
      { label: 'Cohort Analysis',      path: '/cohort-analysis',   icon: '👥', tip: 'Track customer groups over time to measure retention' },
      { label: 'Churn Risk Analysis',  path: '/churn-risk',        icon: '🔥', tip: 'ML-scored churn risk per customer with recommended actions' },
      { label: 'Trend Analysis',       path: '/trend-analysis',    icon: '📉', tip: 'Visualise how any metric changes over time' },
      { label: 'RFM Analysis',         path: '/rfm',               icon: '🎯', tip: 'Score customers by Recency, Frequency, and Monetary value' },
      { label: 'Pareto Analysis',      path: '/pareto',            icon: '📊', tip: 'Identify the 20% of factors driving 80% of results' },
      { label: 'Customer Segmentation',path: '/segmentation',      icon: '🎯', tip: 'Automatically group customers into meaningful clusters' },
    ]
  },
  {
    section: 'FORECASTING', icon: '🔮',
    items: [
      { label: 'Forecasting',          path: '/forecasting',  icon: '🔮', tip: 'Project future values using machine learning models' },
      { label: 'Goal Tracker',         path: '/goal-tracker', icon: '🏁', tip: 'Set KPI targets and track progress automatically' },
      { label: 'Break-Even Calculator',path: '/break-even',   icon: '⚖️', tip: 'Calculate the exact sales volume needed to reach profitability' },
      { label: 'Rolling Average',      path: '/rolling-average', icon: '〰️', tip: 'Smooth noisy data with a moving average' },
    ]
  },
  {
    section: 'VISUALISATION', icon: '📊',
    items: [
      { label: 'Bar Chart',   path: '/bar-chart',    icon: '📊', tip: 'Side-by-side bars to compare values across categories' },
      { label: 'Line Chart',  path: '/line-chart',   icon: '📈', tip: 'Plot trends over time with interactive line charts' },
      { label: 'Pie Chart',   path: '/pie-chart',    icon: '🥧', tip: 'Proportional breakdowns with colour-coded pie charts' },
      { label: 'Heatmap',     path: '/heatmap',      icon: '🌡️', tip: 'Visualise data intensity with a colour gradient map' },
      { label: 'Waterfall',   path: '/waterfall',    icon: '💧', tip: 'Break down cumulative changes step by step' },
      { label: 'Scatter Plot',path: '/scatter-plot', icon: '✦',  tip: 'Plot two variables to reveal correlations and clusters' },
      { label: 'Combo Chart', path: '/combo-chart',  icon: '📉', tip: 'Overlay bar and line chart on dual axes' },
      { label: 'Funnel Chart',path: '/funnel-chart', icon: '🔻', tip: 'Visualise conversion rates across a multi-step process' },
      { label: 'Box Plot',    path: '/box-plot',     icon: '📦', tip: 'Display distribution including median, quartiles, and outliers' },
    ]
  },
  {
    section: 'FINANCE', icon: '💰',
    items: [
      { label: 'NPV Calculator', path: '/npv', icon: '💰', tip: 'Calculate net present value of an investment' },
    ]
  },
  {
    section: 'FORMULAS', icon: '⚗️',
    items: [
      { label: 'Formula Engine',    path: '/formula-engine',    icon: '⚗️', tip: 'Access 200+ built-in formulas to compute and enrich data' },
      { label: 'Excel Functions',   path: '/excel-functions',   icon: '📗', tip: 'Full reference guide to Excel-compatible functions' },
      { label: 'Conditional Format',path: '/conditional-format',icon: '🎨', tip: 'Colour-coded rules to highlight cells based on values' },
    ]
  },
  {
    section: 'AI', icon: '🤖', aiGated: true,
    items: [
      { label: 'Ask Your Data',     path: '/ask-your-data',   icon: '💬', tip: 'Type a question in plain English — get instant answers' },
      { label: 'AI Insights',       path: '/ai-insights',     icon: '🧠', tip: 'Deep AI analysis to surface hidden patterns and insights' },
      { label: 'AI Narrative',      path: '/ai-narrative',    icon: '✍️', tip: 'Turn your data into a compelling written story' },
      { label: 'Auto Report',       path: '/auto-report',     icon: '📄', tip: 'Generate a written narrative report from your data in one click' },
      { label: 'Formula Builder AI',path: '/formula-builder', icon: '🔧', tip: 'Describe what to calculate and AI writes the formula' },
      { label: 'AI Settings',       path: '/ai-settings',     icon: '⚙️', tip: 'Configure AI preferences, model selection, and prompt templates' },
    ]
  },
  {
    section: 'OPERATIONS', icon: '⚙️',
    items: [
      { label: 'Scheduled Reports', path: '/scheduled-reports', icon: '⏰', tip: 'Automated report delivery on a daily, weekly, or monthly schedule' },
      { label: 'Integrations',      path: '/integrations',      icon: '🔌', tip: 'Connect DataHub to Slack, Zapier, SharePoint, Google Sheets and more' },
      { label: 'Workspace & Roles', path: '/workspace-roles',   icon: '👥', tip: 'Manage team members and control data access permissions' },
      { label: 'Audit Log',         path: '/audit-log',         icon: '📜', tip: 'Full timestamped activity trail of every workspace action' },
    ]
  },
]

// Platform-admin nav — only rendered for is_superuser users. Kept separate
// from NAV because it has its own URL prefix (/admin/*) and badges that
// depend on server state (pending AI requests, etc.).
const ADMIN_NAV = {
  section: 'PLATFORM ADMIN', icon: '🛡️',
  items: [
    { label: 'Overview',       path: '/admin',               icon: '📊', tip: 'KPI overview: signups, MRR, AI usage, and active orgs' },
    { label: 'Organisations',  path: '/admin/organisations', icon: '🏢', tip: 'Every workspace — plans, AI status, quotas, suspensions' },
    { label: 'Users',          path: '/admin/users',         icon: '👤', tip: 'Every user across all workspaces — suspend, grant superuser' },
    { label: 'AI Requests',    path: '/admin/ai-requests',   icon: '🤖', tip: 'Approve or deny workspace requests for AI access', badgeKey: 'aiPending' },
    { label: 'Billing',        path: '/admin/billing',       icon: '💳', tip: 'MRR by plan, churn, trialing & active subscriptions' },
    { label: 'Usage',          path: '/admin/usage',         icon: '📈', tip: 'Token consumption & cost metering across all workspaces' },
  ]
}

// ─── Inner layout — reads theme context ──────────────────────
function LayoutInner({ children }) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collapsed, setCollapsed] = useState({})

  const handleLogout = () => { logout(); navigate('/login') }
  const toggleSection = (s) => setCollapsed(p => ({ ...p, [s]: !p[s] }))
  const aiEnabled = !!(user?.organisation?.ai_enabled ?? user?.ai_enabled)
  const isSuperuser = !!user?.is_superuser

  // Live badges for admin nav. Currently just pending AI requests; refreshes
  // every 60s so Waqas sees the count move without reloading. Scoped to
  // superusers only — the 404 from non-admins would otherwise spam the
  // interceptor's auth redirect.
  const [adminBadges, setAdminBadges] = useState({ aiPending: 0 })
  useEffect(() => {
    if (!isSuperuser) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await adminApi.listAiRequests({ status: 'pending' })
        if (cancelled) return
        const count = res.data?.counts?.pending ?? (res.data?.requests || []).length
        setAdminBadges(b => ({ ...b, aiPending: count }))
      } catch {
        // Silent — sidebar badge is a nicety, not critical.
      }
    }
    load()
    const t = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(t) }
  }, [isSuperuser])

  const isGold = theme === 'gold'
  const isDark = theme === 'dark'
  const accent      = isGold ? '#f59e0b' : '#e91e8c'
  const accentText  = isGold ? '#000'    : '#fff'
  const navActiveBg = isGold ? 'rgba(245,158,11,0.15)' : 'rgba(233,30,140,0.22)'
  const navActiveBar= isGold ? '#f59e0b' : '#e91e8c'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--shell-main-bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 64,
        background: 'var(--shell-sidebar)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s', flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--shell-sidebar-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentText, fontWeight: 800, flexShrink: 0, fontSize: '0.85rem' }}>D</div>
          {sidebarOpen && (
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>DataHub Pro</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>v3.8 Analytics Platform</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {NAV.map(({ section, icon, items, aiGated }) => {
            const locked = aiGated && !aiEnabled
            // The onboarding tour step 4 highlights the DATA section — tag
            // it so the spotlight overlay can find it via querySelector.
            const tourAttr = section === 'DATA' ? { 'data-tour': 'nav-data' } : {}
            return (
            <div key={section} {...tourAttr}>
              {sidebarOpen ? (
                <button onClick={() => toggleSection(section)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {section}
                    {locked && <span title="AI add-on is off — click any AI tool to enable" style={{ fontSize: '0.7rem' }}>🔒</span>}
                    {aiGated && !locked && <span title="AI add-on enabled" style={{ color: '#22c55e', fontSize: '0.55rem' }}>●</span>}
                  </span>
                  <span style={{ fontSize: '0.6rem' }}>{collapsed[section] ? '▶' : '▼'}</span>
                </button>
              ) : (
                <div style={{ padding: '8px 0 4px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem' }}>{icon}</div>
              )}
              {!collapsed[section] && items.map(item => (
                <NavLink key={item.path} to={item.path}
                  title={locked ? `${item.tip} — click to enable the AI add-on` : item.tip}
                  className="nav-item"
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: sidebarOpen ? '7px 16px' : '10px 0',
                    justifyContent: sidebarOpen ? 'flex-start' : 'center',
                    color: isActive ? '#fff' : (locked ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.72)'),
                    background: isActive ? navActiveBg : 'transparent',
                    borderLeft: isActive ? `3px solid ${navActiveBar}` : '3px solid transparent',
                    fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, transition: 'all 0.12s',
                    whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none',
                    cursor: 'pointer',
                  })}>
                  <span style={{ fontSize: '0.95rem', flexShrink: 0, opacity: locked ? 0.65 : 1 }}>{item.icon}</span>
                  {sidebarOpen && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {item.label}
                      {locked && <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>🔒</span>}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )})}

          {/* Platform-admin section. Only renders for is_superuser. Uses a
              distinct purple accent so it's visually obvious this is the
              backstage dashboard, not a tenant-facing tool. */}
          {isSuperuser && (
            <div key="__admin__" style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
              {sidebarOpen ? (
                <button
                  onClick={() => toggleSection(ADMIN_NAV.section)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>🛡️</span>{ADMIN_NAV.section}
                    {adminBadges.aiPending > 0 && (
                      <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: '0.6rem', fontWeight: 800 }}>{adminBadges.aiPending}</span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.6rem' }}>{collapsed[ADMIN_NAV.section] ? '▶' : '▼'}</span>
                </button>
              ) : (
                <div style={{ padding: '8px 0 4px', textAlign: 'center', color: '#a78bfa', fontSize: '0.6rem' }}>🛡️</div>
              )}
              {!collapsed[ADMIN_NAV.section] && ADMIN_NAV.items.map(item => {
                const badge = item.badgeKey ? adminBadges[item.badgeKey] : 0
                return (
                  <NavLink key={item.path} to={item.path} end={item.path === '/admin'}
                    title={item.tip}
                    className="nav-item"
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: sidebarOpen ? '7px 16px' : '10px 0',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
                      background: isActive ? 'rgba(167,139,250,0.18)' : 'transparent',
                      borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
                      fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, transition: 'all 0.12s',
                      whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none',
                    })}>
                    <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{item.icon}</span>
                    {sidebarOpen && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{item.label}</span>
                        {badge > 0 && (
                          <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: '0.65rem', fontWeight: 700, marginLeft: 6 }}>{badge}</span>
                        )}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid var(--shell-sidebar-border)', padding: '12px 16px' }}>
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

      {/* Right side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ background: 'var(--shell-topbar)', borderBottom: '1px solid var(--shell-topbar-border)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* Hamburger */}
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--shell-icon)', fontSize: '1.2rem' }}>
            ☰
          </button>

          <div style={{ flex: 1 }} />

          {/* 🌙 / ☀️ Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isGold ? 'Switch to light mode' : 'Switch to gold mode'}
            style={{
              background: 'var(--shell-toggle-bg)',
              border: `1px solid ${isGold ? 'rgba(245,158,11,0.3)' : 'var(--shell-topbar-border)'}`,
              borderRadius: 20,
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isGold ? '#f59e0b' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}>
            <span style={{ fontSize: '1rem' }}>{isGold ? '☀️' : '✦'}</span>
            {isGold ? 'Light' : 'Dark'}
          </button>

          {/* Upload */}
          <NavLink to="/files" style={{ padding: '6px 14px', background: accent, color: accentText, borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
            + Upload Data
          </NavLink>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: accent, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentText, fontWeight: 700, fontSize: '0.85rem' }}>
              {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {user?.organisation?.subscription_tier && (
              <span style={{ padding: '2px 10px', background: isGold ? 'rgba(245,158,11,0.2)' : '#e91e8c22', color: accent, borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                {user.organisation.subscription_tier}
              </span>
            )}
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', ...((isGold || isDark) ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }}>
          {children}
        </main>
      </div>

      {/* Onboarding tour — self-gates via localStorage, only fires once per
          browser. Mounted at the Layout level so it can reach elements in
          both the sidebar (nav-data) and the page content (upload-btn,
          sample-picker). */}
      <OnboardingTour />
    </div>
  )
}

// ─── Layout wraps inner with ThemeProvider ───────────────────
export default function Layout({ children }) {
  return (
    <ThemeProvider>
      <LayoutInner>{children}</LayoutInner>
    </ThemeProvider>
  )
}
