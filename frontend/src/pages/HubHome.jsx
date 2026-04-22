import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi, organisationApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

// Non-AI sections only. The AI section is surfaced in its own tab so
// clients without the add-on see a clean workspace that doesn't advertise
// features they can't use.
const WORKSPACE_SECTIONS = [
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
  { label: 'FORMULAS', color: '#059669', icon: '⚗️', tools: [
    { path: '/formula-engine', icon: '⚗️', label: 'Formula Engine', desc: '200+ functions', tooltip: 'Access over 200 built-in formulas to compute, transform, and enrich your data.' },
    { path: '/excel-functions', icon: '📗', label: 'Excel Functions', desc: 'Reference guide', tooltip: 'Browse a full reference guide to Excel-compatible functions with usage examples.' },
    { path: '/conditional-format', icon: '🎨', label: 'Cond. Format', desc: 'Rules engine', tooltip: 'Apply colour-coded rules to highlight cells based on values, thresholds, or conditions.' },
  ]},
  { label: 'FINANCE', color: '#b45309', icon: '💰', tools: [
    { path: '/budget-actuals', icon: '💰', label: 'Budget vs Actuals', desc: 'Variance tracking', tooltip: 'Compare your budgeted figures against actual results to track financial performance.' },
    { path: '/npv', icon: '💸', label: 'NPV Calculator', desc: 'Investment ROI', tooltip: 'Calculate the net present value of an investment to evaluate long-term returns.' },
  ]},
  { label: 'OPERATIONS', color: '#d97706', icon: '⚙️', tools: [
    { path: '/scheduled-reports', icon: '⏰', label: 'Scheduled Reports', desc: 'Auto delivery', tooltip: 'Set up automated report delivery to your inbox on a daily, weekly, or monthly schedule.' },
    { path: '/integrations', icon: '🔌', label: 'Integrations', desc: 'Connect tools', tooltip: 'Connect DataHub to your existing tools including Slack, Zapier, and Google Sheets.' },
    { path: '/sharepoint', icon: '📁', label: 'SharePoint', desc: 'Microsoft 365', tooltip: 'Sync files and data from SharePoint and OneDrive directly into your workspace.' },
    { path: '/workspace-roles', icon: '👥', label: 'Workspace & Roles', desc: 'Permissions', tooltip: 'Manage team members, set permissions, and control who can access which data.' },
    { path: '/audit-log', icon: '📜', label: 'Audit Log', desc: 'Activity trail', tooltip: 'Track every action taken in your workspace with a full timestamped activity trail.' },
    { path: '/executive-dashboard', icon: '📊', label: 'Exec Dashboard', desc: 'C-suite view', tooltip: 'View a high-level executive summary of your business performance in one clean dashboard.' },
    { path: '/dashboard-builder', icon: '🎨', label: 'Dashboard Builder', desc: 'Custom layout', tooltip: 'Build fully custom analytics dashboards with drag-and-drop charts and widgets.' },
  ]},
]

// AI tools surfaced on the AI tab only. Keeping these in a separate constant
// makes it obvious what the entitlement unlocks.
const AI_TOOLS = [
  { path: '/ask-your-data', icon: '💬', label: 'Ask Your Data', desc: 'Plain English Q&A', tooltip: 'Type a question in plain English and get instant answers from your dataset.' },
  { path: '/ai-insights', icon: '🧠', label: 'AI Insights', desc: 'Deep pattern mining', tooltip: 'Run a deep AI analysis of your dataset to surface hidden patterns and actionable insights.' },
  { path: '/ai-narrative', icon: '✍️', label: 'AI Narrative', desc: 'Story from data', tooltip: 'Turn your data into a compelling written story with automatic insights and commentary.' },
  { path: '/auto-report', icon: '📄', label: 'Auto Report', desc: 'One-click report', tooltip: 'Generate a written narrative report of key findings, trends, and anomalies from your data in one click using AI.' },
  { path: '/formula-builder', icon: '🔧', label: 'Formula Builder AI', desc: 'Describe → formula', tooltip: 'Describe what you want to calculate and AI will write the formula for you.' },
  { path: '/ai-settings', icon: '⚙️', label: 'AI Settings', desc: 'Model & prompts', tooltip: 'Configure your AI preferences, model selection, and prompt templates for your workspace.' },
]

