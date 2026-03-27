import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi, dashboardsApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']

const WIDGET_TYPES = [
  { type: 'kpi',   label: 'KPI Card' },
  { type: 'bar',   label: 'Bar Chart' },
  { type: 'line',  label: 'Line Chart' },
  { type: 'pie',   label: 'Pie Chart' },
  { type: 'table', label: 'Data Table' },
]

// ââ Widget renderer ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Widget({ widget, rows, headers, onRemove }) {
  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
  const xCol = headers[0]

  const card = (children, span2 = false) => (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      gridColumn: span2 ? 'span 2' : undefined, position: 'relative',
    }}>
      <button onClick={() => onRemove(widget.id)} style={{
        position: 'absolute', top: 10, right: 10, background: 'none',
        border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '1rem', lineHeight: 1,
      }} title="Remove widget">x</button>
      {children}
    </div>
  )

  if (widget.type === 'kpi') {
    const col = widget.col || numericCols[0]
    const vals = col ? rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v)) : []
    const total = vals.reduce((a, b) => a + b, 0)
    return card(
      <div style={{ border: '2px solid #e91e8c', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{col || 'No column'}</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#e91e8c', lineHeight: 1 }}>
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 6 }}>Total from {rows.length} records</div>
      </div>
    )
  }

  if (widget.type === 'bar') {
    const yCol = widget.col || numericCols[0]
    const data = rows.slice(0, 20).map(r => ({ name: String(r[xCol] || '').slice(0, 12), value: parseFloat(r[yCol]) || 0 }))
    return card(
      <>
        <div style={{ fontWeight: 700, marginBottom: 10, color: '#0c1446', fontSize: '0.85rem' }}>{yCol} by {xCol}</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
            <Tooltip /><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <Bar dataKey="value" fill="#0097b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </>
    )
  }

  if (widget.type === 'line') {
    const yCol = widget.col || numericCols[0]
    const data = rows.slice(0, 20).map(r => ({ name: String(r[xCol] || '').slice(0, 12), value: parseFloat(r[yCol]) || 0 }))
    return card(
      <>
        <div style={{ fontWeight: 700, marginBottom: 10, color: '#0c1446', fontSize: '0.85rem' }}>{yCol} over {xCol}</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
            <Tooltip /><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <Line dataKey="value" stroke="#e91e8c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </>
    )
  }

  if (widget.type === 'pie') {
    const valCol = widget.col || numericCols[0]
    const data = rows.slice(0, 8).map(r => ({ name: String(r[xCol] || '').slice(0, 14), value: Math.abs(parseFloat(r[valCol])) || 0 }))
    return card(
      <>
        <div style={{ fontWeight: 700, marginBottom: 10, color: '#0c1446', fontSize: '0.85rem' }}>{valCol} breakdown</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name }) => name.slice(0, 8)}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </>
    )
  }

  if (widget.type === 'table') {
    const cols = headers.slice(0, 6)
    return card(
      <>
        <div style={{ fontWeight: 700, marginBottom: 10, color: '#0c1446', fontSize: '0.85rem' }}>Data Table</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
            <thead><tr>{cols.map(c => (
              <th key={c} style={{ padding: '6px 10px', background: '#f3f4f6', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{c}</th>
            ))}</tr></thead>
            <tbody>{rows.slice(0, 10).map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                {cols.map(c => <td key={c} style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{row[c]}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>, true
    )
  }

  return null
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function DashboardBuilder() {
  // File & data
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [fileContent, setFileContent] = useState('')
  const [fileName, setFileName] = useState('')

  // Widget builder
  const [widgets, setWidgets] = useState([])
  const [widgetType, setWidgetType] = useState('kpi')
  const [selectedCol, setSelectedCol] = useState('')

  // Dashboard meta
  const [dashName, setDashName] = useState('My Dashboard')
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef(null)

  // Save / share
  const [savedDashboards, setSavedDashboards] = useState([])
  const [currentDashId, setCurrentDashId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [sharingBusy, setSharingBusy] = useState(false)
  const linkRef = useRef(null)

  // Load files + saved dashboards on mount
  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
    dashboardsApi.list().then(r => setSavedDashboards(r.data || [])).catch(() => {})
  }, [])

  // When file changes, parse CSV
  useEffect(() => {
    if (!fileId) { setRows([]); setHeaders([]); setSelectedCol(''); return }
    const f = files.find(f => String(f.id) === String(fileId))
    if (!f?.file_content) return
    const lines = f.file_content.split('\n').filter(l => l.trim())
    if (!lines.length) return
    const hdrs = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
    const parsed = lines.slice(1).map(line => {
      const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || line.split(',')
      const obj = {}
      hdrs.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim() })
      return obj
    })
    setHeaders(hdrs)
    setRows(parsed)
    setFileContent(f.file_content)
    setFileName(f.filename || '')
    // Default column selector to first numeric column
    const firstNum = hdrs.find(h => parsed.some(r => !isNaN(parseFloat(r[h]))))
    setSelectedCol(firstNum || hdrs[0] || '')
  }, [fileId, files])

  // Focus name input when editing
  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus()
  }, [editingName])

  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
  const allCols = headers

  function addWidget() {
    if (!fileId) return
    setWidgets(prev => [...prev, {
      id: Date.now(),
      type: widgetType,
      col: selectedCol || numericCols[0] || headers[0] || '',
    }])
  }

  function removeWidget(id) {
    setWidgets(prev => prev.filter(w => w.id !== id))
  }

  function newDashboard() {
    setWidgets([])
    setDashName('My Dashboard')
    setCurrentDashId(null)
    setIsPublic(false)
    setShareToken('')
    setFileId('')
    setSaveMsg('')
  }

  async function saveDashboard() {
    if (!widgets.length) { setSaveMsg('Add at least one widget first.'); return }
    setSaving(true)
    setSaveMsg('')
    const payload = {
      name: dashName,
      file_id: fileId ? parseInt(fileId) : null,
      config_json: JSON.stringify({ widgets }),
    }
    try {
      if (currentDashId) {
        const r = await dashboardsApi.update(currentDashId, payload)
        setIsPublic(r.data.is_public)
        setShareToken(r.data.share_token || '')
      } else {
        const r = await dashboardsApi.create(payload)
        setCurrentDashId(r.data.id)
        setIsPublic(r.data.is_public)
        setShareToken(r.data.share_token || '')
      }
      const updated = await dashboardsApi.list()
      setSavedDashboards(updated.data || [])
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (e) {
      setSaveMsg('Error saving.')
    }
    setSaving(false)
  }

  async function toggleShare() {
    if (!currentDashId) return
    setSharingBusy(true)
    try {
      const r = await dashboardsApi.share(currentDashId)
      setIsPublic(r.data.is_public)
      setShareToken(r.data.share_token || '')
      const updated = await dashboardsApi.list()
      setSavedDashboards(updated.data || [])
    } catch {}
    setSharingBusy(false)
  }

  function loadDashboard(dash) {
    setCurrentDashId(dash.id)
    setDashName(dash.name || 'My Dashboard')
    setIsPublic(dash.is_public || false)
    setShareToken(dash.share_token || '')
    let cfg = {}
    try { cfg = JSON.parse(dash.config_json || '{}') } catch {}
    setWidgets(cfg.widgets || [])
    if (dash.file_id) {
      setFileId(String(dash.file_id))
    }
    setSaveMsg('')
  }

  function copyLink() {
    if (linkRef.current) { linkRef.current.select(); document.execCommand('copy') }
  }

  const shareUrl = shareToken
    ? `${window.location.origin}/share/${shareToken}`
    : ''

  const sel = { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: '0.85rem', cursor: 'pointer' }
  const btn = (bg, color = '#fff') => ({
    background: bg, color, border: 'none', borderRadius: 8, padding: '7px 14px',
    fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
  })

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#f8fafc' }}>

      {/* ââ Sidebar ââ */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My Dashboards</span>
          <button onClick={newDashboard} style={{ ...btn('#0097b2'), padding: '4px 10px', fontSize: '0.75rem' }}>+ New</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {savedDashboards.length === 0 && (
            <div style={{ padding: 16, fontSize: '0.78rem', color: '#9ca3af' }}>No saved dashboards yet.</div>
          )}
          {savedDashboards.map(d => (
            <button key={d.id} onClick={() => loadDashboard(d)} style={{
              width: '100%', textAlign: 'left', background: d.id === currentDashId ? '#fdf2f8' : 'none',
              border: 'none', borderBottom: '1px solid #f3f4f6', padding: '10px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.83rem', fontWeight: d.id === currentDashId ? 700 : 500, color: '#0c1446', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{d.name}</span>
              {d.is_public && <span style={{ fontSize: '0.65rem', background: '#d1fae5', color: '#065f46', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>shared</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ââ Main canvas ââ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {/* Inline-editable dashboard name */}
          {editingName ? (
            <input
              ref={nameInputRef}
              value={dashName}
              onChange={e => setDashName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
              style={{
                fontWeight: 900, fontSize: '1.15rem', color: '#0c1446', border: '2px solid #e91e8c',
                borderRadius: 6, padding: '2px 8px', outline: 'none', width: 220,
              }}
            />
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              title="Click to rename"
              style={{
                fontWeight: 900, fontSize: '1.15rem', color: '#0c1446', margin: 0,
                cursor: 'text', padding: '2px 6px', borderRadius: 6, border: '2px solid transparent',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.target.style.borderColor = '#e5e7eb'}
              onMouseLeave={e => e.target.style.borderColor = 'transparent'}
            >
              {dashName}
              <span style={{ fontSize: '0.7rem', color: '#d1d5db', marginLeft: 6, fontWeight: 400 }}>edit</span>
            </h2>
          )}

          <div style={{ flex: 1 }} />

          {/* File selector */}
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={sel}>
            <option value="">-- Select Dataset --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>

          {/* Column selector (only when file is loaded) */}
          {headers.length > 0 && (
            <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)} style={{ ...sel, maxWidth: 160 }} title="Column for KPI/chart values">
              {allCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Widget type */}
          <select value={widgetType} onChange={e => setWidgetType(e.target.value)} style={sel}>
            {WIDGET_TYPES.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
          </select>

          {/* Add widget */}
          <button onClick={addWidget} disabled={!fileId} style={{ ...btn('#0097b2'), opacity: fileId ? 1 : 0.4 }}>+ Widget</button>

          {/* Save */}
          <button onClick={saveDashboard} disabled={saving} style={btn('#e91e8c')}>
            {saving ? 'Saving...' : 'Save'}
          </button>

          {/* Share (only after save) */}
          {currentDashId && (
            <button onClick={toggleShare} disabled={sharingBusy} style={{
              ...btn(isPublic ? '#10b981' : '#6b7280'),
              minWidth: 80,
            }}>
              {sharingBusy ? '...' : isPublic ? 'Shared' : 'Share'}
            </button>
          )}
        </div>

        {/* Save message */}
        {saveMsg && (
          <div style={{ background: saveMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4', color: saveMsg.startsWith('Error') ? '#dc2626' : '#15803d', padding: '6px 20px', fontSize: '0.82rem', fontWeight: 600 }}>
            {saveMsg}
          </div>
        )}

        {/* Share panel */}
        {isPublic && shareToken && (
          <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>Public link:</span>
            <input ref={linkRef} readOnly value={shareUrl} style={{ flex: 1, minWidth: 260, padding: '4px 10px', borderRadius: 6, border: '1px solid #86efac', fontSize: '0.78rem', background: '#fff', color: '#374151' }} />
            <button onClick={copyLink} style={btn('#15803d')}>Copy</button>
            <button onClick={toggleShare} style={btn('#dc2626')}>Unshare</button>
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {widgets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>&#128202;</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Your canvas is empty</div>
              <div style={{ fontSize: '0.85rem' }}>Select a dataset above, then click "+ Widget" to start building</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {widgets.map(w => (
                <Widget key={w.id} widget={w} rows={rows} headers={headers} onRemove={removeWidget} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
