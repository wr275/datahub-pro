/**
 * RFM 2.0 — server-side compute with custom segments, time window,
 * anchor-date control, CSV export, and per-segment AI action plans.
 *
 * The 1.0 version did the math client-side (via analyticsApi.preview) which
 * broke on large datasets and had no way to tweak segment ranges, narrow
 * the time window, or export the scored customer list. This page delegates
 * everything to /api/rfm/analyze and renders the structured response.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { filesApi, analyticsApi, rfmApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PINK = '#e91e8c'
const TEAL = '#0097b2'
const NAVY = '#0c1446'

const WINDOW_PRESETS = [
  { label: 'All time', days: null },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
  { label: 'Last 24 months', days: 730 },
]

const ANCHOR_MODES = [
  { id: 'auto',   label: 'Latest transaction (recommended)' },
  { id: 'today',  label: 'Today' },
  { id: 'custom', label: 'Custom date…' },
]

const selectStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: '0.875rem',
  background: '#fff',
}

const btnPrimary = (enabled) => ({
  padding: '10px 22px',
  background: enabled ? PINK : '#d1d5db',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 700,
  cursor: enabled ? 'pointer' : 'default',
  whiteSpace: 'nowrap',
  fontSize: '0.875rem',
})

const btnGhost = (enabled) => ({
  padding: '9px 16px',
  background: '#fff',
  color: enabled ? NAVY : '#9ca3af',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontWeight: 600,
  cursor: enabled ? 'pointer' : 'default',
  fontSize: '0.85rem',
})

// ───── Custom-segment editor ─────

function SegmentEditor({ segments, onChange }) {
  function updateRange(idx, key, which, value) {
    const v = parseInt(value, 10)
    if (Number.isNaN(v)) return
    const copy = segments.map((s, i) => {
      if (i !== idx) return s
      const range = [...s[key]]
      range[which] = Math.max(1, Math.min(5, v))
      // keep min ≤ max
      if (which === 0 && range[0] > range[1]) range[1] = range[0]
      if (which === 1 && range[1] < range[0]) range[0] = range[1]
      return { ...s, [key]: range }
    })
    onChange(copy)
  }
  function rename(idx, name) {
    onChange(segments.map((s, i) => (i === idx ? { ...s, name } : s)))
  }
  function remove(idx) {
    onChange(segments.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([
      ...segments,
      { name: 'New segment', r: [1, 5], f: [1, 5], m: [1, 5], color: '#6b7280', desc: '' },
    ])
  }

  return (
    <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 10 }}>
        First match wins. Customers who don't match any rule land in "Other".
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px 1.6fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || '#6b7280' }} />
            <input value={s.name} onChange={e => rename(i, e.target.value)} style={{ ...selectStyle, padding: '6px 10px', fontSize: '0.82rem' }} />
            {[['r', 'R'], ['f', 'F'], ['m', 'M']].map(([k, lbl]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#374151' }}>
                <span style={{ fontWeight: 700, marginRight: 4 }}>{lbl}:</span>
                <input type="number" min="1" max="5" value={s[k][0]} onChange={e => updateRange(i, k, 0, e.target.value)} style={{ width: 40, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.8rem' }} />
                <span style={{ color: '#9ca3af' }}>–</span>
                <input type="number" min="1" max="5" value={s[k][1]} onChange={e => updateRange(i, k, 1, e.target.value)} style={{ width: 40, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.8rem' }} />
              </div>
            ))}
            <button onClick={() => remove(i)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Remove</button>
          </div>
        ))}
      </div>
      <button onClick={add} style={{ marginTop: 10, ...btnGhost(true) }}>+ Add segment</button>
    </div>
  )
}

// ───── Action plan modal (LLM) ─────

function ActionModal({ segment, onClose }) {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    rfmApi.aiAction({
      segment_name: segment.name,
      segment_desc: segment.desc || '',
      count: segment.count,
      avg_monetary: segment.avg_monetary,
      avg_frequency: segment.avg_frequency,
      avg_recency_days: segment.avg_recency_days,
    })
      .then(r => { if (!cancelled) setPlan(r.data?.plan || null) })
      .catch(err => {
        if (cancelled) return
        const detail = err.response?.data?.detail
        if (detail?.code === 'ai_disabled') setError('AI features are not enabled for this workspace.')
        else if (err.response?.status === 500) setError('LLM is not configured on the server.')
        else if (err.response?.status === 502) setError('The model returned an unparseable response — try again.')
        else setError('Failed to generate action plan.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [segment])

  const priorityColor = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' }[plan?.priority] || '#6b7280'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(12,20,70,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 680, width: '100%', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(12,20,70,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Action plan</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: NAVY }}>{segment.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>{segment.count} customers · avg ${Number(segment.avg_monetary).toLocaleString(undefined, { maximumFractionDigits: 0 })} · {Number(segment.avg_recency_days).toFixed(0)}d since last purchase</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #f3f4f6', borderTop: '3px solid ' + PINK, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Generating plan…</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>
        )}

        {plan && !loading && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ background: priorityColor + '22', color: priorityColor, padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {plan.priority || 'medium'} priority
              </span>
            </div>
            <div style={{ fontSize: '0.95rem', lineHeight: 1.5, color: NAVY, marginBottom: 18, fontWeight: 500 }}>{plan.headline}</div>

            {Array.isArray(plan.actions) && plan.actions.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Next best actions</div>
                <ol style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 12 }}>
                  {plan.actions.map((a, i) => (
                    <li key={i} style={{ fontSize: '0.88rem', lineHeight: 1.4 }}>
                      <div>
                        <span style={{ background: TEAL + '22', color: TEAL, padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{a.channel}</span>
                        <strong style={{ color: NAVY }}>{a.action}</strong>
                      </div>
                      {a.rationale && <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: 2 }}>{a.rationale}</div>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(plan.email_subject || plan.email_body) && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Example email</div>
                {plan.email_subject && (
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: NAVY, marginBottom: 8 }}>Subject: {plan.email_subject}</div>
                )}
                {plan.email_body && (
                  <div style={{ fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{plan.email_body}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ───── Main page ─────

export default function RFMAnalysis() {
  const [user, setUser] = useState(null)
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const [customerCol, setCustomerCol] = useState('')
  const [dateCol, setDateCol] = useState('')
  const [monetaryCol, setMonetaryCol] = useState('')

  const [windowDays, setWindowDays] = useState(null)     // null = all-time
  const [anchorMode, setAnchorMode] = useState('auto')
  const [anchorCustom, setAnchorCustom] = useState('')

  const [segmentsDirty, setSegmentsDirty] = useState(false)
  const [segments, setSegments] = useState(null)          // null => use defaults
  const [editorOpen, setEditorOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const [actionFor, setActionFor] = useState(null)

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('user') || 'null')) } catch {}
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
    rfmApi.defaults()
      .then(r => { if (!segmentsDirty) setSegments(r.data?.segments || null) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aiEnabled = useMemo(() => !!(user?.organisation?.ai_enabled ?? user?.ai_enabled), [user])

  function onFileChange(id) {
    setFileId(id); setHeaders([]); setResult(null); setError('')
    setCustomerCol(''); setDateCol(''); setMonetaryCol('')
    if (!id) return
    setPreviewLoading(true)
    analyticsApi.preview(id)
      .then(r => {
        const cols = r.data.headers || []
        setHeaders(cols)
        // Auto-guess columns if obvious.
        const lc = cols.map(c => c.toLowerCase())
        const guess = (patterns) => {
          for (const p of patterns) {
            const i = lc.findIndex(c => c.includes(p))
            if (i >= 0) return cols[i]
          }
          return ''
        }
        setCustomerCol(guess(['customer_id', 'customer id', 'customerid', 'customer', 'client', 'user_id', 'email']))
        setDateCol(guess(['order_date', 'date', 'created', 'timestamp']))
        setMonetaryCol(guess(['total', 'amount', 'revenue', 'price', 'monetary', 'value']))
      })
      .catch(() => setError('Could not load file columns.'))
      .finally(() => setPreviewLoading(false))
  }

  function resolveAnchorDate() {
    if (anchorMode === 'auto')   return null
    if (anchorMode === 'today')  return new Date().toISOString().slice(0, 10)
    if (anchorMode === 'custom') return anchorCustom || null
    return null
  }

  function buildRequest() {
    const req = {
      file_id: fileId,
      customer_col: customerCol,
      date_col: dateCol,
      monetary_col: monetaryCol,
    }
    const a = resolveAnchorDate()
    if (a) req.anchor_date = a
    if (windowDays) req.window_days = windowDays
    if (segmentsDirty && segments) {
      req.segments = segments.map(s => ({
        name: s.name, r: s.r, f: s.f, m: s.m,
        color: s.color || null, desc: s.desc || null,
      }))
    }
    return req
  }

  async function run() {
    if (!fileId || !customerCol || !dateCol || !monetaryCol) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await rfmApi.analyze(buildRequest())
      setResult(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed. Check column selection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function exportCsv() {
    if (!fileId || !customerCol || !dateCol || !monetaryCol) return
    setExporting(true)
    try {
      const r = await rfmApi.export(buildRequest())
      const blob = new Blob([r.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rfm_scores.csv'
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('CSV export failed.')
    } finally {
      setExporting(false)
    }
  }

  function updateSegments(next) {
    setSegments(next); setSegmentsDirty(true)
  }

  // Chart + overview data derived from result.
  const segmentSummary = result?.segment_summary || []
  const chartData = segmentSummary.map(s => ({ name: s.name, count: s.count, color: s.color || '#6b7280' }))
  const diag = result?.diagnostics || {}
  const totals = result?.totals || {}

  const canRun = fileId && customerCol && dateCol && monetaryCol && !loading
  const canExport = canRun && result

  return (
    <div style={{ padding: 32, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: NAVY }}>RFM Analysis</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem' }}>
          Segment customers by Recency, Frequency, and Monetary value. Customise segments, narrow the window, and get AI action plans per segment.
        </p>
      </div>

      {/* Config card */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => onFileChange(e.target.value)} style={selectStyle}>
              <option value="">— Choose a file —</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Customer ID column</div>
            <select value={customerCol} onChange={e => setCustomerCol(e.target.value)} style={selectStyle} disabled={!headers.length}>
              <option value="">— Select —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Date column</div>
            <select value={dateCol} onChange={e => setDateCol(e.target.value)} style={selectStyle} disabled={!headers.length}>
              <option value="">— Select —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Monetary column</div>
            <select value={monetaryCol} onChange={e => setMonetaryCol(e.target.value)} style={selectStyle} disabled={!headers.length}>
              <option value="">— Select —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Time window</div>
            <select value={windowDays ?? ''} onChange={e => setWindowDays(e.target.value ? parseInt(e.target.value, 10) : null)} style={selectStyle}>
              {WINDOW_PRESETS.map(w => (
                <option key={w.label} value={w.days ?? ''}>{w.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Anchor date</div>
            <select value={anchorMode} onChange={e => setAnchorMode(e.target.value)} style={selectStyle}>
              {ANCHOR_MODES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              {anchorMode === 'custom' ? 'Custom anchor' : ' '}
            </div>
            <input
              type="date"
              value={anchorCustom}
              onChange={e => setAnchorCustom(e.target.value)}
              disabled={anchorMode !== 'custom'}
              style={{ ...selectStyle, opacity: anchorMode === 'custom' ? 1 : 0.5 }}
            />
          </div>
          <button onClick={run} disabled={!canRun} style={btnPrimary(canRun)}>
            {loading ? 'Running…' : 'Run RFM'}
          </button>
          <button onClick={exportCsv} disabled={!canExport || exporting} style={btnGhost(!!canExport && !exporting)}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setEditorOpen(!editorOpen)} style={{ background: 'transparent', border: 'none', color: TEAL, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}>
            {editorOpen ? '▼' : '▶'} Customise segments {segmentsDirty ? '(edited)' : ''}
          </button>
          {previewLoading && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Loading columns…</div>}
        </div>

        {editorOpen && segments && (
          <div style={{ marginTop: 12 }}>
            <SegmentEditor segments={segments} onChange={updateSegments} />
          </div>
        )}

        {!files.length && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#9ca3af' }}>No files found. Upload a CSV or Excel file via My Files first.</div>}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#dc2626', fontSize: '0.875rem', marginBottom: 20 }}>
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #f3f4f6', borderTop: '4px solid ' + PINK, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#6b7280' }}>Computing RFM scores on the server…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {result && !loading && (
        <div>
          {/* Totals strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
            <KpiTile label="Customers"   value={(totals.customers || 0).toLocaleString()} />
            <KpiTile label="Transactions" value={(totals.transactions || 0).toLocaleString()} />
            <KpiTile label="Total revenue" value={'$' + Number(totals.monetary || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
            <KpiTile label="Anchor" value={(result.anchor_date || '').slice(0, 10)} hint={anchorMode === 'auto' ? 'Auto-detected' : anchorMode} />
          </div>

          {/* Segment cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
            {segmentSummary.map(s => (
              <div key={s.name} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid ' + (s.color || '#6b7280'), display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: NAVY }}>{s.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{s.pct}%</div>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color || '#6b7280' }}>{s.count.toLocaleString()}</div>
                <div style={{ fontSize: '0.74rem', color: '#9ca3af' }}>customers</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '8px 0 10px', minHeight: 30 }}>{s.desc}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.72rem', color: '#374151', marginBottom: 10 }}>
                  <div>Avg: <strong>${Number(s.avg_monetary).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
                  <div>Freq: <strong>{Number(s.avg_frequency).toFixed(1)}</strong></div>
                  <div>Recency: <strong>{Number(s.avg_recency_days).toFixed(0)}d</strong></div>
                  <div>Total: <strong>${Number(s.total_monetary).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
                </div>
                <button
                  onClick={() => setActionFor(s)}
                  disabled={!aiEnabled || s.count === 0}
                  title={!aiEnabled ? 'Enable AI add-on to use this' : s.count === 0 ? 'No customers in this segment' : ''}
                  style={{
                    marginTop: 'auto',
                    padding: '7px 10px',
                    border: '1px solid ' + ((!aiEnabled || s.count === 0) ? '#e5e7eb' : TEAL),
                    background: (!aiEnabled || s.count === 0) ? '#f9fafb' : '#fff',
                    color: (!aiEnabled || s.count === 0) ? '#9ca3af' : TEAL,
                    borderRadius: 7,
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    cursor: (!aiEnabled || s.count === 0) ? 'default' : 'pointer',
                  }}>
                  {aiEnabled ? '✨ Suggest actions' : '✨ AI add-on required'}
                </button>
              </div>
            ))}
          </div>

          {/* Chart + diagnostics */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: NAVY, marginBottom: 14 }}>Segment distribution</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: NAVY, marginBottom: 10 }}>Data quality</div>
              <DiagnosticRow label="Rows in file"        value={diag.total_rows} />
              <DiagnosticRow label="Transactions kept"   value={diag.kept_transactions} good />
              <DiagnosticRow label="Unique customers"    value={diag.unique_customers} good />
              <DiagnosticRow label="Invalid date"        value={diag.invalid_date} warn />
              <DiagnosticRow label="Missing customer ID" value={diag.invalid_customer} warn />
              <DiagnosticRow label="Missing monetary"    value={diag.invalid_monetary} warn />
              <DiagnosticRow label="Outside window"      value={diag.outside_window} muted />
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 10, lineHeight: 1.4 }}>
                Rows with invalid or missing data are excluded. High counts suggest the date or customer columns may need cleaning.
              </div>
            </div>
          </div>

          {/* Customer table */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: NAVY }}>Top customers by spend</div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                {result.customers.length > 100 ? 'Showing top 100' : `Showing ${result.customers.length}`} — full list via CSV export
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left',   padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Customer</th>
                    <th style={{ textAlign: 'right',  padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Recency (d)</th>
                    <th style={{ textAlign: 'right',  padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Frequency</th>
                    <th style={{ textAlign: 'right',  padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Monetary</th>
                    <th style={{ textAlign: 'right',  padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>R/F/M</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {result.customers.slice(0, 100).map((c, i) => {
                    const seg = segmentSummary.find(s => s.name === c.segment)
                    const segColor = seg?.color || '#6b7280'
                    return (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>{c.id}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{c.recency}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{c.frequency}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>${Number(c.monetary).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontFamily: 'monospace' }}>{c.r_score}/{c.f_score}/{c.m_score}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                          <span style={{ background: segColor + '22', color: segColor, padding: '2px 10px', borderRadius: 20, fontWeight: 600, fontSize: '0.76rem' }}>{c.segment}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {result.customers.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No customer records — check your column selection and data quality.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: 70, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8, color: '#d1d5db', fontWeight: 300 }}>[ RFM ]</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Map your columns to get started</div>
          <div style={{ fontSize: '0.875rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.55 }}>
            Select a file and the Customer ID, Date, and Monetary columns. Adjust the time window, segment definitions, and anchor date as needed, then Run RFM.
          </div>
        </div>
      )}

      {actionFor && <ActionModal segment={actionFor} onClose={() => setActionFor(null)} />}
    </div>
  )
}

function KpiTile({ label, value, hint }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: NAVY, marginTop: 2 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function DiagnosticRow({ label, value, good, warn, muted }) {
  const n = value || 0
  const color = warn && n > 0 ? '#f59e0b'
    : good && n > 0 ? '#10b981'
    : muted && n > 0 ? '#9ca3af'
    : '#374151'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.82rem' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{n.toLocaleString()}</span>
    </div>
  )
}
