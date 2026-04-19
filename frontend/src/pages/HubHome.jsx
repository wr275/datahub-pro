import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi } from '../api'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { label: 'DATA', color: '#0c1446', icon: '🗄️', tools: [
    { path: '/data-table', icon: '📋', label: 'Data View', desc: 'Browse & explore', tooltip: 'Browse and explore your raw data in a spreadsheet-style table with sorting and filtering.' },
    { path: '/data-summary', icon: '📊', label: 'Data Summary', desc: 'Column stats', tooltip: 'View column-level statistics: mean, median, min, max, and null counts at a glance.' },
    { path: '/data-quality', icon: '✅', label: 'Quality Report', desc: 'Missing values', tooltip: 'Instantly find missing values, duplicates, and data inconsistencies in your dataset.' },
    { path: '/data-cleaner', icon: '🧹', label: 'Data Cleaner', desc: 'Fix & dedupe', tooltip: 'Remove duplicates, fix formatting issues, and standardize values across your data.' },
    { path: '/data-blending', icon: '🔀', label: 'Data Blending', desc: 'Merge sources', tooltip: 'Merge two datasets together using a common key column, like a SQL JOIN.' },
    { path: '/advanced-filter', icon: '🔍', label: 'Advanced Filter', desc: 'Complex filters', tooltip: 'Apply complex multi-condition filters across any column to slice your data precisely.' },
    { path: '/kpi-dashboard', icon: '🔢', label: 'KPI Dashboard', desc: 'Key metrics', tooltip: 'Build a live dashboard of your most important metrics with visual indicators.' },
    { path: '/value-frequency', icon: '📊', label: 'Value Frequency', desc: 'Distribution', tooltip: 'See how often each unique value appears in any column — perfect for finding patterns.' },
    { path: '/connect-data', icon: '🔌', label: 'Connect Data', desc: 'Live connectors', tooltip: 'Pull live data from Shopify, QuickBooks and more directly into DataHub — no manual exports needed.' },
    { path: '/data-pipelines', icon: '⚙️', label: 'Data Pipelines', desc: 'Auto transforms', tooltip: 'Build repeatable multi-step transforms: remove nulls, rename columns, filter rows, and join datasets automatically.' },
  ]},
  { label: 'ANALYSIS', color: '#0097b2', icon: '🔬', tools: [
    { path: '/pivot-table', icon: '🔄', label: 'Pivot Table', desc: 'Drag-drop pivots', tooltip: 'Drag and drop rows, columns, and values to summarize your data in seconds.' },
    { path: '/what-if', icon: '🤔', label: 'What-If', desc: 'Scenario model', tooltip: 'Model different scenarios by adjusting key variables and seeing the projected impact instantly.' },
    { path: '/anomaly-detection', icon: '⚠️', label: 'Anomaly Detection', desc: 'Flag outliers', tooltip: 'Automatically flag outliers and unusual data points that deviate from the norm.' },
    { path: '/period-comparison', icon: '📅', label: 'Period Comparison', desc: 'vs prior period', tooltip: 'Compare any time period against a prior period to spot growth or decline.' },
    { path: '/variance-analysis', icon: '📐', label: 'Variance Analysis', desc: 'Actual vs budget', tooltip: 'Measure the gap between actuals and budget across any dimension or category.' },
    { path: '/regression', icon: '📈', label: 'Regression', desc: 'Trend lines', tooltip: 'Fit a trend line to your data and forecast future values using statistical regression.' },
    { path: '/correlation', icon: '🔗', label: 'Correlation Matrix', desc: 'Find patterns', tooltip: 'Discover which columns in your data are strongly related to each other.' },
    { path: '/cohort-analysis', icon: '👥', label: 'Cohort Analysis', desc: 'Retention', tooltip: 'Track how different customer groups behave over time to measure retention and loyalty.' },
    { path: '/churn-risk', icon: '🔥', label: 'Churn Risk Analysis', desc: 'ML churn scoring', tooltip: 'ML-scored churn risk per customer — identify who is likely to leave and take action before they do.' },
    { path: '/trend-analysis', icon: '📉', label: 'Trend Analysis', desc: 'Over time', tooltip: 'Visualise how any metric changes over time with clear trend lines and annotations.' },
    { path: '/rfm', icon: '🎯', label: 'RFM Analysis', desc: 'Customer score', tooltip: 'Score customers by Recency, Frequency, and Monetary value to prioritise outreach.' },
    { path: '/pareto', icon: '📊', label: 'Pareto Analysis', desc: '80/20 rule', tooltip: 'Identify the 20% of factors driving 80% of your results with automatic ranking.' },
    { path: '/segmentation', icon: '🎯', label: 'Segmentation', desc: 'Group customers', tooltip: 'Automatically group your customers or records into meaningful clusters using AI.' },
  ]},
  { label: 'FORECASTING', color: '#7c3aed', icon: '🔮', tools: [
    { path: '/forecasting', icon: '🔮', label: 'Forecasting', desc: 'Predict future', tooltip: 'Project future values based on historical trends using machine learning models.' },
    { path: '/goal-tracker', icon: '🏁', label: 'Goal Tracker', desc: 'Track targets', tooltip: 'Set targets for any KPI and track progress automatically as new data comes in.' },
    { path: '/break-even', icon: '⚖️', label: 'Break-Even', desc: 'BEP analysis', tooltip: 'Calculate the exact sales volume needed to cover costs and reach profitability.' },
    { path: '/rolling-average', icon: '〰️', label: 'Rolling Average', desc: 'Smooth trends', tooltip: 'Smooth noisy data by computing a moving average over any window size.' },
    { path: '/npv', icon: '💰', label: 'NPV Calculator', desc: 'Investment ROI', tooltip: 'Calculate the net present value of an investment to evaluate long-term returns.' },
  ]},
  { label: 'VISUALISE', color: '#e91e8c', icon: '📊', tools: [
    { path: '/bar-chart', icon: '📊', label: 'Bar Chart', desc: 'Compare values', tooltip: 'Create side-by-side bar charts to compare values across categories.' },
    { path: '/line-chart', icon: '📈', label: 'Line Chart', desc: 'Time series', tooltip: 'Plot trends over time with smooth, interactive line charts.' },
    { path: '/pie-chart', icon: '🥧', label: 'Pie Chart', desc: 'Proportions', tooltip: 'Show proportional breakdowns with colour-coded pie or donut charts.' },
    { path: '/heatmap', icon: '🌡️', label: 'Heatmap', desc: 'Intensity map', tooltip: 'Visualise data intensity across two dimensions with a colour gradient map.' },
    { path: '/waterfall', icon: '💧', label: 'Waterfall', desc: 'Contribution', tooltip: 'Break down cumulative changes step by step to show what drove a result.' },
    { path: '/scatter-plot', icon: '✦', label: 'Scatter Plot', desc: 'Relationships', tooltip: 'Plot two variables against each other to reveal correlations and clusters.' },
    { path: '/combo-chart', icon: '📉', label: 'Combo Chart', desc: 'Dual axis', tooltip: 'Overlay a bar and line chart on dual axes to compare volume and rate together.' },
    { path: '/funnel-chart', icon: '🔻', label: 'Funnel Chart', desc: 'Conversion', tooltip: 'Visualise conversion rates across a multi-step process like a sales pipeline.' },
    { path: '/box-plot', icon: '📦', label: 'Box Plot', desc: 'Distribution', tooltip: 'Display the distribution of data including median, quartiles, and outliers.' },
  ]},
  { label: 'AI & FORMULAS', color: '#059669', icon: '🤖', tools: [
    { path: '/formula-engine', icon: '⚗️', label: 'Formula Engine', desc: '200+ functions', tooltip: 'Access over 200 built-in formulas to compute, transform, and enrich your data.' },
    { path: '/excel-functions', icon: '📗', label: 'Excel Functions', desc: 'Reference guide', tooltip: 'Browse a full reference guide to Excel-compatible functions with usage examples.' },
    { path: '/formula-builder', icon: '🔧', label: 'Formula Builder AI', desc: 'AI-generated', tooltip: 'Describe what you want to calculate and AI will write the formula for you.' },
    { path: '/ask-your-data', icon: '💬', label: 'Ask Your Data', desc: 'Plain English', tooltip: 'Type a question in plain English and get instant answers from your dataset.' },
    { path: '/auto-report', icon: '📄', label: 'Auto Report', desc: 'AI narrative', tooltip: 'Generate a written narrative report of key findings, trends, and anomalies from your data in one click using AI.' },
    { path: '/ai-narrative', icon: '✍️', label: 'AI Narrative', desc: 'Story telling', tooltip: 'Turn your data into a compelling written story with automatic insights and commentary.' },
    { path: '/conditional-format', icon: '🎨', label: 'Cond. Format', desc: 'Rules engine', tooltip: 'Apply colour-coded rules to highlight cells based on values, thresholds, or conditions.' },
    { path: '/ai-insights', icon: '🧠', label: 'AI Insights', desc: 'Deep analysis', tooltip: 'Run a deep AI analysis of your dataset to surface hidden patterns and actionable insights.' },
  ]},
  { label: 'FINANCE', color: '#b45309', icon: '💰', tools: [
    { path: '/budget-vs-actuals', icon: '💰', label: 'Budget vs Actuals', desc: 'Variance tracking', tooltip: 'Compare your budgeted figures against actual results to track financial performance.' },
    { path: '/profit-loss', icon: '📋', label: 'P&L Statement', desc: 'Income statement', tooltip: 'Generate a full profit and loss statement from your transaction data automatically.' },
    { path: '/cash-flow', icon: '💵', label: 'Cash Flow', desc: 'Inflow vs outflow', tooltip: 'Track cash coming in and going out over time to monitor your liquidity position.' },
    { path: '/balance-sheet', icon: '⚖️', label: 'Balance Sheet', desc: 'Assets & liabilities', tooltip: 'View a snapshot of your assets, liabilities, and equity at any point in time.' },
    { path: '/financial-ratios', icon: '📐', label: 'Financial Ratios', desc: 'Key indicators', tooltip: 'Calculate key financial ratios like gross margin, ROI, and current ratio from your data.' },
  ]},
  { label: 'OPERATIONS', color: '#d97706', icon: '⚙️', tools: [
    { path: '/scheduled-reports', icon: '⏰', label: 'Scheduled Reports', desc: 'Auto delivery', tooltip: 'Set up automated report delivery to your inbox on a daily, weekly, or monthly schedule.' },
    { path: '/integrations', icon: '🔌', label: 'Integrations', desc: 'Connect tools', tooltip: 'Connect DataHub to your existing tools including Slack, Zapier, and Google Sheets.' },
    { path: '/workspace-roles', icon: '👥', label: 'Workspace & Roles', desc: 'Permissions', tooltip: 'Manage team members, set permissions, and control who can access which data.' },
    { path: '/audit-log', icon: '📜', label: 'Audit Log', desc: 'Activity trail', tooltip: 'Track every action taken in your workspace with a full timestamped activity trail.' },
    { path: '/ai-settings', icon: '⚙️', label: 'AI Settings', desc: 'Configure AI', tooltip: 'Configure your AI preferences, model selection, and prompt templates for your workspace.' },
    { path: '/executive-dashboard', icon: '📊', label: 'Exec Dashboard', desc: 'C-suite view', tooltip: 'View a high-level executive summary of your business performance in one clean dashboard.' },
    { path: '/dashboard-builder', icon: '🎨', label: 'Dashboard Builder', desc: 'Custom layout', tooltip: 'Build fully custom analytics dashboards with drag-and-drop charts and widgets.' },
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
  const [searchQuery, setSearchQuery] = useState('')
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
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>50+ Tools</div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 10, color: '#9ca3af', fontSize: '0.85rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: searchQuery ? 28 : 10, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.82rem', outline: 'none', width: 200, color: '#374151' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SECTIONS.map(({ label, color, icon, tools }) => {
          const filteredTools = searchQuery.trim()
            ? tools.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || (t.tooltip && t.tooltip.toLowerCase().includes(searchQuery.toLowerCase())))
            : tools
          if (searchQuery.trim() && filteredTools.length === 0) return null
          const isExpanded = searchQuery.trim() ? true : expanded[label] !== false
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
                  {filteredTools.map(({ path, icon: ti, label: tl, desc, tooltip }) => (
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
