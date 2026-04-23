import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']
const APP_URL = 'https://datahub-pro-production.up.railway.app'
const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api' : '/api'

// Apply the dashboard-level filters that were saved alongside widgets.
// Filters live in config_json.filters = {date_column, from, to, dimension, values[]}
function applyFilters(rows, filters) {
  if (!filters || !rows || rows.length === 0) return rows
  let out = rows

  // Date range
  if (filters.date_column && (filters.from || filters.to)) {
    const col = filters.date_column
    const fromMs = filters.from ? new Date(filters.from).getTime() : null
    const toMs = filters.to ? new Date(filters.to).getTime() + 86399999 : null
    out = out.filter(r => {
      const v = r[col]
      if (!v) return false
      const ms = new Date(v).getTime()
      if (isNaN(ms)) return false
      if (fromMs !== null && ms < fromMs) return false
      if (toMs !== null && ms > toMs) return false
      return true
    })
  }

  // Dimension multi-select
  if (filters.dimension && Array.isArray(filters.values) && filters.values.length > 0) {
    const col = filters.dimension
    const allow = new Set(filters.values.map(String))
    out = out.filter(r => allow.has(String(r[col])))
  }

  return out
}

function Widget({ widget, rows, headers }) {
  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
  const xCol = headers[0]

  if (widget.type === 'kpi') {
    const col = widget.col || numericCols[0]
    const vals = col ? rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v)) : []
    const total = vals.reduce((a, b) => a + b, 0)
    return (
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24,
        border: '2px solid #e91e8c', boxShadow: '0 2px 12px rgba(233,30,140,0.08)'
      }}>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col || 'No column'}</div>
        <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#e91e8c', lineHeight: 1 }}>
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 8 }}>Total from {rows.length} records</div>
      </div>
    )
  }

  if (widget.type === 'bar') {
    const yCol = widget.col || numericCols[0]
    const data = rows.slice(0, 20).map(r => ({
      name: String(r[xCol] || '').slice(0, 12),
      value: parseFloat(r[yCol]) || 0
    }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#0c1446', fontSize: '0.9rem' }}>{yCol} by {xCol}</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0097b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'line') {
    const yCol = widget.col || numericCols[0]
    const data = rows.slice(0, 20).map(r => ({
      name: String(r[xCol] || '').slice(0, 12),
      value: parseFloat(r[yCol]) || 0
    }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#0c1446', fontSize: '0.9rem' }}>{yCol} over {xCol}</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line dataKey="value" stroke="#e91e8c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'pie') {
    const valCol = widget.col || numericCols[0]
    const data = rows.slice(0, 8).map(r => ({
      name: String(r[xCol] || '').slice(0, 16),
      value: Math.abs(parseFloat(r[valCol])) || 0
    }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#0c1446', fontSize: '0.9rem' }}>{valCol} breakdown</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name }) => name.slice(0, 8)}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'table') {
    const cols = headers.slice(0, 6)
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, gridColumn: 'span 2', overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#0c1446', fontSize: '0.9rem' }}>Data Table</div>
        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{cols.map(c => (
              <th key={c} style={{ padding: '6px 10px', background: '#f3f4f6', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                {cols.map(c => <td key={c} style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{row[c]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}

// Centred pane used for the three blocking states (expired / password / error).
function StatePane({ icon, title, message, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420, width: '100%', background: '#fff', padding: 36, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '2.8rem', marginBottom: 14 }}>{icon}</div>
        <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 6, color: '#0c1446' }}>{title}</div>
        <div style={{ color: '#6b7280', marginBottom: 20, fontSize: '0.9rem' }}>{message}</div>
        {children}
      </div>
    </div>
  )
}

export default function SharedDashboard() {
  const { token } = useParams()
  const [dash, setDash] = useState(null)
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [loading, setLoading] = useState(true)
  // status is one of: 'loading', 'ok', 'password', 'expired', 'not_found', 'error'
  const [status, setStatus] = useState('loading')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDashboard = useCallback(async (password) => {
    setLoading(true)
    setPwError('')
    try {
      const headers = password ? { 'X-Share-Password': password } : {}
      const res = await axios.get(API_BASE + '/share/' + encodeURIComponent(token), { headers })
      const data = res.data
      setDash(data)
      const fileData = data.file_data || {}
      setHeaders(fileData.headers || [])
      setRows(fileData.rows || [])
      setStatus('ok')
    } catch (err) {
      const resp = err.response
      const detail = resp && resp.data ? resp.data.detail : null
      const code = detail && typeof detail === 'object' ? detail.code : null
      if (resp && resp.status === 401 && code === 'password_required') {
        setStatus('password')
        if (password) setPwError('Incorrect password. Try again.')
      } else if (resp && resp.status === 410) {
        setStatus('expired')
      } else if (resp && resp.status === 404) {
        setStatus('not_found')
      } else if (resp && resp.status === 403) {
        setStatus('not_found')  // "not publicly shared" reads the same to the viewer
      } else {
        setStatus('error')
      }
    } finally {
      setLoading(false)
      setSubmitting(false)
    }
  }, [token])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const onSubmitPassword = (e) => {
    e.preventDefault()
    if (!pwInput) { setPwError('Enter the password to continue.'); return }
    setSubmitting(true)
    fetchDashboard(pwInput)
  }

  if (loading && status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Loading dashboard...</div>
      </div>
    </div>
  )

  if (status === 'expired') return (
    <StatePane
      icon="&#9203;"
      title="This share link has expired"
      message="The owner set an expiry date on this dashboard and it has passed. Ask them for a new link."
    >
      <a href={APP_URL} style={{
        display: 'inline-block', background: '#e91e8c', color: '#fff',
        padding: '10px 24px', borderRadius: 8, fontWeight: 700,
        textDecoration: 'none', fontSize: '0.9rem'
      }}>Go to DataHub Pro</a>
    </StatePane>
  )

  if (status === 'not_found') return (
    <StatePane
      icon="&#128274;"
      title="Dashboard not available"
      message="This dashboard may have been unshared, deleted, or the link is incorrect."
    >
      <a href={APP_URL} style={{
        display: 'inline-block', background: '#e91e8c', color: '#fff',
        padding: '10px 24px', borderRadius: 8, fontWeight: 700,
        textDecoration: 'none', fontSize: '0.9rem'
      }}>Go to DataHub Pro</a>
    </StatePane>
  )

  if (status === 'error') return (
    <StatePane
      icon="&#9888;&#65039;"
      title="Something went wrong"
      message="We couldn't load this dashboard. Please try again in a moment."
    >
      <button
        onClick={() => fetchDashboard()}
        style={{
          background: '#e91e8c', color: '#fff', border: 'none',
          padding: '10px 24px', borderRadius: 8, fontWeight: 700,
          cursor: 'pointer', fontSize: '0.9rem'
        }}
      >
        Retry
      </button>
    </StatePane>
  )

  if (status === 'password') return (
    <StatePane
      icon="&#128272;"
      title="Password required"
      message="This dashboard is protected. Enter the password shared with you to view it."
    >
      <form onSubmit={onSubmitPassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="password"
          autoFocus
          value={pwInput}
          onChange={e => setPwInput(e.target.value)}
          placeholder="Enter password"
          style={{
            padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db',
            fontSize: '0.95rem', outline: 'none'
          }}
        />
        {pwError && <div style={{ color: '#dc2626', fontSize: '0.82rem' }}>{pwError}</div>}
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: submitting ? '#9ca3af' : '#e91e8c', color: '#fff',
            border: 'none', padding: '10px 24px', borderRadius: 8,
            fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {submitting ? 'Checking...' : 'Unlock'}
        </button>
      </form>
    </StatePane>
  )

  // status === 'ok' — render the dashboard
  let widgets = []
  let filters = null
  let shareSettings = {}
  try {
    const cfg = JSON.parse(dash.config_json || '{}')
    widgets = cfg.widgets || []
    filters = cfg.filters || null
  } catch {}
  shareSettings = dash.share_settings || {}

  const visibleRows = applyFilters(rows, filters)
  const allowEmbed = shareSettings.allow_embed !== false  // default true

  const embedCode = `<iframe src="${window.location.href}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href={APP_URL} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#e91e8c' }}>DataHub</span>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0c1446' }}>Pro</span>
          </a>
          <span style={{ color: '#d1d5db', fontSize: '1.2rem', fontWeight: 300 }}>/</span>
          <span style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: 500 }}>{dash.name}</span>
        </div>
        <a
          href={`${APP_URL}/register`}
          style={{
            background: '#e91e8c', color: '#fff', padding: '8px 18px',
            borderRadius: 8, fontWeight: 700, fontSize: '0.82rem',
            textDecoration: 'none', whiteSpace: 'nowrap'
          }}
        >
          Try DataHub Pro free &#8594;
        </a>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontWeight: 900, fontSize: '1.9rem', color: '#0c1446', marginBottom: 6 }}>{dash.name}</h1>
        {dash.file_name && (
          <p style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: 28 }}>
            Dataset: {dash.file_name} &nbsp;&middot;&nbsp; {visibleRows.length}
            {visibleRows.length !== rows.length && <span> of {rows.length}</span>} rows
            &nbsp;&middot;&nbsp; {headers.length} columns
          </p>
        )}
        {widgets.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No widgets in this dashboard.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {widgets.map(w => (
            <Widget key={w.id} widget={w} rows={visibleRows} headers={headers} />
          ))}
        </div>
      </div>

      {/* Embed section — hidden if owner disabled embedding */}
      {allowEmbed && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 0' }}>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#7c3aed', fontWeight: 700, whiteSpace: 'nowrap' }}>Embed this dashboard:</span>
            <input readOnly onClick={e => e.target.select()} value={embedCode} style={{ flex: 1, minWidth: 260, padding: '6px 12px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: '0.75rem', background: '#fff', color: '#374151' }} />
            <button onClick={() => navigator.clipboard.writeText(embedCode).catch(()=>{})} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>Copy embed</button>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div style={{
        background: '#0c1446', color: '#fff',
        textAlign: 'center', padding: '48px 24px', marginTop: 48
      }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>
          Build dashboards like this in minutes
        </div>
        <div style={{ color: '#9ca3af', marginBottom: 24, fontSize: '0.9rem' }}>
          50 analytics tools. AI insights. Shareable links. No analyst needed.
        </div>
        <a
          href={`${APP_URL}/register`}
          style={{
            display: 'inline-block', background: '#e91e8c', color: '#fff',
            padding: '12px 32px', borderRadius: 10, fontWeight: 800,
            fontSize: '1rem', textDecoration: 'none'
          }}
        >
          Start free &#8212; no card needed &#8594;
        </a>
        <div style={{ marginTop: 32, fontSize: '0.75rem', color: '#4b5563' }}>
          Powered by <strong style={{ color: '#e91e8c' }}>DataHub Pro</strong> &#8212; Analytics for SMEs
        </div>
      </div>
    </div>
  )
}
