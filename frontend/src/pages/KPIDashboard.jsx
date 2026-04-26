import React, { useState, useEffect, useMemo, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

// -----------------------------------------------------------------------------
// Date bucketing (shared vocabulary with Period Comparison 2.0)
// -----------------------------------------------------------------------------

function parseDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw) ? null : raw
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return isNaN(d) ? null : d
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [mm, dd, yyyy] = s.split(/\//)
    const d = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`)
    return isNaN(d) ? null : d
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}

function monthKey(d) {
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

function priorMonthKey(key) {
  // "2026-03" -> "2026-02"
  const [y, m] = key.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function yoyMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

// -----------------------------------------------------------------------------
// Aggregations
// -----------------------------------------------------------------------------

const AGG_FUNCS = {
  sum:   (vals) => vals.reduce((a, b) => a + b, 0),
  avg:   (vals) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
  count: (vals) => vals.length,
  min:   (vals) => vals.length ? Math.min(...vals) : 0,
  max:   (vals) => vals.length ? Math.max(...vals) : 0,
}

const AGG_LABELS = {
  sum: 'Sum', avg: 'Average', count: 'Count', min: 'Min', max: 'Max',
}

// -----------------------------------------------------------------------------
// KPI computation
// -----------------------------------------------------------------------------

function computeKpi(rows, kpi, dateCol) {
  const agg = AGG_FUNCS[kpi.agg] || AGG_FUNCS.sum
  // Filter by dimension if set
  const filtered = kpi.filterCol && kpi.filterVal
    ? rows.filter(r => String(r[kpi.filterCol]) === String(kpi.filterVal))
    : rows

  const nums = filtered
    .map(r => Number(r[kpi.metric]))
    .filter(n => Number.isFinite(n))

  const currentValue = agg(nums)

  // Trend buckets (monthly)
  const trend = {}
  if (dateCol) {
    filtered.forEach(r => {
      const d = parseDate(r[dateCol])
      if (!d) return
      const k = monthKey(d)
      const v = Number(r[kpi.metric])
      if (!trend[k]) trend[k] = []
      if (Number.isFinite(v)) trend[k].push(v)
    })
  }

  const trendKeys = Object.keys(trend).sort()
  const trendSeries = trendKeys.map(k => ({ key: k, value: agg(trend[k] || []) }))
  const lastKey = trendKeys[trendKeys.length - 1]

  let mom = null, yoy = null, current = currentValue, prior = null
  if (lastKey) {
    const curAgg = agg(trend[lastKey] || [])
    current = curAgg
    const pmKey = priorMonthKey(lastKey)
    const yKey = yoyMonthKey(lastKey)
    if (trend[pmKey]?.length) {
      const priorAgg = agg(trend[pmKey])
      prior = priorAgg
      mom = priorAgg ? ((curAgg - priorAgg) / Math.abs(priorAgg)) * 100 : null
    }
    if (trend[yKey]?.length) {
      const yAgg = agg(trend[yKey])
      yoy = yAgg ? ((curAgg - yAgg) / Math.abs(yAgg)) * 100 : null
    }
  }

  // Top contributors (drilldown) — only meaningful when there's a groupBy col
  let contributors = []
  if (kpi.groupBy) {
    const buckets = {}
    filtered.forEach(r => {
      const g = String(r[kpi.groupBy] ?? '—')
      const v = Number(r[kpi.metric])
      if (!buckets[g]) buckets[g] = []
      if (Number.isFinite(v)) buckets[g].push(v)
    })
    contributors = Object.entries(buckets)
      .map(([name, vs]) => ({ name, value: agg(vs), count: vs.length }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10)
  }

  const targetProgress = kpi.target
    ? Math.min((current / kpi.target) * 100, 999)
    : null

  return {
    kpi,
    currentValue: current,
    totalValue: currentValue,   // value across ALL rows (no date filter)
    prior,
    mom, yoy,
    trendSeries,
    contributors,
    targetProgress,
    rowCount: filtered.length,
  }
}

// -----------------------------------------------------------------------------
// Persistence
// -----------------------------------------------------------------------------

function loadKpisFor(fileId) {
  try {
    const raw = localStorage.getItem('kpi_dashboard:' + fileId)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
function saveKpisFor(fileId, kpis) {
  try { localStorage.setItem('kpi_dashboard:' + fileId, JSON.stringify(kpis)) } catch {}
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

function fmt(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  if (abs >= 100) return n.toFixed(0)
  return n.toFixed(2)
}

function fmtPct(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function KpiCard({ result, onDrill, onEdit, onDelete, fileId }) {
  const { kpi, currentValue, mom, yoy, trendSeries, targetProgress, rowCount } = result
  const deltaColor = (v) => v === null || v === undefined ? '#9ca3af' : v >= 0 ? '#10b981' : '#dc2626'
  const cardLabel = kpi.label || kpi.metric

  return (
    <div style={{
      background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: '18px 20px',
      borderTop: '3px solid #e91e8c', position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {cardLabel}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <OpenInAskYourData
            variant="icon"
            fileId={fileId}
            prompt={`Break down ${cardLabel} (${AGG_LABELS[kpi.agg]} of ${kpi.metric}) by the most useful dimension and explain the change.`}
          />
          <PinToDashboard
            variant="icon"
            widget={{
              type: 'kpi',
              col: kpi.metric,
              label: cardLabel,
              file_id: fileId,
              extra: { agg: kpi.agg, target: kpi.target, filterCol: kpi.filterCol, filterVal: kpi.filterVal },
            }}
          />
          <button onClick={onEdit} title='Edit'
            style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem' }}>
            ✎
          </button>
          <button onClick={onDelete} title='Remove'
            style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}>
            ×
          </button>
        </div>
      </div>
      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 6 }}>
        {AGG_LABELS[kpi.agg]} of {kpi.metric}
        {kpi.filterCol && kpi.filterVal ? <> · where {kpi.filterCol}={kpi.filterVal}</> : null}
      </div>

      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0c1446', lineHeight: 1.1 }}>
        {fmt(currentValue)}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.78rem', fontWeight: 700 }}>
        {mom !== null && (
          <span style={{ color: deltaColor(mom) }}>
            {mom >= 0 ? '▲' : '▼'} {fmtPct(mom)} MoM
          </span>
        )}
        {yoy !== null && (
          <span style={{ color: deltaColor(yoy) }}>
            {yoy >= 0 ? '▲' : '▼'} {fmtPct(yoy)} YoY
          </span>
        )}
        {mom === null && yoy === null && (
          <span style={{ color: '#9ca3af', fontWeight: 500 }}>
            No date column — add one for trends
          </span>
        )}
      </div>

      {trendSeries.length > 1 && (
        <div style={{ height: 46, marginTop: 12, marginLeft: -4 }}>
          <ResponsiveContainer>
            <LineChart data={trendSeries} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <Line type="monotone" dataKey="value" stroke="#e91e8c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {targetProgress !== null && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>
            <span>Target: {fmt(kpi.target)}</span>
            <span style={{ fontWeight: 700, color: targetProgress >= 100 ? '#10b981' : '#e91e8c' }}>
              {targetProgress.toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 6, background: '#f1f3f9', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: Math.min(targetProgress, 100) + '%', height: '100%',
              background: targetProgress >= 100 ? '#10b981' : 'linear-gradient(90deg,#e91e8c,#0097b2)',
            }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: '0.7rem', color: '#9ca3af' }}>
        {rowCount.toLocaleString()} rows ·
        {result.contributors.length > 0 && (
          <button onClick={onDrill} style={{
            marginLeft: 4, color: '#e91e8c', background: 'transparent',
            border: 'none', cursor: 'pointer', fontSize: '0.7rem', padding: 0, fontWeight: 700,
          }}>
            drill down →
          </button>
        )}
      </div>
    </div>
  )
}

function KpiEditor({ headers, numericHeaders, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    label: '', metric: numericHeaders[0] || '', agg: 'sum',
    groupBy: '', filterCol: '', filterVal: '', target: '',
  })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const save = () => {
    if (!form.metric) return
    onSave({
      ...form,
      target: form.target === '' || form.target === null ? null : Number(form.target),
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(12,20,70,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '92vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0c1446', marginBottom: 16 }}>
          {initial ? 'Edit KPI' : 'Add KPI'}
        </div>

        <Field label='Label (optional)'>
          <input value={form.label} onChange={e => set('label', e.target.value)}
            placeholder='e.g. Monthly Revenue' style={inputStyle} />
        </Field>

        <Field label='Metric column *'>
          <select value={form.metric} onChange={e => set('metric', e.target.value)} style={inputStyle}>
            <option value=''>-- select numeric column --</option>
            {numericHeaders.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>

        <Field label='Aggregation'>
          <select value={form.agg} onChange={e => set('agg', e.target.value)} style={inputStyle}>
            {Object.keys(AGG_FUNCS).map(k => <option key={k} value={k}>{AGG_LABELS[k]}</option>)}
          </select>
        </Field>

        <Field label='Group by (for drill-down)'>
          <select value={form.groupBy} onChange={e => set('groupBy', e.target.value)} style={inputStyle}>
            <option value=''>-- none --</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>

        <Field label='Filter by column = value (optional)'>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={form.filterCol} onChange={e => set('filterCol', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}>
              <option value=''>-- no filter --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <input value={form.filterVal} onChange={e => set('filterVal', e.target.value)}
              placeholder='value' style={{ ...inputStyle, flex: 1 }} />
          </div>
        </Field>

        <Field label='Target (optional)'>
          <input type='number' value={form.target} onChange={e => set('target', e.target.value)}
            placeholder='e.g. 100000' style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={!form.metric} style={btnPrimary}>
            {initial ? 'Save' : 'Add KPI'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DrillModal({ result, onClose }) {
  if (!result) return null
  const { kpi, contributors } = result
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(12,20,70,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 600, maxWidth: '94vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0c1446' }}>
              {kpi.label || kpi.metric} — top contributors
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Grouped by <strong>{kpi.groupBy}</strong> — top 10 by {AGG_LABELS[kpi.agg].toLowerCase()}.
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(200, contributors.length * 30)}>
          <BarChart data={contributors} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmt} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="value" fill="#e91e8c" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }
const btnPrimary = { padding: '9px 20px', background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '9px 18px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function KPIDashboard() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [dateCol, setDateCol] = useState('')
  const [filename, setFilename] = useState('')
  const [kpis, setKpis] = useState([])
  const [editing, setEditing] = useState(null)    // index or 'new' or null
  const [drillIdx, setDrillIdx] = useState(null)
  const [loading, setLoading] = useState(false)
  // Gates the save-on-change effect. We flip it true only AFTER a file's saved
  // config has been restored, so the initial reset-to-empty doesn't clobber
  // the localStorage entry we're about to restore from.
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  function loadFile(id) {
    // Pause persistence during the reset → preview → restore sequence.
    setConfigLoaded(false)
    setFileId(id); setRows([]); setHeaders([]); setKpis([]); setFilename('')
    setDateCol('')
    if (!id) return
    setLoading(true)
    analyticsApi.preview(id).then(r => {
      const d = r.data
      setHeaders(d.headers || [])
      setRows(d.rows || [])
      setFilename(d.filename || '')
      // Restore saved config first (takes precedence over auto-guess).
      const saved = loadKpisFor(id)
      if (saved?.kpis) setKpis(saved.kpis)
      if (saved?.dateCol) {
        setDateCol(saved.dateCol)
      } else {
        const dateGuess = (d.headers || []).find(h => /date|time|month|period/i.test(h))
        if (dateGuess) setDateCol(dateGuess)
      }
    }).catch(() => {}).finally(() => {
      setLoading(false)
      setConfigLoaded(true)
    })
  }

  // Save whenever config changes — only after the initial load has settled.
  useEffect(() => {
    if (fileId && configLoaded) {
      saveKpisFor(fileId, { kpis, dateCol })
    }
  }, [fileId, kpis, dateCol, configLoaded])

  const numericHeaders = useMemo(() => {
    if (!rows.length) return []
    return headers.filter(h => {
      const sample = rows.slice(0, 50).map(r => r[h])
      const nums = sample.filter(v => v !== null && v !== '' && !Number.isNaN(Number(v)))
      return nums.length >= sample.length * 0.6
    })
  }, [headers, rows])

  const results = useMemo(() => {
    if (!rows.length) return []
    return kpis.map(k => computeKpi(rows, k, dateCol))
  }, [rows, kpis, dateCol])

  function addKpi(data) { setKpis([...kpis, data]); setEditing(null) }
  function updateKpi(idx, data) {
    setKpis(kpis.map((k, i) => i === idx ? data : k))
    setEditing(null)
  }
  function removeKpi(idx) { setKpis(kpis.filter((_, i) => i !== idx)) }

  // Suggested KPIs if the user has no config yet
  function suggestDefaults() {
    const defaults = numericHeaders.slice(0, 4).map(col => ({
      label: col, metric: col, agg: 'sum', groupBy: '', filterCol: '', filterVal: '', target: null,
    }))
    setKpis(defaults)
  }

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>KPI Dashboard</h1>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)', padding: '3px 8px',
          borderRadius: 6, letterSpacing: 0.5,
        }}>v2 · MoM/YoY · TARGETS</span>
      </div>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: '0.9rem' }}>
        Configurable KPIs with trend sparklines, period-over-period comparison, targets, and drill-down.
      </p>

      {/* Config bar */}
      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Dataset
            </label>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={inputStyle}>
              <option value=''>-- Choose a file --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Date column (for trends)
            </label>
            <select value={dateCol} onChange={e => setDateCol(e.target.value)} style={inputStyle} disabled={!headers.length}>
              <option value=''>-- none --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <button onClick={() => setEditing('new')} disabled={!numericHeaders.length}
            style={{ ...btnPrimary, opacity: numericHeaders.length ? 1 : 0.5 }}>
            + Add KPI
          </button>
          {!kpis.length && numericHeaders.length > 0 && (
            <button onClick={suggestDefaults} style={btnSecondary}>Suggest defaults</button>
          )}
        </div>
        {filename && (
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 10 }}>
            {filename} · {rows.length.toLocaleString()} rows · {headers.length} columns
            {dateCol && <span style={{ color: '#0097b2' }}> · date: {dateCol}</span>}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* KPI grid */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <ExportMenu
              data={results.map(r => ({
                kpi: r.kpi.label || r.kpi.metric,
                metric: r.kpi.metric,
                agg: r.kpi.agg,
                value: r.currentValue,
                mom_pct: r.mom,
                yoy_pct: r.yoy,
                target: r.kpi.target ?? '',
                target_progress_pct: r.targetProgress ?? '',
                rows_in_scope: r.rowCount,
              }))}
              filename={`kpi-dashboard-${filename || 'export'}`}
              title={`KPI Dashboard — ${filename || ''}`}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {results.map((r, i) => (
              <KpiCard
                key={i}
                result={r}
                fileId={fileId}
                onEdit={() => setEditing(i)}
                onDelete={() => removeKpi(i)}
                onDrill={() => setDrillIdx(i)}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty states */}
      {!loading && fileId && !kpis.length && (
        <EmptyState
          icon="◎"
          title="No KPIs configured yet"
          body="Pick a metric + aggregation, or let us suggest defaults from your numeric columns."
          action={numericHeaders.length ? { label: 'Suggest defaults', onClick: suggestDefaults } : null}
          tone="info"
        />
      )}
      {!fileId && !loading && (
        <EmptyState
          icon="◎"
          title="Select a file"
          body="Choose a dataset to start building your KPI dashboard."
        />
      )}

      {editing !== null && (
        <KpiEditor
          headers={headers}
          numericHeaders={numericHeaders}
          initial={editing === 'new' ? null : kpis[editing]}
          onCancel={() => setEditing(null)}
          onSave={(data) => editing === 'new' ? addKpi(data) : updateKpi(editing, data)}
        />
      )}

      {drillIdx !== null && (
        <DrillModal result={results[drillIdx]} onClose={() => setDrillIdx(null)} />
      )}
    </div>
  )
}
