import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi } from '../api'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { label: 'DATA', color: '#0c1446', icon: '🗄️', tools: [
    { path: '/data-table', icon: '📋', label: 'Data View', desc: 'Browse & explore' },
    { path: '/data-summary', icon: '📊', label: 'Data Summary', desc: 'Column stats' },
    { path: '/data-quality', icon: '✅', label: 'Quality Report', desc: 'Missing values' },
    { path: '/data-cleaner', icon: '🧹', label: 'Data Cleaner', desc: 'Fix & dedupe' },
    { path: '/data-blending', icon: '🔀', label: 'Data Blending', desc: 'Merge sources' },
    { path: '/advanced-filter', icon: '🔍', label: 'Advanced Filter', desc: 'Complex filters' },
    { path: '/kpi-dashboard', icon: '🔢', label: 'KPI Dashboard', desc: 'Key metrics' },
    { path: '/value-frequency', icon: '📊', label: 'Value Frequency', desc: 'Distribution' },
    { path: '/connect-data', icon: '🔌', label: 'Connect Data', desc: 'Live connectors', tooltip: 'Pull live data from Shopify, QuickBooks and more directly into DataHub — no manual exports needed.' },
    { path: '/data-pipelines', icon: '⚙️', label: 'Data Pipelines', desc: 'Auto transforms', tooltip: 'Build repeatable multi-step transforms: remove nulls, rename columns, filter rows, and join datasets automatically.' },
  ]},
  { label: 'ANALYSIS', color: '#0097b2', icon: '🔬', tools: [
    { path: '/pivot-table', icon: '🔄', label: 'Pivot Table', desc: 'Drag-drop pivots' },
    { path: '/what-if', icon: '🤔', label: 'What-If', desc: 'Scenario model' },
    { path: '/anomaly-detection', icon: '⚠️', label: 'Anomaly Detection', desc: 'Flag outliers' },
    { path: '/period-comparison', icon: '📅', label: 'Period Comparison', desc: 'vs prior period' },
    { path: '/variance-analysis', icon: '📐', label: 'Variance Analysis', desc: 'Actual vs budget' },
        { path: '/budget-actuals', icon: '💰', label: 'Budget vs Actuals', desc: 'Budget vs actual variance reports', tooltip: 'Import budget and actuals CSVs to generate variance reports with auto-generated commentary for every line item. Supports monthly, quarterly and annual views.' },
    { path: '/regression', icon: '📈', label: 'Regression', desc: 'Trend lines' },
    { path: '/correlation', icon: '🔗', label: 'Correlation Matrix', desc: 'Find patterns' },
    { path: '/cohort-analysis', icon: '👥', label: 'Cohort Analysis', desc: 'Retention' },
    { path: '/trend-analysis', icon: '📉', label: 'Trend Analysis', desc: 'Over time' },
    { path: '/rfm', icon: '🎯', label: 'RFM Analysis', desc: 'Customer score' },
    { path: '/pareto', icon: '📊', label: 'Pareto Analysis', desc: '80/20 rule' },
    { path: '/segmentation', icon: '🎯', label: 'Segmentation', desc: 'Group customers' },
  ]},
  { label: 'FORECASTING', color: '#7c3aed', icon: '🔮', tools: [
    { path: '/forecasting', icon: '🔮', label: 'Forecasting', desc: 'Predict future' },
    { path: '/goal-tracker', icon: '🏁', label: 'Goal Tracker', desc: 'Track targets' },
    { path: '/break-even', icon: '⚖️', label: 'Break-Even', desc: 'BEP analysis' },
    { path: '/rolling-average', icon: '〰️', label: 'Rolling Average', desc: 'Smooth trends' },
    { path: '/npv', icon: '💰', label: 'NPV Calculator', desc: 'Investment ROI' },
  ]},
  { label: 'VISUALISE', color: '#e91e8c', icon: '📊', tools: [
    { path: '/bar-chart', icon: '📊', label: 'Bar Chart', desc: 'Compare values' },
    { path: '/line-chart', icon: '📈', label: 'Line Chart', desc: 'Time series' },
    { path: '/pie-chart', icon: '🥧', label: 'Pie Chart', desc: 'Proportions' },
    { path: '/heatmap', icon: '🌡️', label: 'Heatmap', desc: 'Intensity map' },
    { path: '/waterfall', icon: '💧', label: 'Waterfall', desc: 'Contribution' },
    { path: '/scatter-plot', icon: '✦', label: 'Scatter Plot', desc: 'Relationships' },
    { path: '/combo-chart', icon: '📉', label: 'Combo Chart', desc: 'Dual axis' },
    { path: '/funnel-chart', icon: '🔻', label: 'Funnel Chart', desc: 'Conversion' },
    { path: '/box-plot', icon: '📦', label: 'Box Plot', desc: 'Distribution' },
  ]},
  { label: 'AI & FORMULAS', color: '#059669', icon: '🤖', tools: [
    { path: '/formula-engine', icon: '⚗️', label: 'Formula Engine', desc: '200+ functions' },
    { path: '/excel-functions', icon: '📗', label: 'Excel Functions', desc: 'Reference guide' },
    { path: '/formula-builder', icon: '🔧', label: 'Formula Builder AI', desc: 'AI-generated' },
    { path: '/ask-your-data', icon: '💬', label: 'Ask Your Data', desc: 'Plain English' },
    { path: '/auto-report', icon: '📄', label: 'Auto Report', desc: 'AI narrative' },
    { path: '/ai-narrative', icon: '✍️', label: 'AI Narrative', desc: 'Story telling' },
    { path: '/conditional-format', icon: '🎨', label: 'Cond. Format', desc: 'Rules engine' },
    { path: '/ai-insights', icon: '🧠', label: 'AI Insights', desc: 'Deep analysis' },
  ]},
  { label: 'OPERATIONS', color: '#d97706', icon: '⚙️', tools: [
    { path: '/scheduled-reports', icon: '⏰', label: 'Scheduled Reports', desc: 'Auto delivery' },
    { path: '/integrations', icon: '🔌', label: 'Integrations', desc: 'Connect tools' },
    { path: '/workspace-roles', icon: '👥', label: 'Workspace & Roles', desc: 'Permissions' },
    { path: '/audit-log', icon: '📜', label: 'Audit Log', desc: 'Activity trail' },
    { path: '/ai-settings', icon: '⚙️', label: 'AI Settings', desc: 'Configure AI' },
    { path: '/executive-dashboard', icon: '📊', label: 'Exec Dashboard', desc: 'C-suite view' },
    { path: '/dashboard-builder', icon: '🎨', label: 'Dashboard Builder', desc: 'Custom layout' },
  ]},
]

