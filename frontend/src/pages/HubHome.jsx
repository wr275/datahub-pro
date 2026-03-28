import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi } from '../api'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { label: 'DATA', color: '#0c1446', icon: 'ðï¸', tools: [
    { path: '/data-table', icon: 'ð', label: 'Data View', desc: 'Browse & explore', tooltip: 'View, sort, search and paginate every row and column in your uploaded file. Apply quick filters to find exactly what you need.' },
    { path: '/data-summary', icon: 'ð', label: 'Data Summary', desc: 'Column stats', tooltip: 'Get instant statistical summaries for every column â count, mean, min, max, and standard deviation â for both numeric and text columns.' },
    { path: '/data-quality', icon: 'â', label: 'Quality Report', desc: 'Missing values', tooltip: 'Scan your dataset for missing values, duplicates, and type inconsistencies. Get a completeness score and actionable fix recommendations.' },
    { path: '/data-cleaner', icon: 'ð§¹', label: 'Data Cleaner', desc: 'Fix & dedupe', tooltip: 'Remove duplicates, fill or drop nulls, trim whitespace, standardise formats, and rename columns â all without writing a single line of code.' },
    { path: '/data-blending', icon: 'ð', label: 'Data Blending', desc: 'Merge sources', tooltip: 'Join two datasets on a common key using inner, left, or full outer joins to create a unified view across multiple sources.' },
    { path: '/advanced-filter', icon: 'ð', label: 'Advanced Filter', desc: 'Complex filters', tooltip: 'Apply multi-condition filters with AND/OR logic, comparison operators, and custom sort orders to slice your dataset with precision.' },
    { path: '/kpi-dashboard', icon: 'ð¢', label: 'KPI Dashboard', desc: 'Key metrics', tooltip: 'Auto-generate KPI cards for every numeric column â totals, averages, min/max â laid out in a clean, shareable dashboard.' },
    { path: '/value-frequency', icon: 'ð', label: 'Value Frequency', desc: 'Distribution', tooltip: 'Count how often each unique value appears in any column and visualise the distribution as a bar chart or ranked table.' },
    { path: '/connect-data', icon: 'ð', label: 'Connect Data', desc: 'Live connectors', tooltip: 'Pull live data from Shopify, QuickBooks and more directly into DataHub â no manual exports needed.' },
    { path: '/data-pipelines', icon: 'âï¸', label: 'Data Pipelines', desc: 'Auto transforms', tooltip: 'Build repeatable multi-step transforms: remove nulls, rename columns, filter rows, and join datasets automatically.' },
  ]},
  { label: 'ANALYSIS', color: '#0097b2', icon: 'ð¬', tools: [
    { path: '/pivot-table', icon: 'ð', label: 'Pivot Table', desc: 'Drag-drop pivots', tooltip: 'Drag and drop rows, columns, and values to create pivot tables â summarise, group, and aggregate your data without Excel.' },
    { path: '/what-if', icon: 'ð¤', label: 'What-If', desc: 'Scenario model', tooltip: 'Adjust key inputs with sliders and see how outcomes change in real time. Ideal for pricing, capacity planning, and growth scenarios.' },
    { path: '/anomaly-detection', icon: 'â ï¸', label: 'Anomaly Detection', desc: 'Flag outliers', tooltip: 'Automatically flag rows or values that fall outside expected statistical ranges using z-score and IQR detection methods.' },
    { path: '/period-comparison', icon: 'ð', label: 'Period Comparison', desc: 'vs prior period', tooltip: 'Compare metrics side by side across different time periods â month over month, quarter over quarter, or any custom date range.' },
    { path: '/variance-analysis', icon: 'ð', label: 'Variance Analysis', desc: 'Actual vs budget', tooltip: 'Calculate absolute and percentage variances between actuals and budget with colour-coded over/under formatting for every line item.' },
        { path: '/budget-actuals', icon: 'ð°', label: 'Budget vs Actuals', desc: 'Budget vs actual variance reports', tooltip: 'Import budget and actuals CSVs to generate variance reports with auto-generated commentary for every line item. Supports monthly, quarterly and annual views.' },
    { path: '/regression', icon: 'ð', label: 'Regression', desc: 'Trend lines', tooltip: 'Fit linear and polynomial trend lines to your data, review RÂ² scores, and forecast future values based on historical patterns.' },
    { path: '/correlation', icon: 'ð', label: 'Correlation Matrix', desc: 'Find patterns', tooltip: 'Compute pairwise correlations between all numeric columns and visualise them as a colour-coded heatmap to surface hidden relationships.' },
    { path: '/cohort-analysis', icon: 'ð¥', label: 'Cohort Analysis', desc: 'Retention', tooltip: 'Group customers by acquisition date and track how each cohort behaves over time â ideal for retention, churn, and LTV analysis.' },
    { path: '/trend-analysis', icon: 'ð', label: 'Trend Analysis', desc: 'Over time', tooltip: 'Chart any metric over time with smoothing options, rolling averages, and year-on-year overlays to spot trends and seasonality.' },
    { path: '/rfm', icon: 'ð¯', label: 'RFM Analysis', desc: 'Customer score', tooltip: 'Score every customer on Recency, Frequency, and Monetary value to identify your best customers, at-risk churners, and untapped growth.' },
    { path: '/pareto', icon: 'ð', label: 'Pareto Analysis', desc: '80/20 rule', tooltip: 'Identify the 20% of products, customers, or issues driving 80% of your results with a ranked cumulative contribution chart.' },
    { path: '/segmentation', icon: 'ð¯', label: 'Segmentation', desc: 'Group customers', tooltip: 'Cluster your customers or records into meaningful groups using rule-based logic to personalise campaigns and prioritise outreach.' },
  ]},
  { label: 'FORECASTING', color: '#7c3aed', icon: 'ð®', tools: [
    { path: '/forecasting', icon: 'ð®', label: 'Forecasting', desc: 'Predict future', tooltip: 'Project future values using moving averages, exponential smoothing, or linear extrapolation based on your historical data.' },
    { path: '/goal-tracker', icon: 'ð', label: 'Goal Tracker', desc: 'Track targets', tooltip: 'Set numeric targets for any metric and visually track progress against actuals with gap calculations and status indicators.' },
    { path: '/break-even', icon: 'âï¸', label: 'Break-Even', desc: 'BEP analysis', tooltip: 'Calculate your break-even point by entering fixed costs, variable costs, and price per unit. See margin of safety and sensitivity analysis.' },
    { path: '/rolling-average', icon: 'ã°ï¸', label: 'Rolling Average', desc: 'Smooth trends', tooltip: 'Smooth noisy time-series data with configurable rolling average windows â 7-day, 30-day, or custom â to reveal the underlying trend.' },
    { path: '/npv', icon: 'ð°', label: 'NPV Calculator', desc: 'Investment ROI', tooltip: 'Model multi-year cash flows and calculate Net Present Value, Internal Rate of Return, and payback period for any investment or project.' },
  ]},
  { label: 'VISUALISE', color: '#e91e8c', icon: 'ð', tools: [
    { path: '/bar-chart', icon: 'ð', label: 'Bar Chart', desc: 'Compare values', tooltip: 'Create vertical or horizontal bar charts to compare values across categories. Supports grouping, stacking, and custom colour coding.' },
    { path: '/line-chart', icon: 'ð', label: 'Line Chart', desc: 'Time series', tooltip: 'Plot time series or continuous data as smooth line charts with multiple series, custom axes, and optional trend line overlays.' },
    { path: '/pie-chart', icon: 'ð¥§', label: 'Pie Chart', desc: 'Proportions', tooltip: 'Visualise proportional breakdowns as pie or donut charts. Great for market share, budget allocation, or category distribution.' },
    { path: '/heatmap', icon: 'ð¡ï¸', label: 'Heatmap', desc: 'Intensity map', tooltip: 'Plot a two-dimensional matrix colour-coded by value intensity to spot patterns across rows and columns at a glance.' },
    { path: '/waterfall', icon: 'ð§', label: 'Waterfall', desc: 'Contribution', tooltip: 'Show how individual positive and negative components add up to a final total â perfect for profit bridges and variance walk-throughs.' },
    { path: '/scatter-plot', icon: 'â¦', label: 'Scatter Plot', desc: 'Relationships', tooltip: 'Plot two numeric variables against each other to identify correlations, clusters, and outliers across your dataset.' },
    { path: '/combo-chart', icon: 'ð', label: 'Combo Chart', desc: 'Dual axis', tooltip: 'Overlay a bar chart and a line chart on a dual axis to compare two metrics with different scales in a single view.' },
    { path: '/funnel-chart', icon: 'ð»', label: 'Funnel Chart', desc: 'Conversion', tooltip: 'Visualise drop-off and conversion rates at each stage of a pipeline â sales funnel, hiring process, or marketing journey.' },
    { path: '/box-plot', icon: 'ð¦', label: 'Box Plot', desc: 'Distribution', tooltip: 'Display the statistical spread of a dataset â median, quartiles, and outliers â using the standard box-and-whisker format.' },
  ]},
  { label: 'AI & FORMULAS', color: '#059669', icon: 'ð¤', tools: [
    { path: '/formula-engine', icon: 'âï¸', label: 'Formula Engine', desc: '200+ functions', tooltip: 'Run 200+ built-in formulas across your data â VLOOKUP, SUMIF, date functions, text manipulation â without needing to open Excel.' },
    { path: '/excel-functions', icon: 'ð', label: 'Excel Functions', desc: 'Reference guide', tooltip: 'Browse a complete reference guide for Excel-compatible functions with examples, syntax, and real-world use cases for each one.' },
    { path: '/formula-builder', icon: 'ð§', label: 'Formula Builder AI', desc: 'AI-generated', tooltip: 'Describe what you want to calculate in plain English and AI will write the correct formula expression for you instantly.' },
    { path: '/ask-your-data', icon: 'ð¬', label: 'Ask Your Data', desc: 'Plain English', tooltip: 'Type any question about your dataset in plain English and get a data-driven answer instantly â no SQL or formulas needed.' },
    { path: '/auto-report', icon: 'ð', label: 'Auto Report', desc: 'AI narrative', tooltip: 'Generate a written narrative report of key findings, trends, and anomalies from your data in one click using AI.' },
    { path: '/ai-narrative', icon: 'âï¸', label: 'AI Narrative', desc: 'Story telling', tooltip: 'Turn any chart or table into a written story â AI generates plain-English commentary explaining what the data means and why it matters.' },
    { path: '/conditional-format', icon: 'ð¨', label: 'Cond. Format', desc: 'Rules engine', tooltip: 'Apply colour-coded highlighting rules to flag specific values, thresholds, or conditions across any column â like Excel conditional formatting.' },
    { path: '/ai-insights', icon: 'ð§ ', label: 'AI Insights', desc: 'Deep analysis', tooltip: 'Run a full automated analysis of your dataset and surface key findings, data quality issues, and actionable business recommendations.' },
  ]},
  { label: 'OPERATIONS', color: '#d97706', icon: 'âï¸', tools: [
    { path: '/scheduled-reports', icon: 'â°', label: 'Scheduled Reports', desc: 'Auto delivery', tooltip: 'Set up recurring reports to run automatically on a schedule and deliver results to your inbox or team channel â daily, weekly, or monthly.' },
    { path: '/integrations', icon: 'ð', label: 'Integrations', desc: 'Connect tools', tooltip: 'Connect DataHub Pro with your existing tools â CRMs, accounting software, and cloud storage â for a seamless end-to-end data workflow.' },
    { path: '/workspace-roles', icon: 'ð¥', label: 'Workspace & Roles', desc: 'Permissions', tooltip: 'Invite team members, assign viewer or editor roles, and control who can access which datasets and tools in your workspace.' },
    { path: '/audit-log', icon: 'ð', label: 'Audit Log', desc: 'Activity trail', tooltip: 'Track every action in your workspace â file uploads, report runs, and user logins â for compliance, security, and accountability.' },
    { path: '/ai-settings', icon: 'âï¸', label: 'AI Settings', desc: 'Configure AI', tooltip: 'Configure your AI model preferences, API connections, and insight generation behaviour to tailor the AI experience to your needs.' },
    { path: '/executive-dashboard', icon: 'ð', label: 'Exec Dashboard', desc: 'C-suite view', tooltip: 'A single-page executive summary with auto-loaded KPI cards, trend lines, and category breakdowns â ready to share in any boardroom meeting.' },
    { path: '/dashboard-builder', icon: 'ð¨', label: 'Dashboard Builder', desc: 'Custom layout', tooltip: 'Drag and drop charts, tables, and KPI widgets to build a fully custom dashboard layout and save it as a shareable view for your team.' },
  ]},
]

