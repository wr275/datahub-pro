import React, { useState, useEffect, useMemo, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonChart } from '../components/ui/Skeleton'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

// Period Comparison 2.0
// - Granularity: Day / Week / Month / Quarter / Year
// - Comparison: Sequential (prev period) / Year-over-Year
// - Date range filter + optional dimension breakdown
// - Variance decomposition (top contributors to the delta between the last two periods)
// - Low-confidence flag when per-period sample <30
// - CSV export

function parseDate(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  // Native parser handles YYYY-MM-DD, ISO, RFC, and many MM/DD/YYYY strings
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  // dd/mm/yyyy fallback (common UK format that JS parses as US)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    const day = +m[1], mon = +m[2] - 1, yr = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    const d2 = new Date(yr, mon, day)
    if (!isNaN(d2.getTime())) return d2
  }
  return null
}

function bucketKey(date, gran) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (gran === 'day') return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (gran === 'week') {
    const tmp = new Date(Date.UTC(y, m - 1, d))
    const dayNum = tmp.getUTCDay() || 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7)
    return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }
  if (gran === 'month') return `${y}-${String(m).padStart(2, '0')}`
  if (gran === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`
  if (gran === 'year') return `${y}`
  return String(date)
}

// Given a period key, what's its "same period last year" key?
function yoyKeyFor(key, gran) {
  if (gran === 'day') {
    const [y, m, d] = key.split('-').map(Number)
    return `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (gran === 'week') {
    const [y, w] = key.split('-W')
    return `${Number(y) - 1}-W${w}`
  }
  if (gran === 'month') {
    const [y, m] = key.split('-').map(Number)
    return `${y - 1}-${String(m).padStart(2, '0')}`
  }
  if (gran === 'quarter') {
    const [y, q] = key.split('-Q')
    return `${Number(y) - 1}-Q${q}`
  }
  if (gran === 'year') return String(Number(key) - 1)
  return null
}

