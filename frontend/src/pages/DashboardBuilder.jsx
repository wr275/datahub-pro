import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi, dashboardsApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']

const WIDGET_TYPES = [
  { type: 'kpi',   label: 'KPI Card',   icon: 'ð¢' },
  { type: 'bar',   label: 'Bar Chart',  icon: 'ð' },
  { type: 'line',  label: 'Line Chart', icon: 'ð' },
  { type: 'pie',   label: 'Pie Chart',  icon: 'ð¥§' },
  { type: 'table', label: 'Data Table', icon: 'ð' },
]

// ââ Widget renderer ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function Widget({ widget, rows, headers, onRemove, readOnly }) {
  const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))

  const removeBtn = !readOnly && (
    <button onClick={onRemove} style={{
      position: 'absolute', top: 8, right: 8,
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#9ca3af', fontSize: '1rem', zIndex: 1,
    }}>â</button>
  )

  if (widget.type === 'kpi') {
    const col = widget.col || numericCols[0]
    const vals = col ? rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v)) : []
    const total = vals.reduce((a, b) => a + b, 0)
    return (
      <div style={{
        background: '#fff', borderRadius: 12, padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #e91e8c', position: 'relative',
      }}>
        {removeBtn}
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
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        {removeBtn}
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${yCol} by ${xCol}`}</div>
        <ResponsiveContainer width="100%" height={160}>
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
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        {removeBtn}
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${yCol} trend`}</div>
        <ResponsiveContainer width="100%" height={160}>
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
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        {removeBtn}
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || `${col} breakdown`}</div>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value"
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
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
        {removeBtn}
        <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem', marginBottom: 12 }}>{widget.label || 'Data Table'}</div>
        <div style={{ overflowX: 'auto', maxHeight: 200 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {headers.slice(0, 5).map(h => (
                  <th key={h} style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((r, i) => (
                <tr key={i}>
                  {headers.slice(0, 5).map(h => (
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

// ââ Main component âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export default function DashboardBuilder() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [widgets, setWidgets] = useState([])
  const [dashTitle, setDashTitle] = useState('My Dashboard')
  const [addType, setAddType] = useState('kpi')

  // Persistence state
  const [savedDashboards, setSavedDashboards] = useState([])
  const [currentDashId, setCurrentDashId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Share state
  const [isPublic, setIsPublic] = useState(false)
  const [shareToken, setShareToken] = useState(null)
  const [sharingBusy, setSharingBusy] = useState(false)
  const [showSharePanel, setShowSharePanel] = useState(false)
  const linkRef = useRef(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
    dashboardsApi.list().then(r => setSavedDashboards(r.data || [])).catch(() => {})
  }, [])

  function loadFile(id) {
    setFileId(id)
    if (!id) { setHeaders([]); setRows([]); return }
    analyticsApi.preview(id)
      .then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) })
      .catch(() => {})
  }

  function addWidget() {
    const numericCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
    const widget = { id: Date.now(), type: addType, label: '' }
    if (addType === 'kpi') widget.col = numericCols[0]
    else if (['bar', 'line'].includes(addType)) { widget.xCol = headers[0]; widget.yCol = numericCols[0] }
    else if (addType === 'pie') widget.col = headers[0]
    setWidgets([...widgets, widget])
  }

  function removeWidget(id) {
    setWidgets(widgets.filter(w => w.id !== id))
  }

  // ââ Load saved dashboard ââââââââââââââââââââââââââââââââââââââââââââââââ

  function loadDashboard(dash) {
    setCurrentDashId(dash.id)
    setDashTitle(dash.name)
    setIsPublic(dash.is_public || false)
    setShareToken(dash.share_token || null)
    setShowSharePanel(false)

    let cfg = { widgets: [] }
    try { cfg = JSON.parse(dash.config_json || '{}') } catch {}
    const loadedWidgets = (cfg.widgets || []).map((w, i) => ({ ...w, id: w.id || Date.now() + i }))
    setWidgets(loadedWidgets)

    const fid = dash.file_id || ''
    if (fid) loadFile(fid)
    else { setFileId(''); setHeaders([]); setRows([]) }
  }

  function newDashboard() {
    setCurrentDashId(null)
    setDashTitle('My Dashboard')
    setWidgets([])
    setFileId('')
    setHeaders([])
    setRows([])
    setIsPublic(false)
    setShareToken(null)
    setShowSharePanel(false)
    setSaveMsg('')
  }

  // ââ Save âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  async function saveDashboard() {
    setSaving(true)
    setSaveMsg('')
    const config_json = JSON.stringify({ widgets })
    const payload = { name: dashTitle, config_json, file_id: fileId || null }
    try {
      let res
      if (currentDashId) {
        res = await dashboardsApi.update(currentDashId, payload)
      } else {
        res = await dashboardsApi.create(payload)
        setCurrentDashId(res.data.id)
        setShareToken(res.data.share_token)
        setIsPublic(res.data.is_public)
      }
      // Refresh list
      const listRes = await dashboardsApi.list()
      setSavedDashboards(listRes.data || [])
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch {
      setSaveMsg('Save failed')
    }
    setSaving(false)
  }

  // ââ Share ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  async function toggleShare() {
    if (!currentDashId) { setSaveMsg('Save first'); return }
    setSharingBusy(true)
    try {
      const res = await dashboardsApi.share(currentDashId)
      setIsPublic(res.data.is_public)
      setShareToken(res.data.share_token)
      setShowSharePanel(res.data.is_public)
    } catch {}
    setSharingBusy(false)
  }

  function copyLink() {
    const url = shareUrl()
    navigator.clipboard.writeText(url).then(() => {
      setSaveMsg('Link copied!')
      setTimeout(() => setSaveMsg(''), 2000)
    })
  }

  function shareUrl() {
    return `${window.location.origin}/share/${shareToken}`
  }

  // ââ Delete âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  async function deleteDashboard(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this dashboard?')) return
    await dashboardsApi.delete(id).catch(() => {})
    const listRes = await dashboardsApi.list()
    setSavedDashboards(listRes.data || [])
    if (currentDashId === id) newDashboard()
  }

  // ââ Render âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  const btnBase = {
    padding: '9px 16px', border: 'none', borderRadius: 8,
    fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
  }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>

      {/* ââ Top toolbar ââ */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={dashTitle}
          onChange={e => setDashTitle(e.target.value)}
          style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446', border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 180 }}
        />

        {/* Dataset picker */}
        <select value={fileId} onChange={e => loadFile(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', minWidth: 180 }}>
          <option value="">-- Select Dataset --</option>
          {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
        </select>

        {/* Add widget */}
        {fileId && (
          <>
            <select value={addType} onChange={e => setAddType(e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
              {WIDGET_TYPES.map(w => <option key={w.type} value={w.type}>{w.icon} {w.label}</option>)}
            </select>
            <button onClick={addWidget} style={{ ...btnBase, background: '#0097b2', color: '#fff' }}>
              + Widget
            </button>
          </>
        )}

        {/* Save */}
        <button onClick={saveDashboard} disabled={saving}
          style={{ ...btnBase, background: '#e91e8c', color: '#fff', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Savingâ¦' : currentDashId ? 'ð¾ Save' : 'ð¾ Save Dashboard'}
        </button>

        {/* Share toggle */}
        {currentDashId && (
          <button onClick={toggleShare} disabled={sharingBusy}
            style={{ ...btnBase, background: isPublic ? '#10b981' : '#6b7280', color: '#fff', opacity: sharingBusy ? 0.7 : 1 }}>
            {isPublic ? 'ð Shared' : 'ð Share'}
          </button>
        )}

        {/* New */}
        <button onClick={newDashboard} style={{ ...btnBase, background: '#f3f4f6', color: '#374151' }}>
          + New
        </button>

        {/* Status msg */}
        {saveMsg && (
          <span style={{ fontSize: '0.8rem', color: saveMsg.includes('fail') ? '#ef4444' : '#10b981', fontWeight: 600 }}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ââ Share panel ââ */}
      {isPublic && shareToken && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: 600 }}>ð Public link:</span>
          <input ref={linkRef} readOnly value={shareUrl()}
            style={{ flex: 1, minWidth: 260, padding: '6px 10px', border: '1px solid #86efac', borderRadius: 6, fontSize: '0.8rem', color: '#166534', background: '#fff' }}
            onFocus={e => e.target.select()}
          />
          <button onClick={copyLink} style={{ ...btnBase, background: '#10b981', color: '#fff', padding: '7px 14px' }}>
            Copy
          </button>
          <button onClick={toggleShare} disabled={sharingBusy}
            style={{ ...btnBase, background: '#ef4444', color: '#fff', padding: '7px 14px', fontSize: '0.8rem' }}>
            Unshare
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ââ Saved dashboards sidebar ââ */}
        {savedDashboards.length > 0 && (
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              My Dashboards
            </div>
            {savedDashboards.map(d => (
              <div key={d.id} onClick={() => loadDashboard(d)}
                style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                  background: currentDashId === d.id ? '#eff6ff' : '#f9fafb',
                  border: `1px solid ${currentDashId === d.id ? '#bfdbfe' : '#e5e7eb'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0c1446' }}>{d.name}</div>
                  {d.is_public && <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: 2 }}>ð Shared</div>}
                </div>
                <button onClick={e => deleteDashboard(d.id, e)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.75rem', padding: 2 }}>
                  â
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ââ Canvas ââ */}
        <div style={{ flex: 1 }}>
          {widgets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {widgets.map(w => (
                <Widget key={w.id} widget={w} rows={rows} headers={headers}
                  onRemove={() => removeWidget(w.id)} readOnly={false} />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: 80, color: '#9ca3af',
              border: '2px dashed #e5e7eb', borderRadius: 16,
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>ð¨</div>
              <div style={{ fontSize: '1rem', marginBottom: 8 }}>Your canvas is empty</div>
              <div style={{ fontSize: '0.875rem' }}>
                {savedDashboards.length > 0
                  ? 'Select a saved dashboard on the left, or pick a dataset above and add widgets'
                  : 'Select a dataset above, then click "+ Widget" to start building'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
