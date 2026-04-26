import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend,
} from 'recharts'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard, SkeletonChart } from '../components/ui/Skeleton'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

/* ─── Churn Risk Scoring Algorithm ─────────────────────────── */
function computeChurnRisk(rows, customerCol, dateCol, revenueCol) {
  const customers = {}
  const now = new Date()

  rows.forEach(row => {
    const id = String(row[customerCol] || '').trim()
    const d = new Date(row[dateCol])
    const val = parseFloat(row[revenueCol]) || 0
    if (!id) return
    if (!customers[id]) customers[id] = { id, dates: [], total: 0, orders: 0 }
    if (!isNaN(d.getTime())) customers[id].dates.push(d)
    customers[id].total += val
    customers[id].orders += 1
  })

  const records = Object.values(customers).filter(c => c.dates.length > 0)

  records.forEach(c => {
    const latest = new Date(Math.max(...c.dates.map(d => d.getTime())))
    const earliest = new Date(Math.min(...c.dates.map(d => d.getTime())))
    c.recencyDays = Math.floor((now - latest) / (1000 * 60 * 60 * 24))
    c.frequency = c.orders
    c.monetary = c.total
    c.avgOrderValue = c.total / c.orders
    const spanDays = Math.max((latest - earliest) / (1000 * 60 * 60 * 24), 1)
    c.orderRate = c.orders / (spanDays / 30) // orders per month
  })

  // Normalise to quintiles
  const recencies = records.map(r => r.recencyDays)
  const freqs = records.map(r => r.frequency)
  const moneys = records.map(r => r.monetary)

  const pct = (arr, v) => {
    const sorted = arr.slice().sort((a, b) => a - b)
    return sorted.indexOf(v) / (sorted.length - 1 || 1)
  }

  records.forEach(c => {
    // Higher recency = more at risk (inverted)
    const riskRecency = pct(recencies, c.recencyDays)          // 0=fresh, 1=stale
    const riskFreq    = 1 - pct(freqs, c.frequency)            // 0=frequent, 1=rare
    const riskMoney   = 1 - pct(moneys, c.monetary)            // 0=high-value, 1=low-value

    // Weighted churn score (0–100)
    c.churnScore = Math.round((riskRecency * 0.5 + riskFreq * 0.3 + riskMoney * 0.2) * 100)

    if      (c.churnScore >= 75) c.segment = 'Critical'
    else if (c.churnScore >= 50) c.segment = 'At Risk'
    else if (c.churnScore >= 25) c.segment = 'Needs Attention'
    else                         c.segment = 'Healthy'
  })

  return records.sort((a, b) => b.churnScore - a.churnScore)
}

const SEG_CONFIG = {
  'Critical':         { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    action: 'Call immediately' },
  'At Risk':          { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  action: 'Send win-back offer' },
  'Needs Attention':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', action: 'Schedule check-in' },
  'Healthy':          { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  action: 'Cross-sell opportunity' },
}