const QUICK_ACTIONS = [
  { label: 'Upload Data', path: '/files', icon: 'ð', color: '#e91e8c' },
  { label: 'AI Insights', path: '/ai-insights', icon: 'ð§ ', color: '#7c3aed' },
  { label: 'Executive View', path: '/executive-dashboard', icon: 'ð', color: '#0097b2' },
  { label: 'Ask Your Data', path: '/ask-your-data', icon: 'ð¬', color: '#059669' },
  { label: 'Auto Report', path: '/auto-report', icon: 'ð', color: '#d97706' },
  { label: 'RFM Analysis', path: '/rfm', icon: 'ð¯', color: '#0c1446' },
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
            {greeting}, {firstName} ð
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Files', value: loading ? 'â' : stats.files, icon: 'ð', color: '#0097b2' },
            { label: 'Total Rows', value: loading ? 'â' : stats.rows.toLocaleString(), icon: 'ð', color: '#e91e8c' },
            { label: 'Plan', value: user?.organisation?.subscription_tier || 'Trial', icon: 'â­', color: '#7c3aed' },
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
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0c1446' }}>ð Recent Files</div>
            <button onClick={() => navigate('/files')} style={{ fontSize: '0.8rem', color: '#e91e8c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all â</button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {recentFiles.map(f => (
              <button key={f.id} onClick={() => navigate(`/executive-dashboard?fileId=${f.id}`)}
                style={{ flex: 1, minWidth: 180, padding: '12px 16px', background: '#f8f9ff', border: '1px solid #e8eaf4', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#e91e8c'; e.currentTarget.style.background = '#fff5f9' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.background = '#f8f9ff' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0c1446', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ð {f.filename}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{(f.row_count || 0).toLocaleString()} rows Â· {f.column_count || 0} cols</div>
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
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>â¼</span>
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
