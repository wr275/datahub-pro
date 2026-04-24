import React, { useState, useEffect } from 'react'
import { budgetApi } from '../api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// -----------------------------------------------------------------------------
// Budget 2.0
// ---------------
// * Trend chart (budgeted vs actual by period)
// * Alerts panel (over-budget + no-budget-but-spending + stale/undershoot)
// * Drill-down modal — click any category row to see it across every period
// * "No budget" badge for rows with budgeted = 0
// * Department filter + better numeric parsing on upload
// -----------------------------------------------------------------------------

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = (n) => (n == null ? '—' : ((n >= 0 ? '+' : '') + n.toFixed(1) + '%'))

function KPICard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// Colour by alert severity.
const SEV_COLORS = {
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#dc2626' },
  warning:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#d97706' },
}

function AlertsPanel({ alerts, onDrilldown }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: '0.88rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>✅</span>
        <span><b>All categories within tolerance.</b> No alerts for this period — every line item is within ±10% of budget.</span>
      </div>
    )
  }
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>⚠ Alerts ({alerts.length})</div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Click any row to drill into that category</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a, i) => {
          const sev = SEV_COLORS[a.severity] || SEV_COLORS.warning
          const kindLabel = {
            over_budget: 'Over budget',
            no_budget:   'No budget',
            under_spent: 'Under spent',
            over_delivered: 'Over delivered',
          }[a.kind] || a.kind
          return (
            <div key={i}
              onClick={() => onDrilldown && onDrilldown(a.category)}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr auto auto',
                gap: 12,
                alignItems: 'center',
                padding: '10px 14px',
                background: sev.bg,
                border: `1px solid ${sev.border}`,
                borderRadius: 9,
                cursor: 'pointer',
                transition: 'transform 0.08s, box-shadow 0.08s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev.dot, display: 'inline-block' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: sev.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.severity}</span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>· {kindLabel}</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#111827' }}>
                <b>{a.category}</b>
                {a.department && <span style={{ color: '#6b7280' }}> · {a.department}</span>}
                <span style={{ color: '#6b7280' }}> · {a.period}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: sev.text, fontWeight: 600 }}>{a.message}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                {fmt(a.actual)} vs {fmt(a.budgeted)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendChart({ periods }) {
  if (!periods || periods.length < 2) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', color: '#9ca3af', fontSize: '0.87rem', textAlign: 'center' }}>
        📈 Upload budget data for at least 2 periods to see the trend chart
      </div>
    )
  }
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: 8 }}>📈 Budgeted vs Actual by Period</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={periods} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} tickFormatter={v => (v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`)} />
          <Tooltip formatter={v => fmt(v)} />
          <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
          <Line type="monotone" dataKey="budgeted" name="Budgeted" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="actual" name="Actual" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function DrilldownModal({ budgetName, category, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!budgetName || !category) return
    setLoading(true)
    budgetApi.getCategoryDetail(budgetName, category)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load detail'))
      .finally(() => setLoading(false))
  }, [budgetName, category])

  const t = data?.totals || {}

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>DRILL-DOWN</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>{category}</div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Across all periods of {budgetName}</div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', background: '#f3f4f6', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, color: '#6b7280' }}>✕ Close</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 14, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>
        ) : data ? (
          <>
            {/* Totals */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
              <KPICard label="Total Budgeted" value={fmt(t.budgeted)} />
              <KPICard label="Total Actual" value={fmt(t.actual)} />
              <KPICard label="Variance" value={fmt(t.variance)} sub={fmtPct(t.variance_pct)} color={(t.variance || 0) > 0 ? '#ef4444' : '#10b981'} />
            </div>

            {/* Trend — only if more than 1 period */}
            {data.trend && data.trend.length >= 2 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: 8 }}>Trend</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} tickFormatter={v => (v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`)} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Line type="monotone" dataKey="budgeted" name="Budgeted" stroke="#4f46e5" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke="#10b981" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Entries table */}
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: 6 }}>Entries ({data.entries.length})</div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: '0.74rem', textTransform: 'uppercase' }}>Period</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: '0.74rem', textTransform: 'uppercase' }}>Dept</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.74rem', textTransform: 'uppercase' }}>Budgeted</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.74rem', textTransform: 'uppercase' }}>Actual</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.74rem', textTransform: 'uppercase' }}>Variance</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.74rem', textTransform: 'uppercase' }}>Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map(r => {
                    const over = r.variance > 0
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px' }}>{r.period}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.department || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          {r.no_budget
                            ? <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>No budget</span>
                            : fmt(r.budgeted)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(r.actual)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: over ? '#ef4444' : '#10b981', fontWeight: 600 }}>{fmt(r.variance)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: over ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {r.no_budget ? '—' : fmtPct(r.variance_pct)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default function BudgetActuals() {
  const [budgets, setBudgets] = useState([])
  const [selected, setSelected] = useState('')
  const [period, setPeriod] = useState('')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ budget_name: '', period: '', rows: '' })
  const [uploadMsg, setUploadMsg] = useState('')
  const [error, setError] = useState('')
  const [sortCol, setSortCol] = useState('variance_pct')
  const [sortDir, setSortDir] = useState('desc')
  const [filterType, setFilterType] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [drilldown, setDrilldown] = useState(null)

  useEffect(() => {
    budgetApi.listBudgets()
      .then(r => {
        setBudgets(r.data || [])
        if (r.data && r.data.length > 0) setSelected(r.data[0])
      })
      .catch(() => setBudgets([]))
  }, [])

  useEffect(() => {
    if (!selected) { setSummary(null); return }
    setLoading(true)
    setError('')
    budgetApi.getSummary(selected, period || undefined)
      .then(r => setSummary(r.data))
      .catch(() => setError('Failed to load summary'))
      .finally(() => setLoading(false))
  }, [selected, period])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'variance_pct' || col === 'variance' ? 'desc' : 'asc') }
  }

  const filteredEntries = () => {
    if (!summary || !summary.entries) return []
    let rows = [...summary.entries]
    if (filterType !== 'all') rows = rows.filter(r => r.line_type === filterType)
    if (filterDept !== 'all') rows = rows.filter(r => (r.department || '') === filterDept)
    rows.sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return rows
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    setUploading(true)
    setUploadMsg('')
    try {
      const lines = uploadForm.rows.trim().split('\n').filter(Boolean)
      if (lines.length < 2) throw new Error('Need at least a header row and one data row')
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim())
        const obj = {}
        headers.forEach((h, i) => { obj[h] = vals[i] || '' })
        return obj
      })
      const res = await budgetApi.upload({ budget_name: uploadForm.budget_name, period: uploadForm.period, rows })
      const { created = 0, skipped = 0 } = res.data
      setUploadMsg(`Uploaded ${created} rows${skipped ? ` (${skipped} blanks skipped)` : ''}.`)
      const r = await budgetApi.listBudgets()
      setBudgets(r.data || [])
      setSelected(uploadForm.budget_name)
      setShowUpload(false)
    } catch (err) {
      setUploadMsg('Upload failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !window.confirm('Delete budget "' + selected + '"?')) return
    await budgetApi.deleteBudget(selected)
    const r = await budgetApi.listBudgets()
    setBudgets(r.data || [])
    setSelected(r.data?.[0] || '')
    setSummary(null)
  }

  const totals = summary?.totals || {}
  const entries = filteredEntries()

  const thStyle = (col) => {
    const leftAlign = ['category', 'department', 'period', 'line_type'].includes(col)
    return {
      padding: '10px 12px', textAlign: leftAlign ? 'left' : 'right',
      fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
      letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      borderBottom: '2px solid #e5e7eb', background: '#f9fafb',
    }
  }
  const tdStyle = (align) => ({
    padding: '10px 12px', fontSize: '0.85rem', color: '#111827',
    textAlign: align || 'right', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
  })

  const alertBadgeCount = totals.alert_count || 0
  const criticalCount = totals.critical_alert_count || 0

  return (
    <div style={{ padding: '32px 28px', background: '#f4f5fb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', margin: 0 }}>Budget vs Actuals</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Compare planned budgets against real spend — with trend, alerts, and drill-down</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowUpload(v => !v)}
            style={{ padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
            + Upload Budget
          </button>
          {selected && (
            <button onClick={handleDelete}
              style={{ padding: '9px 14px', background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Upload Budget Data (CSV format)</h3>
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Budget Name</label>
                <input value={uploadForm.budget_name} onChange={e => setUploadForm(f => ({ ...f, budget_name: e.target.value }))}
                  placeholder="e.g. FY2026" required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.87rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Period</label>
                <input value={uploadForm.period} onChange={e => setUploadForm(f => ({ ...f, period: e.target.value }))}
                  placeholder="e.g. 2026-Q1" required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.87rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                CSV Rows (header: category,department,budgeted,actual,line_type) — dollar signs, commas, and parentheses for negatives all welcome
              </label>
              <textarea rows={6} value={uploadForm.rows}
                onChange={e => setUploadForm(f => ({ ...f, rows: e.target.value }))}
                placeholder={"category,department,budgeted,actual,line_type\nSalaries,Engineering,$50,000,$48,000,expense\nMarketing,Marketing,$20,000,$22,500,expense"}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.83rem', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="submit" disabled={uploading}
                style={{ padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', opacity: uploading ? 0.6 : 1 }}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              {uploadMsg && <span style={{ fontSize: '0.85rem', color: uploadMsg.includes('failed') ? '#ef4444' : '#10b981' }}>{uploadMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginRight: 6 }}>Budget</label>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.87rem', background: '#fff', minWidth: 160 }}>
            {budgets.length === 0 && <option value="">No budgets yet</option>}
            {budgets.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginRight: 6 }}>Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.87rem', background: '#fff', minWidth: 140 }}>
            <option value="">All periods</option>
            {(summary?.available_periods || []).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginRight: 6 }}>Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.87rem', background: '#fff' }}>
            <option value="all">All</option>
            <option value="expense">Expense</option>
            <option value="revenue">Revenue</option>
          </select>
        </div>
        {summary?.departments?.length > 0 && (
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginRight: 6 }}>Dept</label>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.87rem', background: '#fff' }}>
              <option value="all">All depts</option>
              {summary.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <KPICard label="Total Budgeted" value={fmt(totals.budgeted)} />
          <KPICard label="Total Actual" value={fmt(totals.actual)} />
          <KPICard label="Variance" value={fmt(totals.variance)}
            sub={fmtPct(totals.variance_pct) + ' vs budget'}
            color={(totals.variance || 0) > 0 ? '#ef4444' : '#10b981'} />
          <KPICard label="Alerts"
            value={alertBadgeCount}
            sub={criticalCount > 0 ? `${criticalCount} critical` : 'all within tolerance'}
            color={criticalCount > 0 ? '#dc2626' : (alertBadgeCount > 0 ? '#d97706' : '#10b981')} />
        </div>
      )}

      {/* Trend chart */}
      {summary && <TrendChart periods={summary.periods} />}

      {/* Alerts */}
      {summary && <AlertsPanel alerts={summary.alerts} onDrilldown={(cat) => setDrilldown(cat)} />}

      {/* Table */}
      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</div>
      ) : !selected || !summary ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No budget data yet</div>
          <div style={{ fontSize: '0.87rem' }}>Upload a budget CSV to get started</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
            {entries.length} of {summary.entries?.length || 0} entries · click any row to drill into that category
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[['category','Category'],['department','Dept'],['period','Period'],['line_type','Type'],['budgeted','Budgeted'],['actual','Actual'],['variance','Variance'],['variance_pct','Var %']].map(([col, label]) => (
                  <th key={col} style={thStyle(col)} onClick={() => handleSort(col)}>
                    {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={8} style={{ ...tdStyle('center'), padding: 40, color: '#9ca3af' }}>No entries for this filter</td></tr>
              ) : entries.map(row => {
                const overBudget = row.variance > 0
                return (
                  <tr key={row.id}
                    onClick={() => setDrilldown(row.category)}
                    style={{ transition: 'background 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ ...tdStyle('left'), fontWeight: 600 }}>{row.category}</td>
                    <td style={tdStyle('left')}>{row.department || '—'}</td>
                    <td style={tdStyle('left')}>{row.period}</td>
                    <td style={tdStyle('left')}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600,
                        background: row.line_type === 'revenue' ? '#d1fae5' : '#fee2e2',
                        color: row.line_type === 'revenue' ? '#065f46' : '#991b1b' }}>
                        {row.line_type}
                      </span>
                    </td>
                    <td style={tdStyle()}>
                      {row.no_budget
                        ? <span title="Spending with no budget allocated" style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                            No budget
                          </span>
                        : fmt(row.budgeted)}
                    </td>
                    <td style={tdStyle()}>{fmt(row.actual)}</td>
                    <td style={{ ...tdStyle(), color: row.no_budget ? '#92400e' : (overBudget ? '#ef4444' : '#10b981'), fontWeight: 600 }}>{fmt(row.variance)}</td>
                    <td style={{ ...tdStyle(), color: row.no_budget ? '#92400e' : (overBudget ? '#ef4444' : '#10b981'), fontWeight: 600 }}>
                      {row.no_budget ? '—' : fmtPct(row.variance_pct)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {entries.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f9fafb' }}>
                  <td colSpan={4} style={{ ...tdStyle('left'), fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>TOTAL</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>{fmt(totals.budgeted)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>{fmt(totals.actual)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, color: (totals.variance||0) > 0 ? '#ef4444' : '#10b981', borderTop: '2px solid #e5e7eb' }}>{fmt(totals.variance)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, color: (totals.variance||0) > 0 ? '#ef4444' : '#10b981', borderTop: '2px solid #e5e7eb' }}>{fmtPct(totals.variance_pct)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {drilldown && (
        <DrilldownModal
          budgetName={selected}
          category={drilldown}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  )
}
