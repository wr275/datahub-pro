import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { shareApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']

function Widget({ widget, rows, headers }) {
  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))

  if (widget.type === 'kpi') {
    const col = widget.col || numericCols[0]
    const vals = col ? rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v)) : []
    const total = vals.reduce((a, b) => a + b, 0)
    return (
      <div style={{
        background: '#fff', borderRadius: 12, padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #e91e8c',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{widget.label || col || 'KPI'}</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e91e8c' }}>
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Total from {vals.length} records</div>
      </div>
    )
  }

  if (widget.type === 'bar') {
    const xCol = widget.xCol || headers[0]
    const yCol = widget.yCol || numericCols[0]
    const groups = {}
    rows.forEach(r => { const k = String(r[xCol] ?? ''); const v = parseFloat(r[yCol]) || 0; groups[k] = (groups[k] || 0) + v })
    const data = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${yCol} by ${xCol}`}</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0097b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'line') {
    const xCol = widget.xCol || headers[0]
    const yCol = widget.yCol || numericCols[0]
    const data = rows.slice(0, 20).map((r, i) => ({ x: r[xCol] || i + 1, value: parseFloat(r[yCol]) || 0 }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${yCol} trend`}</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis dataKey="x" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#e91e8c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'pie') {
    const col = widget.col || headers[0]
    const freq = {}
    rows.forEach(r => { const v = String(r[col] ?? ''); freq[v] = (freq[v] || 0) + 1 })
    const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${col} breakdown`}</div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={65} dataKey="value"
              label={({ name }) => name} labelLine={false} fontSize={9}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'table') {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || 'Data Table'}</div>
        <div style={{ overflowX: 'auto', maxHeight: 220 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {headers.slice(0, 6).map(h => (
                  <th key={h} style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r, i) => (
                <tr key={i}>
                  {headers.slice(0, 6).map(h => (
                    <td key={h} style={{ padding: '5px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{r[h] ?? 'â'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return null
}

export default function SharedDashboard() {
  const { token } = useParams()
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    shareApi.get(token)
      .then(r => { setDash(r.data); setLoading(false) })
      .catch(err => {
        setError(err.response?.data?.detail || 'Dashboard not found or no longer shared')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ color: '#6b7280', fontSize: '1rem' }}>Loading dashboardâ¦</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', gap: 16 }}>
        <div style={{ fontSize: '3rem' }}>ð</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151' }}>Dashboard not available</div>
        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{error}</div>
        <Link to="/" style={{ color: '#e91e8c', fontWeight: 600, fontSize: '0.9rem' }}>Go to DataHub Pro â</Link>
      </div>
    )
  }

  const fileData = dash.file_data || { headers: [], rows: [] }
  const headers = fileData.headers || []
  const rows = fileData.rows || []
  let widgets = []
  try { widgets = JSON.parse(dash.config_json || '{}').widgets || [] } catch {}

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* ââ Header bar ââ */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#e91e8c' }}>DataHub</span>
          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0c1446' }}>Pro</span>
          <span style={{ color: '#d1d5db', fontSize: '1.2rem' }}>âº</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0c1446' }}>{dash.name}</span>
        </div>
        <Link to="/login" style={{ fontSize: '0.8rem', color: '#6b7280', textDecoration: 'none', fontWeight: 600 }}>
          Sign in to DataHub Pro â
        </Link>
      </div>

      {/* ââ Dashboard body ââ */}
      <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Meta */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>{dash.name}</h1>
          {dash.description && (
            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{dash.description}</p>
          )}
          {fileData.filename && (
            <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#9ca3af' }}>
              Dataset: {fileData.filename} Â· {rows.length.toLocaleString()} rows Â· {headers.length} columns
            </div>
          )}
        </div>

        {/* Widgets */}
        {widgets.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {widgets.map((w, i) => (
              <Widget key={w.id || i} widget={w} rows={rows} headers={headers} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 16 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>ð</div>
            <div>This dashboard has no widgets yet.</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <a href="https://datahub-pro-production.up.railway.app" target="_blank" rel="noreferrer"
            style={{ fontSize: '0.8rem', color: '#9ca3af', textDecoration: 'none' }}>
            Powered by <strong style={{ color: '#e91e8c' }}>DataHub Pro</strong> â Analytics for SMEs
          </a>
        </div>
      </div>
    </div>
  )
}