const QUICK_ACTIONS = [
  { label: 'Upload Data', path: '/files', icon: '📂', color: '#e91e8c' },
  { label: 'AI Insights', path: '/ai-insights', icon: '🧠', color: '#7c3aed' },
  { label: 'Executive View', path: '/executive-dashboard', icon: '📊', color: '#0097b2' },
  { label: 'Ask Your Data', path: '/ask-your-data', icon: '💬', color: '#059669' },
  { label: 'Auto Report', path: '/auto-report', icon: '📄', color: '#d97706' },
  { label: 'RFM Analysis', path: '/rfm', icon: '🎯', color: '#0c1446' },
]

export default function HubHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState({ files: 0, rows: 0 })
  const [recentFiles, setRecentFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    filesApi.list().then(r => {
      const files = r.data || []
      setStats({ files: files.length, rows: files.reduce((a, f) => a + (f.row_count || 0), 0) })
      setRecentFiles(files.slice(0, 3))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleSection = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }))

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446', letterSpacing: '-0.02em' }}>
            {greeting}, {firstName} 👋
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Files', value: loading ? '—' : stats.files, icon: '📁', color: '#0097b2' },
            { label: 'Total Rows', value: loading ? '—' : stats.rows.toLocaleString(), icon: '📊', color: '#e91e8c' },
            { label: 'Plan', value: user?.organisation?.subscription_tier || 'Trial', icon: '⭐', color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center', minWidth: 100, border: '1px solid #f0f2f8' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.path} onClick={() => navigate(a.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#fff', border: `1px solid #e8eaf4`, borderRadius: 24, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#0c1446', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = a.color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = a.color; e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.15)` }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#0c1446'; e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '20px 24px', marginBottom: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0c1446' }}>📂 Recent Files</div>
            <button onClick={() => navigate('/files')} style={{ fontSize: '0.8rem', color: '#e91e8c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {recentFiles.map(f => (
              <button key={f.id} onClick={() => navigate(`/executive-dashboard?fileId=${f.id}`)}
                style={{ flex: 1, minWidth: 180, padding: '12px 16px', background: '#f8f9ff', border: '1px solid #e8eaf4', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#e91e8c'; e.currentTarget.style.background = '#fff5f9' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.background = '#f8f9ff' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0c1446', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.filename}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{(f.row_count || 0).toLocaleString()} rows · {f.column_count || 0} cols</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Tool Sections */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>All 50 Tools</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SECTIONS.map(({ label, color, icon, tools }) => {
          const isExpanded = expanded[label] !== false  // default expanded
          return (
            <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <button onClick={() => toggleSection(label)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: isExpanded ? '1px solid #f0f2f8' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: color, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{icon}</div>
                  <span style={{ fontWeight: 800, color: '#0c1446', fontSize: '0.9rem', letterSpacing: '0.02em' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>{tools.length} tools</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▼</span>
              </button>
              {isExpanded && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2, padding: 8 }}>
                  {tools.map(({ path, icon: ti, label: tl, desc, tooltip }) => (
                    <div key={path} style={{ position: 'relative' }}>
                      <button onClick={() => navigate(path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s', width: '100%' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#f8f9ff'
                          const tip = e.currentTarget.parentElement.querySelector('.tool-tooltip')
                          if (tip) tip.style.display = 'block'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'none'
                          const tip = e.currentTarget.parentElement.querySelector('.tool-tooltip')
                          if (tip) tip.style.display = 'none'
                        }}>
                        <div style={{ width: 32, height: 32, background: color + '18', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>{ti}</div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c1446', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tl}</div>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{desc}</div>
                        </div>
                      </button>
                      {tooltip && (
                        <div className="tool-tooltip" style={{ display: 'none', position: 'absolute', bottom: '100%', left: 0, zIndex: 50, background: '#0c1446', color: '#fff', fontSize: '0.72rem', padding: '8px 10px', borderRadius: 7, maxWidth: 220, lineHeight: 1.5, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', marginBottom: 4 }}>
                          {tooltip}
                          <div style={{ position: 'absolute', top: '100%', left: 20, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0c1446' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