const fmt = (n, prefix = '') => `${prefix}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

/* ─── Component ─────────────────────────────────────────────── */
export default function ChurnRiskAnalysis() {
  const [files, setFiles]           = useState([])
  const [fileId, setFileId]         = useState('')
  const [headers, setHeaders]       = useState([])
  const [customerCol, setCustomerCol] = useState('')
  const [dateCol, setDateCol]       = useState('')
  const [revenueCol, setRevenueCol] = useState('')
  const [results, setResults]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [prevLoading, setPrevLoading] = useState(false)
  const [search, setSearch]         = useState('')
  const [filterSeg, setFilterSeg]   = useState('All')
  const [dateRange, setDateRange]   = useState(null)
  const chartsRef = useRef(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  function onFileChange(id) {
    setFileId(id); setHeaders([]); setResults(null); setError('')
    setCustomerCol(''); setDateCol(''); setRevenueCol(''); setDateRange(null)
    if (!id) return
    setPrevLoading(true)
    analyticsApi.preview(id)
      .then(r => setHeaders(r.data.headers || []))
      .catch(() => setError('Could not load file columns.'))
      .finally(() => setPrevLoading(false))
  }

  function run() {
    if (!fileId || !customerCol || !dateCol || !revenueCol) return
    setLoading(true); setError(''); setResults(null)
    analyticsApi.preview(fileId)
      .then(r => {
        const rows = r.data.rows || []
        if (!rows.length) { setError('No data rows found.'); return }
        // Apply the global date-range filter so the analysis only considers
        // transactions inside the chosen window. The picker's date_column may
        // differ from the customer-level dateCol used by the scoring algorithm.
        const scoped = applyDateFilter(rows, dateRange)
        if (!scoped.length) { setError('No data rows in the selected date range.'); return }
        const churn = computeChurnRisk(scoped, customerCol, dateCol, revenueCol)
        setResults(churn)
      })
      .catch(() => setError('Failed to run analysis. Please try again.'))
      .finally(() => setLoading(false))
  }

  // ─── Derived stats ───────────────────────────────────────────
  const stats = results ? (() => {
    const bySegment = {}
    results.forEach(r => {
      if (!bySegment[r.segment]) bySegment[r.segment] = { count: 0, revenue: 0 }
      bySegment[r.segment].count   += 1
      bySegment[r.segment].revenue += r.monetary
    })
    const atRiskARR = results.filter(r => r.segment === 'Critical' || r.segment === 'At Risk').reduce((s, r) => s + r.monetary, 0)
    const avgScore  = Math.round(results.reduce((s, r) => s + r.churnScore, 0) / results.length)
    return { bySegment, atRiskARR, avgScore, total: results.length }
  })() : null

  const filtered = results ? results.filter(r => {
    const matchSeg = filterSeg === 'All' || r.segment === filterSeg
    const matchSearch = !search || r.id.toLowerCase().includes(search.toLowerCase())
    return matchSeg && matchSearch
  }) : []

  const chartData = stats ? Object.entries(stats.bySegment).map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue) })) : []

  const scatterData = results ? results.map(r => ({ x: r.recencyDays, y: r.frequency, z: r.churnScore, name: r.id, seg: r.segment })) : []

  // ─── UI helpers ──────────────────────────────────────────────
  const S = { padding: '28px 32px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
  const Card = ({ children, style }) => (
    <div className="card" style={{ borderRadius: 12, border: '1px solid var(--border, #e2e5f1)', background: 'var(--card, #fff)', padding: '20px 22px', ...style }}>
      {children}
    </div>
  )
  const sel = { padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border, #e2e5f1)', fontSize: '0.9rem', background: 'var(--card, #fff)', color: 'var(--t1, #0c1446)', cursor: 'pointer', width: '100%' }

  return (
    <div style={S}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--t1, #0c1446)', marginBottom: 4 }}>
            🔥 Churn Risk Analysis
          </h1>
          <p style={{ color: 'var(--t2, #4a5280)', fontSize: '0.88rem' }}>
            ML-scored churn probability per customer · prioritised action list
          </p>
        </div>
        {results && (
          <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
            ⚠️ {results.filter(r => r.segment === 'Critical').length} critical customers
          </span>
        )}
      </div>

      {/* Config */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--t2, #4a5280)', marginBottom: 6 }}>Data file</label>
            <select style={sel} value={fileId} onChange={e => onFileChange(e.target.value)}>
              <option value="">Select a file…</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--t2, #4a5280)', marginBottom: 6 }}>Customer column</label>
            <select style={sel} value={customerCol} onChange={e => setCustomerCol(e.target.value)} disabled={!headers.length}>
              <option value="">Select…</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--t2, #4a5280)', marginBottom: 6 }}>Date column</label>
            <select style={sel} value={dateCol} onChange={e => setDateCol(e.target.value)} disabled={!headers.length}>
              <option value="">Select…</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--t2, #4a5280)', marginBottom: 6 }}>Revenue column</label>
            <select style={sel} value={revenueCol} onChange={e => setRevenueCol(e.target.value)} disabled={!headers.length}>
              <option value="">Select…</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <button
            onClick={run}
            disabled={loading || !fileId || !customerCol || !dateCol || !revenueCol}
            className="btn-primary"
            style={{ padding: '10px 20px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
            {loading ? 'Analysing…' : '🔥 Run Analysis'}
          </button>
        </div>
        {headers.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="churn-risk.dateRange"
            />
          </div>
        )}
        {prevLoading && <p style={{ marginTop: 10, color: 'var(--t3, #8b92b3)', fontSize: '0.82rem' }}>Loading columns…</p>}
        {error && <p style={{ marginTop: 10, color: '#ef4444', fontSize: '0.82rem' }}>{error}</p>}
      </Card>

      {loading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonChart height={220} />
        </div>
      )}

      {/* Results */}
      {results && stats && (
        <div ref={chartsRef}>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <OpenInAskYourData
              fileId={fileId}
              prompt={`We have ${(stats.bySegment['Critical']?.count || 0) + (stats.bySegment['At Risk']?.count || 0)} customers in Critical or At Risk segments, with at-risk revenue of ${fmt(stats.atRiskARR, '£')}. Recommend a prioritised win-back plan and which segments to address first.`}
            />
            <PinToDashboard
              widget={{
                type: 'kpi',
                col: 'churn_score',
                label: `Churn risk — ${stats.total} customers`,
                file_id: fileId,
                extra: { atRiskARR: stats.atRiskARR, avgScore: stats.avgScore },
              }}
            />
            <ExportMenu
              data={results.map(r => ({
                customer: r.id, churn_score: r.churnScore, segment: r.segment,
                recency_days: r.recencyDays, frequency: r.frequency, revenue: r.monetary,
                avg_order: r.avgOrderValue,
              }))}
              filename="churn-risk"
              containerRef={chartsRef}
              title="Churn Risk Analysis"
            />
          </div>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Customers', val: stats.total, color: 'var(--navy, #0c1446)', prefix: '' },
              { label: 'Critical / At Risk', val: (stats.bySegment['Critical']?.count || 0) + (stats.bySegment['At Risk']?.count || 0), color: '#ef4444', prefix: '' },
              { label: 'At-Risk Revenue', val: fmt(stats.atRiskARR, '£'), color: '#f97316', prefix: '' },
              { label: 'Avg Churn Score', val: `${stats.avgScore}/100`, color: stats.avgScore > 60 ? '#ef4444' : stats.avgScore > 35 ? '#f59e0b' : '#10b981', prefix: '' },
            ].map((k, i) => (
              <Card key={i}>
                <div style={{ fontSize: '0.78rem', color: 'var(--t3, #8b92b3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: k.color }}>{k.val}</div>
              </Card>
            ))}
          </div>

          {/* Segment summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {Object.entries(SEG_CONFIG).map(([seg, cfg]) => {
              const d = stats.bySegment[seg] || { count: 0, revenue: 0 }
              return (
                <Card key={seg} style={{ border: `1px solid ${cfg.color}30`, background: cfg.bg, cursor: 'pointer', transition: 'transform 0.15s' }}
                  onClick={() => setFilterSeg(filterSeg === seg ? 'All' : seg)}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: cfg.color, marginBottom: 8 }}>
                    {seg === 'Critical' ? '🚨' : seg === 'At Risk' ? '⚠️' : seg === 'Needs Attention' ? '👁' : '✅'} {seg}
                    {filterSeg === seg && <span style={{ marginLeft: 6, fontSize: '0.7rem' }}>▼ filtered</span>}
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--t1, #0c1446)', marginBottom: 4 }}>{d.count}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--t2, #4a5280)' }}>Revenue: {fmt(d.revenue, '£')}</div>
                  <div style={{ fontSize: '0.75rem', color: cfg.color, marginTop: 6, fontWeight: 600 }}>{cfg.action}</div>
                </Card>
              )
            })}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <Card>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--t1, #0c1446)', marginBottom: 16 }}>Customers by Segment</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e5f1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--t3, #8b92b3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--t3, #8b92b3)' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.82rem' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={SEG_CONFIG[entry.name]?.color || '#0097b2'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--t1, #0c1446)', marginBottom: 4 }}>Recency vs Frequency</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--t3, #8b92b3)', marginBottom: 12 }}>Dot size = churn score · colour = segment</div>
              <ResponsiveContainer width="100%" height={186}>
                <ScatterChart margin={{ top: 0, right: 10, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e5f1)" />
                  <XAxis dataKey="x" name="Recency (days)" tick={{ fontSize: 10, fill: 'var(--t3, #8b92b3)' }} label={{ value: 'Days since last order', position: 'bottom', offset: 0, fontSize: 10, fill: 'var(--t3, #8b92b3)' }} />
                  <YAxis dataKey="y" name="Frequency" tick={{ fontSize: 10, fill: 'var(--t3, #8b92b3)' }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e5f1)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: 'var(--t1, #0c1446)' }}>
                          <div style={{ fontWeight: 700 }}>{d.name}</div>
                          <div>Recency: {d.x} days</div>
                          <div>Orders: {d.y}</div>
                          <div>Churn score: <strong style={{ color: SEG_CONFIG[d.seg]?.color }}>{d.z}</strong></div>
                        </div>
                      )
                    }}
                  />
                  <Scatter data={scatterData.slice(0, 60)} fill="#e91e8c">
                    {scatterData.slice(0, 60).map((entry, i) => (
                      <Cell key={i} fill={SEG_CONFIG[entry.seg]?.color || '#ccc'} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {/* Table toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border, #e2e5f1)' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--t1, #0c1446)', flex: 1 }}>
                Customer Risk Table <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--t3, #8b92b3)' }}>({filtered.length} shown)</span>
              </div>
              <input
                placeholder="Search customer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...sel, width: 180, padding: '7px 12px', fontSize: '0.82rem' }}
              />
              <select style={{ ...sel, width: 'auto', padding: '7px 12px', fontSize: '0.82rem' }} value={filterSeg} onChange={e => setFilterSeg(e.target.value)}>
                <option value="All">All segments</option>
                {Object.keys(SEG_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg, #f0f2f8)' }}>
                    {['Customer', 'Churn Score', 'Segment', 'Days Inactive', 'Orders', 'Total Revenue', 'Avg Order', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--t3, #8b92b3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border, #e2e5f1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((r, i) => {
                    const cfg = SEG_CONFIG[r.segment]
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border, #e2e5f1)', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg, #f0f2f8)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--t1, #0c1446)' }}>{r.id}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, background: 'var(--bg, #f0f2f8)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${r.churnScore}%`, height: '100%', background: cfg.color, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontWeight: 700, color: cfg.color, fontSize: '0.82rem' }}>{r.churnScore}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{r.segment}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: r.recencyDays > 90 ? '#ef4444' : r.recencyDays > 45 ? '#f59e0b' : 'var(--t2, #4a5280)' }}>{r.recencyDays}d</td>
                        <td style={{ padding: '10px 14px', color: 'var(--t1, #0c1446)' }}>{r.frequency}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--t1, #0c1446)' }}>{fmt(r.monetary, '£')}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--t2, #4a5280)' }}>{fmt(r.avgOrderValue, '£')}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: `${cfg.color}15`, color: cfg.color, borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{cfg.action}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--t3, #8b92b3)' }}>No customers match the current filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <EmptyState
          icon="🔥"
          title="Churn Risk Analysis"
          body="Pick a file with customer transaction data, then choose customer / date / revenue columns. DataHub will score each customer's churn probability based on recency, frequency, and revenue — then prioritise who to contact first."
        />
      )}
    </div>
  )
}
