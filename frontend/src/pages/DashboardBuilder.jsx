import React, { useState, useEffect, useMemo, useRef } from 'react'
import { filesApi, analyticsApi, dashboardsApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// -----------------------------------------------------------------------------
// Custom Dashboards 2.0
//  - Drag-to-reorder widgets (HTML5 DnD, no extra deps)
//  - Dashboard-level filters: date range + dimension multi-select
//  - Share settings: expiry, optional password, embed toggle, regenerate token
// -----------------------------------------------------------------------------

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']

const WIDGET_TYPES = [
  { type: 'kpi',   label: 'KPI Card' },
  { type: 'bar',   label: 'Bar Chart' },
  { type: 'line',  label: 'Line Chart' },
  { type: 'pie',   label: 'Pie Chart' },
  { type: 'table', label: 'Data Table' },
]

// -- Widget ------------------------------------------------------------------

function Widget({ widget, rows, headers, onRemove, onDuplicate, dragHandlers }) {
  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
  const xCol = headers[0]

  const card = (children, span2 = false) => (
    <div
      draggable
      onDragStart={e => dragHandlers.onDragStart(e, widget.id)}
      onDragOver={e => dragHandlers.onDragOver(e, widget.id)}
      onDragEnd={dragHandlers.onDragEnd}
      onDrop={e => dragHandlers.onDrop(e, widget.id)}
      style={{
        background: '#fff', borderRadius: 12, padding: 20,
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        gridColumn: span2 ? 'span 2' : undefined,
        position: 'relative', cursor: 'move',
        border: dragHandlers.overId === widget.id && dragHandlers.draggingId !== widget.id
          ? '2px dashed #e91e8c' : '2px solid transparent',
        opacity: dragHandlers.draggingId === widget.id ? 0.5 : 1,
        transition: 'border 0.15s, opacity 0.15s',
      }}>
      <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', gap: 6 }}>
        <button onClick={() => onDuplicate(widget.id)}
          title='Duplicate' style={iconBtn}>⎘</button>
        <button onClick={() => onRemove(widget.id)}
          title='Remove' style={iconBtn}>×</button>
      </div>
      <div style={{ position: 'absolute', top: 8, left: 10, color: '#d1d5db', fontSize: '0.8rem', userSelect: 'none' }}>⋮⋮</div>
      <div style={{ paddingTop: 4 }}>{children}</div>
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
        <ResponsiveContainer width='100%' height={200}>
          <BarChart data={data}>
            <XAxis dataKey='name' tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
            <Tooltip /><CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
            <Bar dataKey='value' fill='#0097b2' radius={[4, 4, 0, 0]} />
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
        <ResponsiveContainer width='100%' height={200}>
          <LineChart data={data}>
            <XAxis dataKey='name' tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
            <Tooltip /><CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
            <Line dataKey='value' stroke='#e91e8c' strokeWidth={2} dot={false} />
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
        <ResponsiveContainer width='100%' height={200}>
          <PieChart>
            <Pie data={data} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius={75} label={({ name }) => name.slice(0, 8)}>
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
        <div style={{ fontWeight: 700, marginBottom: 10, color: '#0c1446', fontSize: '0.85rem' }}>Data Table ({rows.length} rows)</div>
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

// -- Share settings modal ----------------------------------------------------

function ShareSettingsModal({ dashId, initial, onClose, onSaved }) {
  const [expiry, setExpiry] = useState(initial.expires_at ? initial.expires_at.slice(0, 10) : '')
  const [requirePw, setRequirePw] = useState(initial.has_password)
  const [password, setPassword] = useState('')
  const [allowEmbed, setAllowEmbed] = useState(initial.allow_embed !== false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setSaving(true); setErr('')
    try {
      const body = { allow_embed: allowEmbed }
      if (expiry) body.expires_at = new Date(expiry + 'T23:59:59Z').toISOString()
      else body.expires_at = 'never'
      if (requirePw && password) body.password = password
      else if (!requirePw) body.password = ''
      const r = await dashboardsApi.updateShareSettings(dashId, body)
      onSaved(r.data); onClose()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function regenerate() {
    if (!window.confirm('Regenerate the share token? The old link will stop working.')) return
    setSaving(true)
    try {
      const r = await dashboardsApi.updateShareSettings(dashId, { regenerate_token: true })
      onSaved(r.data); onClose()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to regenerate')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ fontWeight: 900, color: '#0c1446', fontSize: '1.05rem', marginBottom: 4 }}>Share settings</div>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 18 }}>Control access to the public link.</div>

        <label style={lblStyle}>Expiry date</label>
        <input type='date' value={expiry} onChange={e => setExpiry(e.target.value)}
          min={new Date().toISOString().slice(0, 10)} style={inputStyle} />
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: 14 }}>
          {expiry ? 'Link stops working after this date.' : 'No expiry — link works until manually revoked.'}
        </div>

        <label style={{ ...lblStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type='checkbox' checked={requirePw} onChange={e => setRequirePw(e.target.checked)} />
          Require password
        </label>
        {requirePw && (
          <input type='password' value={password} onChange={e => setPassword(e.target.value)}
            placeholder={initial.has_password ? 'Leave blank to keep existing' : 'Minimum 4 characters'}
            style={inputStyle} />
        )}

        <label style={{ ...lblStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
          <input type='checkbox' checked={allowEmbed} onChange={e => setAllowEmbed(e.target.checked)} />
          Allow embedding via iframe
        </label>

        {err && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem', marginTop: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={regenerate} disabled={saving}
            style={{ padding: '9px 12px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
            Regenerate link
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} disabled={saving}
            style={{ padding: '9px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ padding: '9px 18px', background: saving ? '#9ca3af' : '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -- Main --------------------------------------------------------------------

export default function DashboardBuilder() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])

  const [widgets, setWidgets] = useState([])
  const [widgetType, setWidgetType] = useState('kpi')
  const [selectedCol, setSelectedCol] = useState('')

  // Dashboard-level filters
  const [filters, setFilters] = useState({ date_column: '', from: '', to: '', dimension: '', values: [] })

  const [dashName, setDashName] = useState('My Dashboard')
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef(null)

  const [savedDashboards, setSavedDashboards] = useState([])
  const [currentDashId, setCurrentDashId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [shareSettings, setShareSettings] = useState({ expires_at: null, has_password: false, allow_embed: true })
  const [sharingBusy, setSharingBusy] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const linkRef = useRef(null)

  // Drag state
  const [draggingId, setDraggingId] = useState(null)
  const [overId, setOverId] = useState(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
    dashboardsApi.list().then(r => setSavedDashboards(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!fileId) { setRows([]); setHeaders([]); setSelectedCol(''); return }
    const f = files.find(f => String(f.id) === String(fileId))
    if (!f) return
    analyticsApi.preview(fileId).then(r => {
      const data = r.data || {}
      const hdrs = data.headers || data.columns || []
      const rr = data.rows || data.data || []
      setHeaders(hdrs)
      setRows(rr)
      const firstNum = hdrs.find(h => rr.some(row => !isNaN(parseFloat(row[h]))))
      setSelectedCol(firstNum || hdrs[0] || '')
    }).catch(() => {})
  }, [fileId, files])

  useEffect(() => { if (editingName && nameInputRef.current) nameInputRef.current.focus() }, [editingName])

  // Heuristic column detection for the filter row
  const { dateCols, dimensionCols } = useMemo(() => {
    const dc = [], mc = []
    if (!rows.length) return { dateCols: [], dimensionCols: [] }
    const sample = rows.slice(0, 50)
    for (const h of headers) {
      const vals = sample.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '')
      if (!vals.length) continue
      const dateHits = vals.filter(v => {
        const s = String(v)
        return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s)
      }).length
      if (dateHits / vals.length > 0.7 && !/^\d+(\.\d+)?$/.test(String(vals[0]))) { dc.push(h); continue }
      const unique = new Set(vals.map(String))
      if (unique.size > 1 && unique.size <= Math.min(50, sample.length)) mc.push(h)
    }
    return { dateCols: dc, dimensionCols: mc }
  }, [headers, rows])

  // Apply dashboard-level filters to the rows that widgets actually render
  const filteredRows = useMemo(() => {
    if (!rows.length) return rows
    let out = rows
    if (filters.date_column && (filters.from || filters.to)) {
      out = out.filter(r => {
        const s = String(r[filters.date_column] || '')
        const t = Date.parse(s)
        if (isNaN(t)) return true
        if (filters.from && t < Date.parse(filters.from)) return false
        if (filters.to && t > Date.parse(filters.to + 'T23:59:59')) return false
        return true
      })
    }
    if (filters.dimension && filters.values?.length) {
      const set = new Set(filters.values.map(String))
      out = out.filter(r => set.has(String(r[filters.dimension])))
    }
    return out
  }, [rows, filters])

  const dimensionValues = useMemo(() => {
    if (!filters.dimension || !rows.length) return []
    const s = new Set()
    for (const r of rows) {
      const v = r[filters.dimension]
      if (v !== null && v !== undefined && v !== '') s.add(String(v))
      if (s.size > 100) break
    }
    return Array.from(s).sort()
  }, [filters.dimension, rows])

  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))

  // -- Widget actions --
  function addWidget() {
    if (!fileId) return
    setWidgets(prev => [...prev, {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      type: widgetType,
      col: selectedCol || numericCols[0] || headers[0] || '',
    }])
  }
  const removeWidget = (id) => setWidgets(prev => prev.filter(w => w.id !== id))
  const duplicateWidget = (id) => setWidgets(prev => {
    const i = prev.findIndex(w => w.id === id)
    if (i < 0) return prev
    const copy = { ...prev[i], id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())) }
    return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
  })

  // -- Drag handlers --
  const dragHandlers = {
    draggingId, overId,
    onDragStart: (e, id) => { setDraggingId(id); e.dataTransfer.effectAllowed = 'move' },
    onDragOver: (e, id) => { e.preventDefault(); if (id !== overId) setOverId(id) },
    onDragEnd: () => { setDraggingId(null); setOverId(null) },
    onDrop: (e, targetId) => {
      e.preventDefault()
      const srcId = draggingId
      setDraggingId(null); setOverId(null)
      if (!srcId || srcId === targetId) return
      setWidgets(prev => {
        const srcIdx = prev.findIndex(w => w.id === srcId)
        const tgtIdx = prev.findIndex(w => w.id === targetId)
        if (srcIdx < 0 || tgtIdx < 0) return prev
        const arr = prev.slice()
        const [moved] = arr.splice(srcIdx, 1)
        arr.splice(tgtIdx, 0, moved)
        return arr
      })
    },
  }

  // -- Dashboard CRUD --
  function newDashboard() {
    setWidgets([]); setDashName('My Dashboard'); setCurrentDashId(null)
    setIsPublic(false); setShareToken(''); setFileId(''); setSaveMsg('')
    setFilters({ date_column: '', from: '', to: '', dimension: '', values: [] })
  }

  async function saveDashboard() {
    if (!widgets.length) { setSaveMsg('Add at least one widget first.'); return }
    setSaving(true); setSaveMsg('')
    const payload = {
      name: dashName,
      file_id: fileId || null,
      config_json: JSON.stringify({ widgets, filters }),
    }
    try {
      let r
      if (currentDashId) r = await dashboardsApi.update(currentDashId, payload)
      else r = await dashboardsApi.create(payload)
      setCurrentDashId(r.data.id)
      setIsPublic(r.data.is_public)
      setShareToken(r.data.share_token || '')
      setShareSettings(r.data.share_settings || { expires_at: null, has_password: false, allow_embed: true })
      const updated = await dashboardsApi.list()
      setSavedDashboards(updated.data || [])
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch {
      setSaveMsg('Error saving.')
    } finally { setSaving(false) }
  }

  async function toggleShare() {
    if (!currentDashId) return
    setSharingBusy(true)
    try {
      const r = await dashboardsApi.share(currentDashId)
      setIsPublic(r.data.is_public)
      setShareToken(r.data.share_token || '')
      setShareSettings(r.data.share_settings || shareSettings)
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
    setShareSettings(dash.share_settings || { expires_at: null, has_password: false, allow_embed: true })
    let cfg = {}
    try { cfg = JSON.parse(dash.config_json || '{}') } catch {}
    setWidgets(cfg.widgets || [])
    setFilters(cfg.filters || { date_column: '', from: '', to: '', dimension: '', values: [] })
    if (dash.file_id) setFileId(String(dash.file_id))
    setSaveMsg('')
  }

  function copyLink() {
    if (linkRef.current) { linkRef.current.select(); document.execCommand('copy') }
  }

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : ''
  const embedCode = shareUrl && shareSettings.allow_embed
    ? `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`
    : ''

  const sel = { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: '0.85rem', cursor: 'pointer' }
  const btn = (bg, color = '#fff') => ({
    background: bg, color, border: 'none', borderRadius: 8, padding: '7px 14px',
    fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
  })

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Sidebar: saved dashboards */}
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

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {editingName ? (
            <input ref={nameInputRef} value={dashName} onChange={e => setDashName(e.target.value)}
              onFocus={e => e.target.select()} onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
              style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0c1446', border: '2px solid #e91e8c', borderRadius: 6, padding: '2px 8px', outline: 'none', width: 220 }} />
          ) : (
            <h2 onClick={() => setEditingName(true)} title='Click to rename'
              style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0c1446', margin: 0, cursor: 'text', padding: '2px 6px', borderRadius: 6, border: '2px solid transparent' }}>
              {dashName} <span style={{ fontSize: '0.7rem', color: '#d1d5db', marginLeft: 6, fontWeight: 400 }}>edit</span>
            </h2>
          )}
          <div style={{ flex: 1 }} />
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={sel}>
            <option value=''>-- Select Dataset --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
          {headers.length > 0 && (
            <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)} style={{ ...sel, maxWidth: 160 }}>
              {headers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select value={widgetType} onChange={e => setWidgetType(e.target.value)} style={sel}>
            {WIDGET_TYPES.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
          </select>
          <button onClick={addWidget} disabled={!fileId} style={{ ...btn('#0097b2'), opacity: fileId ? 1 : 0.4 }}>+ Widget</button>
          <button onClick={saveDashboard} disabled={saving} style={btn('#e91e8c')}>{saving ? 'Saving...' : 'Save'}</button>
          {currentDashId && (
            <>
              <button onClick={toggleShare} disabled={sharingBusy}
                style={{ ...btn(isPublic ? '#10b981' : '#6b7280'), minWidth: 80 }}>
                {sharingBusy ? '...' : isPublic ? 'Shared' : 'Share'}
              </button>
              {isPublic && (
                <button onClick={() => setShowShareModal(true)} style={{ ...btn('#fff', '#374151'), border: '1px solid #d1d5db' }}>
                  ⚙ Settings
                </button>
              )}
            </>
          )}
        </div>

        {/* Filter row — only shown when data is loaded */}
        {headers.length > 0 && (
          <div style={{ background: '#fafbff', borderBottom: '1px solid #e5e7eb', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>Filters</span>

            <select value={filters.date_column} onChange={e => setFilters(f => ({ ...f, date_column: e.target.value }))}
              style={{ ...sel, fontSize: '0.78rem' }} disabled={!dateCols.length}>
              <option value=''>-- No date filter --</option>
              {dateCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {filters.date_column && (
              <>
                <input type='date' value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                  style={{ ...sel, fontSize: '0.78rem' }} />
                <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>to</span>
                <input type='date' value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                  style={{ ...sel, fontSize: '0.78rem' }} />
              </>
            )}

            <span style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

            <select value={filters.dimension} onChange={e => setFilters(f => ({ ...f, dimension: e.target.value, values: [] }))}
              style={{ ...sel, fontSize: '0.78rem' }} disabled={!dimensionCols.length}>
              <option value=''>-- No dimension --</option>
              {dimensionCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {filters.dimension && (
              <select multiple value={filters.values}
                onChange={e => setFilters(f => ({ ...f, values: Array.from(e.target.selectedOptions).map(o => o.value) }))}
                style={{ ...sel, fontSize: '0.78rem', minHeight: 32, maxHeight: 90, minWidth: 160 }}>
                {dimensionValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}

            {(filters.from || filters.to || filters.values.length) ? (
              <button onClick={() => setFilters({ date_column: '', from: '', to: '', dimension: '', values: [] })}
                style={{ ...btn('#fff', '#6b7280'), border: '1px solid #d1d5db', padding: '5px 10px', fontSize: '0.75rem' }}>
                Clear filters
              </button>
            ) : null}

            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {filteredRows.length} / {rows.length} rows visible
            </span>
          </div>
        )}

        {saveMsg && (
          <div style={{ background: saveMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4', color: saveMsg.startsWith('Error') ? '#dc2626' : '#15803d', padding: '6px 20px', fontSize: '0.82rem', fontWeight: 600 }}>
            {saveMsg}
          </div>
        )}

        {isPublic && shareToken && (
          <>
            <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>Public link:</span>
              <input ref={linkRef} readOnly value={shareUrl} style={{ flex: 1, minWidth: 260, padding: '4px 10px', borderRadius: 6, border: '1px solid #86efac', fontSize: '0.78rem', background: '#fff', color: '#374151' }} />
              <button onClick={copyLink} style={btn('#15803d')}>Copy</button>
              {shareSettings.has_password && <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>🔒 password</span>}
              {shareSettings.expires_at && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>⏳ expires {shareSettings.expires_at.slice(0, 10)}</span>}
              <button onClick={toggleShare} style={btn('#dc2626')}>Unshare</button>
            </div>
            {shareSettings.allow_embed && embedCode && (
              <div style={{ background: '#f5f3ff', borderBottom: '1px solid #ddd6fe', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700 }}>Embed code:</span>
                <input readOnly onClick={e => e.target.select()} value={embedCode} style={{ flex: 1, minWidth: 260, padding: '4px 10px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: '0.75rem', background: '#fff', color: '#374151' }} />
                <button onClick={() => navigator.clipboard.writeText(embedCode).catch(() => {})} style={btn('#7c3aed')}>Copy embed</button>
              </div>
            )}
          </>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {widgets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Your canvas is empty</div>
              <div style={{ fontSize: '0.85rem' }}>Select a dataset above, then click "+ Widget" to start building.</div>
              <div style={{ fontSize: '0.78rem', marginTop: 6, color: '#d1d5db' }}>Tip: drag widgets to reorder · click ⎘ to duplicate</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {widgets.map(w => (
                <Widget key={w.id} widget={w} rows={filteredRows} headers={headers}
                  onRemove={removeWidget} onDuplicate={duplicateWidget} dragHandlers={dragHandlers} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showShareModal && currentDashId && (
        <ShareSettingsModal dashId={currentDashId} initial={shareSettings}
          onClose={() => setShowShareModal(false)}
          onSaved={(data) => {
            setShareSettings(data.share_settings || shareSettings)
            setShareToken(data.share_token || shareToken)
            setIsPublic(data.is_public ?? isPublic)
          }} />
      )}
    </div>
  )
}

// -- styles ------------------------------------------------------------------

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
  fontSize: '1rem', lineHeight: 1, padding: 2, borderRadius: 4,
}
const lblStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 5, marginTop: 4 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: 4 }
