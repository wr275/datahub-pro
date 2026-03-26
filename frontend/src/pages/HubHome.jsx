import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import api from '../api'

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
  ]},
  { label: 'ANALYSIS', color: '#0097b2', icon: '🔬', tools: [
    { path: '/pivot-table', icon: '🔄', label: 'Pivot Table', desc: 'Drag-drop pivots' },
    { path: '/what-if', icon: '🤔', label: 'What-If', desc: 'Scenario model' },
    { path: '/anomaly-detection', icon: '⚠️', label: 'Anomaly Detection', desc: 'Flag outliers' },
    { path: '/period-comparison', icon: '📅', label: 'Period Comparison', desc: 'vs prior period' },
    { path: '/variance-analysis', icon: '📐', label: 'Variance Analysis', desc: 'Actual vs budget' },
    { path: '/regression', icon: '📈', label: 'Regression', desc: 'Trend lines' },
    { path: '/correlation', icon: '🔗', label: 'Correlation Matrix', desc: 'Find patterns' },
    { path: '/cohort-analysis', icon: '👥', label: 'Cohort Analysis', desc: 'Retention' },
    { path: '/trend-analysis', icon: '📉', label: 'Trend Analysis', desc: 'Over time' },
    { path: '/rfm', icon: '🎯', label: 'RFM Analysis', desc: 'Customer score' },
    { path: '/pareto', icon: '80%', label: 'Pareto Analysis', desc: '80/20 rule' },
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

const SUGGESTED_PROMPTS = [
  'What are the top 5 performers in my dataset?',
  'Summarise key trends and anomalies',
  'Which columns have the most missing data?',
  'What is the average and range of my numeric columns?',
  'Are there any obvious outliers I should investigate?',
  'Give me a plain-English executive summary of this data',
]

// ── AI Assistant Tab ──────────────────────────────────────────────────────────

function AIAssistant({ files }) {
  const [selectedFile, setSelectedFile] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const prompt = text || input.trim()
    if (!prompt || !selectedFile) return
    setInput('')

    const userMsg = { role: 'user', content: prompt, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await api.post('/ai/prompt', { prompt, file_id: selectedFile })
      const aiMsg = { role: 'assistant', content: res.data.response, ts: Date.now() }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'error', content: errMsg, ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const selectedFileName = files.find(f => f.id === selectedFile)?.original_filename || ''

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 220px)', minHeight: 480 }}>

      {/* Left panel — file selector + suggestions */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* File selector */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dataset</div>
          <select
            value={selectedFile}
            onChange={e => setSelectedFile(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e8eaf4', borderRadius: 9, fontSize: '0.83rem', color: '#0c1446', background: '#f8f9ff', outline: 'none', cursor: 'pointer' }}>
            <option value=''>— Choose a file —</option>
            {files.map(f => (
              <option key={f.id} value={f.id}>{f.original_filename || f.filename}</option>
            ))}
          </select>
          {!selectedFile && (
            <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#9ca3af' }}>Select a dataset to start chatting with your data.</p>
          )}
          {selectedFile && (
            <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#059669', fontWeight: 600 }}>✓ {selectedFileName}</p>
          )}
        </div>

        {/* Suggested prompts */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Try asking…</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => { if (selectedFile) sendMessage(p) }}
                disabled={!selectedFile}
                style={{
                  textAlign: 'left', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 8,
                  background: selectedFile ? '#f8f9ff' : '#f4f4f4',
                  color: selectedFile ? '#0c1446' : '#9ca3af',
                  fontSize: '0.78rem', cursor: selectedFile ? 'pointer' : 'not-allowed',
                  lineHeight: 1.4, transition: 'all 0.12s'
                }}
                onMouseEnter={e => { if (selectedFile) { e.currentTarget.style.background = '#e91e8c'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#e91e8c' }}}
                onMouseLeave={e => { e.currentTarget.style.background = selectedFile ? '#f8f9ff' : '#f4f4f4'; e.currentTarget.style.color = selectedFile ? '#0c1446' : '#9ca3af'; e.currentTarget.style.borderColor = '#e8eaf4' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0c1446', marginBottom: 6 }}>AI Data Assistant</div>
              <div style={{ fontSize: '0.85rem', maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
                Select a dataset and ask anything in plain English. I'll analyse your data and give you instant insights.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-start' }}>
              {msg.role !== 'user' && (
                <div style={{ width: 32, height: 32, background: msg.role === 'error' ? '#fee2e2' : '#e91e8c18', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginTop: 2 }}>
                  {msg.role === 'error' ? '⚠️' : '🤖'}
                </div>
              )}
              <div style={{
                maxWidth: '72%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#0c1446' : msg.role === 'error' ? '#fef2f2' : '#f8f9ff',
                color: msg.role === 'user' ? '#fff' : msg.role === 'error' ? '#dc2626' : '#1f2937',
                fontSize: '0.875rem', lineHeight: 1.65, whiteSpace: 'pre-wrap',
                border: msg.role === 'error' ? '1px solid #fecaca' : 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
              }}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div style={{ width: 32, height: 32, background: '#0c1446', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#fff', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                  U
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#e91e8c18', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🤖</div>
              <div style={{ padding: '12px 16px', background: '#f8f9ff', borderRadius: '18px 18px 18px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  {[0,1,2].map(d => (
                    <span key={d} style={{ width: 7, height: 7, background: '#e91e8c', borderRadius: '50%', display: 'inline-block', animation: `bounce 1.2s ${d * 0.2}s infinite` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f2f8', display: 'flex', gap: 10, alignItems: 'flex-end', background: '#fafbff' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={!selectedFile || loading}
            placeholder={selectedFile ? 'Ask anything about your data… (Enter to send)' : 'Select a dataset first'}
            rows={2}
            style={{
              flex: 1, padding: '10px 14px', border: '1.5px solid #e8eaf4', borderRadius: 12,
              fontSize: '0.875rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
              background: selectedFile ? '#fff' : '#f4f4f4',
              color: selectedFile ? '#1f2937' : '#9ca3af',
              lineHeight: 1.5
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!selectedFile || !input.trim() || loading}
            style={{
              padding: '10px 18px', background: (!selectedFile || !input.trim() || loading) ? '#e8eaf4' : '#e91e8c',
              color: (!selectedFile || !input.trim() || loading) ? '#9ca3af' : '#fff',
              border: 'none', borderRadius: 12, cursor: (!selectedFile || !input.trim() || loading) ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '0.875rem', flexShrink: 0, transition: 'all 0.15s', height: 44
            }}>
            Send ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}

// ── Main HubHome ──────────────────────────────────────────────────────────────

export default function HubHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState({ files: 0, rows: 0 })
  const [recentFiles, setRecentFiles] = useState([])
  const [allFiles, setAllFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    filesApi.list().then(r => {
      const files = r.data || []
      setAllFiles(files)
      setStats({ files: files.length, rows: files.reduce((a, f) => a + (f.rows || 0), 0) })
      setRecentFiles(files.slice(0, 3))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleSection = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }))

  const TABS = [
    { id: 'dashboard', label: '🏠 Dashboard', title: 'Hub Home' },
    { id: 'ai', label: '🤖 AI Assistant', title: 'AI Assistant' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 20, flexWrap: 'wrap' }}>
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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f0f2f8', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 22px', border: 'none', borderRadius: 9, cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#0c1446' : '#6b7280',
              boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── AI Assistant Tab ────────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <AIAssistant files={allFiles} />
      )}

      {/* ── Dashboard Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <>
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
                  <button key={f.id} onClick={() => navigate(`/analytics/${f.id}`)}
                    style={{ flex: 1, minWidth: 180, padding: '12px 16px', background: '#f8f9ff', border: '1px solid #e8eaf4', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#e91e8c'; e.currentTarget.style.background = '#fff5f9' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8eaf4'; e.currentTarget.style.background = '#f8f9ff' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0c1446', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.filename}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{(f.rows || 0).toLocaleString()} rows · {f.columns || 0} cols</div>
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
                      {tools.map(({ path, icon: ti, label: tl, desc }) => (
                        <button key={path} onClick={() => navigate(path)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s', width: '100%' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <div style={{ width: 32, height: 32, background: color + '18', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>{ti}</div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c1446', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tl}</div>
                            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