const AI_SUGGESTIONS = [
  'Summarise my latest upload',
  'Find anomalies in my sales data',
  'What are my top 5 customers by revenue?',
  'Draft a one-page executive summary',
]

// Quick Actions sit on the Workspace tab only — AI entries are filtered out
// downstream (see QUICK_ACTIONS.filter below) because AI has its own tab.
// Everything here should be broadly useful regardless of add-on status.
const QUICK_ACTIONS = [
  { label: 'Upload Data', path: '/files', icon: '📂', color: '#e91e8c' },
  { label: 'Executive View', path: '/executive-dashboard', icon: '📊', color: '#0097b2' },
  { label: 'KPI Dashboard', path: '/kpi-dashboard', icon: '🔢', color: '#7c3aed' },
  { label: 'Data View', path: '/data-table', icon: '📋', color: '#0c1446' },
  { label: 'Pivot Table', path: '/pivot-table', icon: '🔄', color: '#059669' },
  { label: 'Forecasting', path: '/forecasting', icon: '🔮', color: '#d97706' },
]

export default function HubHome() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [stats, setStats] = useState({ files: 0, rows: 0 })
  const [recentFiles, setRecentFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [enablingAi, setEnablingAi] = useState(false)
  const [requestingAccess, setRequestingAccess] = useState(false)
  const [tab, setTab] = useState('workspace') // 'workspace' | 'ai'
  const [prompt, setPrompt] = useState('')
  // Which sample template (if any) is currently being seeded — used to
  // disable other CTAs and show a spinner without blocking the whole UI.
  const [seeding, setSeeding] = useState(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const aiEnabled = !!(user?.organisation?.ai_enabled ?? user?.ai_enabled)
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin'
  // Zero-file workspaces get a dedicated empty-state that funnels the user
  // towards either sample data or an upload — both paths end on a populated
  // dashboard, which is the point of the onboarding flow.
  const hasFiles = stats.files > 0

  useEffect(() => {
    filesApi.list().then(r => {
      const files = r.data || []
      setStats({ files: files.length, rows: files.reduce((a, f) => a + (f.row_count || 0), 0) })
      setRecentFiles(files.slice(0, 3))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSeedSample = async (templateId) => {
    setSeeding(templateId)
    try {
      const res = await filesApi.seedSample(templateId)
      const fileId = res.data?.id
      if (!fileId) throw new Error('No file id returned')
      toast.success('Loading your sample dashboard…')
      // first_run=true tells ExecutiveDashboard to fire the audit event and
      // show the "here's what we detected" banner so auto-generation feels
      // deliberate, not magical.
      navigate(`/executive-dashboard?fileId=${fileId}&first_run=true`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load sample data')
      setSeeding(null)
    }
  }

  const toggleSection = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }))

  const handleEnableAi = async () => {
    setEnablingAi(true)
    try {
      await organisationApi.setAiEnabled(true)
      await refreshUser()
      toast.success('AI features are now enabled for your workspace')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not enable AI')
    } finally {
      setEnablingAi(false)
    }
  }

  const handleRequestAccess = async () => {
    setRequestingAccess(true)
    try {
      const res = await organisationApi.requestAiAccess()
      const ownerEmail = res.data?.owner_email
      if (res.data?.email_sent) {
        toast.success(ownerEmail ? `Request sent to ${ownerEmail}` : 'Request sent to your workspace owner')
      } else if (res.data?.already_enabled) {
        toast.success('AI is already enabled — refresh to see the tools')
        await refreshUser()
      } else {
        toast.success(ownerEmail ? `We've logged your request for ${ownerEmail}` : 'We\'ve logged your request — your owner can enable AI from Settings')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send the request')
    } finally {
      setRequestingAccess(false)
    }
  }

  const submitAiPrompt = () => {
    const q = prompt.trim()
    if (!q) {
      navigate('/ask-your-data')
      return
    }
    navigate(`/ask-your-data?q=${encodeURIComponent(q)}&autosubmit=1`)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
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

      {/* Chrome-style tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e8eaf4', marginBottom: 24 }}>
        <TabButton
          active={tab === 'workspace'}
          onClick={() => setTab('workspace')}
          label="Workspace"
          icon="📊"
          count={`${WORKSPACE_SECTIONS.reduce((a, s) => a + s.tools.length, 0)} tools`}
        />
        <TabButton
          active={tab === 'ai'}
          onClick={() => setTab('ai')}
          label="AI"
          icon="🤖"
          count={aiEnabled ? `${AI_TOOLS.length} tools` : 'Add-on'}
          locked={!aiEnabled}
          highlight
        />
      </div>

      {tab === 'workspace' ? (
        <WorkspaceTab
          navigate={navigate}
          recentFiles={recentFiles}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          expanded={expanded}
          toggleSection={toggleSection}
          hasFiles={hasFiles}
          seeding={seeding}
          handleSeedSample={handleSeedSample}
          loading={loading}
        />
      ) : (
        <AiTab
          aiEnabled={aiEnabled}
          isOwnerOrAdmin={isOwnerOrAdmin}
          enablingAi={enablingAi}
          requestingAccess={requestingAccess}
          handleEnableAi={handleEnableAi}
          handleRequestAccess={handleRequestAccess}
          prompt={prompt}
          setPrompt={setPrompt}
          submitAiPrompt={submitAiPrompt}
          firstName={firstName}
          navigate={navigate}
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function TabButton({ active, onClick, label, icon, count, locked, highlight }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 20px',
        background: active ? '#fff' : 'transparent',
        border: 'none',
        borderBottom: active ? '3px solid #e91e8c' : '3px solid transparent',
        borderRadius: '8px 8px 0 0',
        cursor: 'pointer',
        fontSize: '0.92rem',
        fontWeight: active ? 800 : 600,
        color: active ? '#0c1446' : '#6b7280',
        transition: 'all 0.15s',
        marginBottom: -1,
      }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span>{label}</span>
      {count && (
        <span style={{
          padding: '2px 9px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
          background: highlight && !active ? '#ede9fe' : '#f3f4f6',
          color: highlight && !active ? '#6d28d9' : '#6b7280',
          marginLeft: 2,
        }}>
          {locked ? '🔒 ' : ''}{count}
        </span>
      )}
    </button>
  )
}

function WorkspaceTab({ navigate, recentFiles, searchQuery, setSearchQuery, expanded, toggleSection, hasFiles, seeding, handleSeedSample, loading }) {
  return (
    <>
      {/* Empty-state: takes over the top of the page until the org has its
          first file. Both CTAs funnel the user to a populated dashboard —
          that's the whole point of the 120-second wow moment. Everything
          below (tool sections) stays visible so nothing feels hidden. */}
      {!loading && !hasFiles ? (
        <OnboardingEmptyState
          navigate={navigate}
          seeding={seeding}
          handleSeedSample={handleSeedSample}
        />
      ) : (
        <div style={{ marginBottom: 24 }} data-tour="upload-btn">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {QUICK_ACTIONS
              .filter(a => !['/ai-insights', '/ask-your-data', '/auto-report', '/ai-narrative', '/formula-builder', '/ai-settings'].includes(a.path))
              .map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#fff', border: `1px solid #e8eaf4`, borderRadius: 24, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#0c1446', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = a.color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = a.color; e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.15)` }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#0c1446'; e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
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

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>All tools</div>
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

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {WORKSPACE_SECTIONS.map(({ label, color, icon, tools }) => {
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
    </>
  )
}

function AiTab({
  aiEnabled, isOwnerOrAdmin, enablingAi, requestingAccess,
  handleEnableAi, handleRequestAccess, prompt, setPrompt,
  submitAiPrompt, firstName, navigate,
}) {
  if (!aiEnabled) {
    return (
      <div style={{
        background: 'linear-gradient(135deg,#faf5ff 0%,#f5f3ff 50%,#fdf4ff 100%)',
        border: '1px solid #e9d5ff',
        borderRadius: 20, padding: '48px 40px', textAlign: 'center',
      }}>
        <div style={{
          width: 84, height: 84, margin: '0 auto 20px',
          background: 'linear-gradient(135deg,#7c3aed,#c026d3)',
          borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.4rem', boxShadow: '0 8px 24px rgba(124,58,237,0.3)',
        }}>🤖</div>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.55rem', fontWeight: 900, color: '#0c1446' }}>
          Unlock your AI workspace
        </h2>
        <p style={{ margin: '0 auto 8px', color: '#4a5280', fontSize: '0.98rem', lineHeight: 1.6, maxWidth: 540 }}>
          Ask questions in plain English, generate narrative reports, spot anomalies,
          and build formulas from descriptions — all powered by Claude.
        </p>
        <p style={{ margin: '0 auto 28px', color: '#6b7280', fontSize: '0.85rem', maxWidth: 540 }}>
          Your workspace analytics (charts, pivots, forecasts) work the same with or without this.
        </p>

        {/* Preview of what's included — tool name chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 620, margin: '0 auto 32px' }}>
          {AI_TOOLS.map(t => (
            <span key={t.path} style={{
              padding: '6px 14px', background: 'rgba(255,255,255,0.7)',
              border: '1px solid #e9d5ff', borderRadius: 20,
              fontSize: '0.78rem', fontWeight: 600, color: '#6d28d9',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span>{t.icon}</span> {t.label}
            </span>
          ))}
        </div>

        {isOwnerOrAdmin ? (
          <>
            <button onClick={handleEnableAi} disabled={enablingAi}
              className="btn-primary"
              style={{ padding: '14px 36px', fontSize: '0.98rem', fontWeight: 800, minWidth: 260, borderRadius: 10 }}>
              {enablingAi ? 'Enabling…' : 'Enable AI for this workspace'}
            </button>
            <div style={{ marginTop: 14, fontSize: '0.78rem', color: '#6b7280' }}>
              Takes effect immediately. You can turn it off anytime from Settings.
            </div>
          </>
        ) : (
          <>
            <button onClick={handleRequestAccess} disabled={requestingAccess}
              className="btn-primary"
              style={{ padding: '14px 36px', fontSize: '0.98rem', fontWeight: 800, minWidth: 260, borderRadius: 10 }}>
              {requestingAccess ? 'Sending request…' : 'Request AI access'}
            </button>
            <div style={{ marginTop: 14, fontSize: '0.78rem', color: '#6b7280' }}>
              We'll email your workspace owner. They can enable it with one click.
            </div>
          </>
        )}
      </div>
    )
  }

  // Unlocked — ChatGPT/Claude-style landing
  return (
    <div>
      {/* Hero chat */}
      <div style={{
        background: '#fff', borderRadius: 20,
        border: '1px solid #e9d5ff',
        padding: '48px 32px 36px',
        boxShadow: '0 4px 24px rgba(124,58,237,0.08)',
        marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 16px',
          background: 'linear-gradient(135deg,#7c3aed,#c026d3)',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.9rem', boxShadow: '0 6px 18px rgba(124,58,237,0.3)',
        }}>🤖</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>
          How can I help, {firstName}?
        </h2>
        <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.92rem' }}>
          Ask anything about your data. Powered by Claude.
        </p>

        {/* Prompt input */}
        <div style={{
          maxWidth: 720, margin: '0 auto',
          display: 'flex', gap: 8, alignItems: 'stretch',
          background: '#f9fafb', borderRadius: 14, padding: 6,
          border: '1px solid #e5e7eb',
        }}>
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitAiPrompt()}
            placeholder="Ask your data… e.g. summarise my latest upload"
            style={{
              flex: 1, padding: '14px 16px', background: 'transparent',
              border: 'none', outline: 'none', fontSize: '0.95rem', color: '#0c1446',
            }}
          />
          <button onClick={submitAiPrompt}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>
            Ask →
          </button>
        </div>

        {/* Suggested prompts */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          {AI_SUGGESTIONS.map(s => (
            <button key={s}
              onClick={() => navigate(`/ask-your-data?q=${encodeURIComponent(s)}&autosubmit=1`)}
              style={{
                padding: '8px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb',
                borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer', color: '#374151',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.color = '#6d28d9' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* AI tools grid */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          AI Tools
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {AI_TOOLS.map(({ path, icon, label, desc, tooltip }) => (
          <button key={path} onClick={() => navigate(path)}
            title={tooltip}
            style={{
              background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12,
              padding: '18px 18px', textAlign: 'left', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: 'linear-gradient(135deg,#ede9fe,#fae8ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem',
            }}>{icon}</div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0c1446', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}


// Zero-files onboarding card. The primary CTA is sample data (instant wow)
// because the common failure mode is "user signs up, sees empty workspace,
// has nothing to explore, leaves". The secondary CTA is the real upload
// path. The three sample tiles are labelled by buyer persona so a finance
// user, marketer, or ops manager all see something recognisable.
function OnboardingEmptyState({ navigate, seeding, handleSeedSample }) {
  const SAMPLES = [
    { id: 'uk_smb_sales', icon: '💼', label: 'Sales Performance', desc: '24 months × 4 regions' },
    { id: 'marketing_campaigns', icon: '📣', label: 'Marketing Campaigns', desc: 'Spend, clicks, ROI by channel' },
    { id: 'operations_pipeline', icon: '⚙️', label: 'Operations Pipeline', desc: 'Budgets, status, completion' },
  ]
  const disabled = !!seeding
  return (
    <div style={{
      background: 'linear-gradient(135deg,#fff 0%,#fef6fb 100%)',
      border: '1px solid #f9d6e8',
      borderRadius: 18,
      padding: '32px 36px',
      marginBottom: 28,
      boxShadow: '0 4px 20px rgba(233,30,140,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ display: 'inline-block', background: '#fce7f3', color: '#be185d', padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
            Get started
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0c1446', letterSpacing: '-0.01em' }}>
            See your first dashboard in 30 seconds
          </h2>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.92rem', maxWidth: 560, lineHeight: 1.5 }}>
            Pick a sample dataset to see DataHub Pro in action — or upload your own CSV or Excel file. Either way, your dashboard will be live before your kettle boils.
          </p>
        </div>
        <button
          onClick={() => navigate('/files')}
          disabled={disabled}
          data-tour="upload-btn"
          style={{
            padding: '12px 22px', background: '#fff', border: '1.5px solid #e8eaf4',
            borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.9rem', color: '#0c1446',
            opacity: disabled ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = '#0c1446'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0c1446' } }}
          onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#0c1446'; e.currentTarget.style.borderColor = '#e8eaf4' } }}>
          <span>📂</span> Upload my own file
        </button>
      </div>

      <div data-tour="sample-picker" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {SAMPLES.map(s => {
          const isLoading = seeding === s.id
          return (
            <button key={s.id}
              onClick={() => handleSeedSample(s.id)}
              disabled={disabled}
              style={{
                background: '#fff', border: '1.5px solid #e8eaf4', borderRadius: 12,
                padding: '18px 18px', textAlign: 'left',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !isLoading ? 0.5 : 1,
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 14, minHeight: 76,
              }}
              onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = '#e91e8c'; e.currentTarget.style.background = '#fff5f9'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(0)' } }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: 'linear-gradient(135deg,#fce7f3,#fbcfe8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem',
              }}>{isLoading ? '⏳' : s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0c1446', marginBottom: 3 }}>
                  {isLoading ? 'Loading…' : s.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{s.desc}</div>
              </div>
              {!isLoading && (
                <span style={{ color: '#e91e8c', fontWeight: 700, fontSize: '1.1rem' }}>→</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