function toCSV(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = v => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function PeriodComparison() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])

  const [dateCol, setDateCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [dimCol, setDimCol] = useState('')
  const [granularity, setGranularity] = useState('month')
  const [comparison, setComparison] = useState('sequential') // or 'yoy'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
    }).catch(() => {})
  }

  // Available numeric columns + date-detection for default selection
  const numericCols = useMemo(() => {
    if (!rows.length) return []
    return headers.filter(h => {
      const sample = rows.slice(0, 20).map(r => parseFloat(r[h]))
      return sample.filter(v => !isNaN(v)).length >= Math.min(10, rows.length / 2)
    })
  }, [headers, rows])

  const run = () => {
    if (!dateCol || !valCol || !rows.length) return

    const sDate = startDate ? parseDate(startDate) : null
    const eDate = endDate ? parseDate(endDate) : null

    // Bucket rows by period (and optionally by dimension)
    const byPeriod = {}       // period → {sum, count, byDim: {dimVal: {sum,count}}}
    let inRange = 0

    rows.forEach(r => {
      const d = parseDate(r[dateCol])
      if (!d) return
      if (sDate && d < sDate) return
      if (eDate && d > eDate) return
      inRange++

      const key = bucketKey(d, granularity)
      const v = parseFloat(r[valCol])
      if (isNaN(v)) return

      if (!byPeriod[key]) byPeriod[key] = { sum: 0, count: 0, byDim: {} }
      byPeriod[key].sum += v
      byPeriod[key].count++

      if (dimCol) {
        const dv = r[dimCol] ?? '(blank)'
        if (!byPeriod[key].byDim[dv]) byPeriod[key].byDim[dv] = { sum: 0, count: 0 }
        byPeriod[key].byDim[dv].sum += v
        byPeriod[key].byDim[dv].count++
      }
    })

    const periods = Object.keys(byPeriod).sort()
    if (!periods.length) {
      setResult({ empty: true, inRange })
      return
    }

    // Build per-period rows with sequential + YoY growth
    const data = periods.map((p, i) => {
      const cur = byPeriod[p]
      const prev = i > 0 ? byPeriod[periods[i - 1]] : null
      const yoyKey = yoyKeyFor(p, granularity)
      const yoyPrior = yoyKey ? byPeriod[yoyKey] : null

      const seqPct = prev && prev.sum !== 0
        ? ((cur.sum - prev.sum) / Math.abs(prev.sum)) * 100 : null
      const yoyPct = yoyPrior && yoyPrior.sum !== 0
        ? ((cur.sum - yoyPrior.sum) / Math.abs(yoyPrior.sum)) * 100 : null

      return {
        period: p,
        total: +cur.sum.toFixed(2),
        avg: +(cur.sum / cur.count).toFixed(2),
        count: cur.count,
        seqPct: seqPct == null ? null : +seqPct.toFixed(1),
        yoyPct: yoyPct == null ? null : +yoyPct.toFixed(1),
        lowN: cur.count < 30,
      }
    })

    // Dimension variance decomposition between last two periods
    let variance = null
    if (dimCol && periods.length >= 2) {
      const a = byPeriod[periods[periods.length - 2]]
      const b = byPeriod[periods[periods.length - 1]]
      const dimsInA = a?.byDim || {}
      const dimsInB = b?.byDim || {}
      const allDims = new Set([...Object.keys(dimsInA), ...Object.keys(dimsInB)])
      const deltas = [...allDims].map(dv => {
        const aSum = dimsInA[dv]?.sum || 0
        const bSum = dimsInB[dv]?.sum || 0
        return { dim: dv, prev: +aSum.toFixed(2), curr: +bSum.toFixed(2), delta: +(bSum - aSum).toFixed(2) }
      }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 7)
      variance = {
        prevLabel: periods[periods.length - 2],
        currLabel: periods[periods.length - 1],
        totalDelta: +(b.sum - a.sum).toFixed(2),
        topContributors: deltas,
      }
    }

    const sorted = [...data].sort((x, y) => y.total - x.total)
    setResult({
      data,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      variance,
      inRange,
      periods: periods.length,
    })
  }

  const numericColSet = new Set(numericCols)
  const categoricalCols = headers.filter(h => !numericColSet.has(h) && h !== dateCol)
  const growthKey = comparison === 'yoy' ? 'yoyPct' : 'seqPct'
  const growthLabel = comparison === 'yoy' ? 'YoY %' : 'Period-over-period %'

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Period Comparison</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Compare performance across time periods with day / week / month / quarter / year granularity, YoY analysis, and dimension breakdown</p>

      {/* Config */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <Field label="File">
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={selStyle}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </Field>
          <Field label="Date Column">
            <select value={dateCol} onChange={e => setDateCol(e.target.value)} style={selStyle}>
              <option value="">-- Column --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Value (numeric)">
            <select value={valCol} onChange={e => setValCol(e.target.value)} style={selStyle}>
              <option value="">-- Numeric --</option>
              {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Dimension (optional)">
            <select value={dimCol} onChange={e => setDimCol(e.target.value)} style={selStyle}>
              <option value="">-- None --</option>
              {categoricalCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Granularity">
            <select value={granularity} onChange={e => setGranularity(e.target.value)} style={selStyle}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </Field>
          <Field label="Comparison">
            <select value={comparison} onChange={e => setComparison(e.target.value)} style={selStyle}>
              <option value="sequential">Previous period</option>
              <option value="yoy">Year over year</option>
            </select>
          </Field>
          <Field label="Start date (optional)">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={selStyle} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={selStyle} />
          </Field>
        </div>
        <button onClick={run} disabled={!dateCol || !valCol}
          style={{ padding: '10px 28px', background: dateCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: dateCol && valCol ? 'pointer' : 'default' }}>
          Compare Periods
        </button>
        {result && !result.empty && (
          <span style={{ marginLeft: 10, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <ExportMenu
              data={result.data}
              filename={`period-comparison-${granularity}`}
              title={`Period Comparison — ${valCol} by ${granularity}`}
            />
            <OpenInAskYourData
              fileId={fileId}
              prompt={`Why did ${valCol} change between periods? The recent ${granularity}-over-${granularity} delta is largest at ${result.best?.period} (best) and ${result.worst?.period} (worst). What's driving it?`}
            />
            <PinToDashboard
              widget={{
                type: 'line',
                col: valCol,
                label: `${valCol} by ${granularity}`,
                file_id: fileId,
                extra: { granularity, comparison, dimCol, startDate, endDate },
              }}
            />
          </span>
        )}
      </div>

      {result?.empty && (
        <EmptyState
          icon="📅"
          title="No data in the selected date range"
          body="Widen the range, or double-check that your date column parses correctly."
          tone="warn"
          compact
        />
      )}

      {result && !result.empty && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <SummaryCard label="Periods analysed" value={result.periods} color="#0097b2" />
            <SummaryCard label="Rows in range" value={result.inRange?.toLocaleString()} color="#6366f1" />
            <SummaryCard label="Best period" value={result.best?.period} sub={result.best?.total?.toLocaleString()} color="#10b981" />
            <SummaryCard label="Worst period" value={result.worst?.period} sub={result.worst?.total?.toLocaleString()} color="#ef4444" />
          </div>

          {/* Trend line + growth bar side by side on wide screens */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Totals over time</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={result.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#0097b2" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>{growthLabel}</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={result.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => v == null ? '—' : `${v}%`} />
                  <Bar dataKey={growthKey} name={growthLabel} radius={[4, 4, 0, 0]}
                    // Colour per-bar via cell would be cleaner — keep it simple with a single fill here.
                    fill="#e91e8c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Variance decomposition */}
          {result.variance && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 6 }}>
                What changed: {result.variance.prevLabel} → {result.variance.currLabel}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: 16 }}>
                Total delta <strong style={{ color: result.variance.totalDelta >= 0 ? '#10b981' : '#ef4444' }}>
                  {result.variance.totalDelta >= 0 ? '+' : ''}{result.variance.totalDelta.toLocaleString()}
                </strong> — top contributors by {dimCol}:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {result.variance.topContributors.map(c => (
                  <div key={c.dim} style={{ border: '1px solid #f3f4f6', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>{c.dim}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {c.prev.toLocaleString()} → {c.curr.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: c.delta >= 0 ? '#10b981' : '#ef4444' }}>
                      {c.delta >= 0 ? '+' : ''}{c.delta.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-period table */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Period-by-period data</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Period', 'Total', 'Average', 'Count', 'Prev %', 'YoY %', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row, i) => (
                    <tr key={row.period} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0c1446' }}>{row.period}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{row.total?.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{row.avg?.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{row.count?.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: row.seqPct == null ? '#9ca3af' : row.seqPct >= 0 ? '#10b981' : '#ef4444' }}>
                        {row.seqPct == null ? '—' : `${row.seqPct >= 0 ? '+' : ''}${row.seqPct}%`}
                      </td>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: row.yoyPct == null ? '#9ca3af' : row.yoyPct >= 0 ? '#10b981' : '#ef4444' }}>
                        {row.yoyPct == null ? '—' : `${row.yoyPct >= 0 ? '+' : ''}${row.yoyPct}%`}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {row.lowN && (
                          <span title="Fewer than 30 observations in this period — comparison may be noisy"
                            style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                            low n
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📅</div>
          <div>Pick a file, a date column, and a numeric value to compare periods.</div>
          <div style={{ marginTop: 8, fontSize: '0.85rem' }}>Optional: add a dimension for variance decomposition, or narrow the date range.</div>
        </div>
      )}
    </div>
  )
}

// ——— helpers ———

const selStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: '#0c1446', fontSize: '1.2rem' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: '0.85rem', color, fontWeight: 700, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
