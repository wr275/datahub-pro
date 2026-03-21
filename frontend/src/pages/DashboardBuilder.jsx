import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']
const WIDGET_TYPES = [
  { type: 'kpi', label: 'KPI Card', icon: '🔢' },
  { type: 'bar', label: 'Bar Chart', icon: '📊' },
  { type: 'line', label: 'Line Chart', icon: '📈' },
  { type: 'pie', label: 'Pie Chart', icon: '🥧' },
  { type: 'table', label: 'Data Table', icon: '📋' },
]

function Widget({ widget, rows, headers, onRemove }) {
  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))

  if (widget.type === 'kpi') {
    const col = widget.col || numericCols[0]
    const vals = col ? rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v)) : []
    const total = vals.reduce((a, b) => a + b, 0)
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #e91e8c', position: 'relative' }}>
        <button onClick={onRemove} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>✕</button>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{widget.label || col || 'KPI'}</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e91e8c' }}>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Total from {vals.length} records</div>
      </div>
    )
  }

  if (widget.type === 'bar') {
    const xCol = widget.xCol || headers[0]; const yCol = widget.yCol || numericCols[0]
    const groups = {}
    rows.forEach(r => { const k = String(r[xCol] ?? ''); const v = parseFloat(r[yCol]) || 0; groups[k] = (groups[k] || 0) + v })
    const data = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        <button onClick={onRemove} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', zIndex: 1 }}>✕</button>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${yCol} by ${xCol}`}</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data}><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="value" fill="#0097b2" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'line') {
    const xCol = widget.xCol || headers[0]; const yCol = widget.yCol || numericCols[0]
    const data = rows.slice(0, 20).map((r, i) => ({ x: r[xCol] || i + 1, value: parseFloat(r[yCol]) || 0 }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        <button onClick={onRemove} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', zIndex: 1 }}>✕</button>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${yCol} trend`}</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}><XAxis dataKey="x" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#e91e8c" strokeWidth={2} dot={false} /></LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'pie') {
    const col = widget.col || headers[0]
    const freq = {}; rows.forEach(r => { const v = String(r[col] ?? ''); freq[v] = (freq[v] || 0) + 1 })
    const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        <button onClick={onRemove} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', zIndex: 1 }}>✕</button>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${col} breakdown`}</div>
        <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name }) => name} labelLine={false} fontSize={9}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
      </div>
    )
  }

  if (widget.type === 'table') {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        <button onClick={onRemove} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', zIndex: 1 }}>✕</button>
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || 'Data Table'}</div>
        <div style={{ overflowX: 'auto', maxHeight: 200 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead><tr style={{ background: '#f9fafb' }}>{headers.slice(0, 5).map(h => <th key={h} style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 6).map((r, i) => <tr key={i}>{headers.slice(0, 5).map(h => <td key={h} style={{ padding: '5px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{r[h] ?? '—'}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    )
  }
  return null
}

export default function DashboardBuilder() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [widgets, setWidgets] = useState([])
  const [dashTitle, setDashTitle] = useState('My Dashboard')
  const [addType, setAddType] = useState('kpi')

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function addWidget() {
    const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
    const widget = { id: Date.now(), type: addType, label: '' }
    if (addType === 'kpi') widget.col = numericCols[0]
    else if (['bar', 'line'].includes(addType)) { widget.xCol = headers[0]; widget.yCol = numericCols[0] }
    else if (addType === 'pie') widget.col = headers[0]
    setWidgets([...widgets, widget])
  }

  function removeWidget(id) { setWidgets(widgets.filter(w => w.id !== id)) }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <input value={dashTitle} onChange={e => setDashTitle(e.target.value)} style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1446', border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 200 }} />
        <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', minWidth: 180 }}>
          <option value="">-- Select Dataset --</option>
          {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
        </select>
        {fileId && (
          <>
            <select value={addType} onChange={e => setAddType(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              {WIDGET_TYPES.map(w => <option key={w.type} value={w.type}>{w.icon} {w.label}</option>)}
            </select>
            <button onClick={addWidget} style={{ padding: '9px 20px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>+ Add Widget</button>
          </>
        )}
      </div>

      {widgets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {widgets.map(w => <Widget key={w.id} widget={w} rows={rows} headers={headers} onRemove={() => removeWidget(w.id)} />)}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 100, color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 16 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: '1rem', marginBottom: 8 }}>Your canvas is empty</div>
          <div style={{ fontSize: '0.875rem' }}>Select a dataset above, then click "+ Add Widget" to start building</div>
        </div>
      )}
    </div>
  )
}
