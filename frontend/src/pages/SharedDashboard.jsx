import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { shareApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']
const APP_URL = (typeof window !== 'undefined' ? window.location.origin : 'https://www.datahubpro.co.uk')

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

export default function SharedDashboard() {
  const { token } = useParams()
  const [dash, setDash] = useState(null)
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shareApi.get(token)
      .then(res => {
        const data = res.data
        setDash(data)
        const fileData = data.file_data || {}
        setHeaders(fileData.headers || [])
        setRows(fileData.rows || [])
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [token])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Loading dashboard...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>&#128274;</div>
        <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 6, color: '#0c1446' }}>Dashboard not available</div>
        <div style={{ color: '#6b7280', marginBottom: 20, fontSize: '0.9rem' }}>This dashboard may have been unshared or deleted.</div>
        <a href={APP_URL} style={{
          display: 'inline-block', background: '#e91e8c', color: '#fff',
          padding: '10px 24px', borderRadius: 8, fontWeight: 700,
          textDecoration: 'none', fontSize: '0.9rem'
        }}>Go to DataHub Pro</a>
      </div>
    </div>
  )

  let widgets = []
  try { widgets = JSON.parse(dash.config_json || '{}').widgets || [] } catch {}

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
            Dataset: {dash.file_name} &nbsp;&middot;&nbsp; {rows.length} rows &nbsp;&middot;&nbsp; {headers.length} columns
          </p>
        )}
        {widgets.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No widgets in this dashboard.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {widgets.map(w => (
            <Widget key={w.id} widget={w} rows={rows} headers={headers} />
          ))}
        </div>
      </div>

      {/* Embed section */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 0' }}>
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#7c3aed', fontWeight: 700, whiteSpace: 'nowrap' }}>Embed this dashboard:</span>
          <input readOnly onClick={e => e.target.select()} value={embedCode} style={{ flex: 1, minWidth: 260, padding: '6px 12px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: '0.75rem', background: '#fff', color: '#374151' }} />
          <button onClick={() => navigator.clipboard.writeText(embedCode).catch(()=>{})} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>Copy embed</button>
        </div>
      </div>

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
