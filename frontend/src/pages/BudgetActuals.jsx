import React, { useState, useEffect } from 'react'
import { budgetApi } from '../api'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

function KPICard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
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
  const [sortCol, setSortCol] = useState('category')
  const [sortDir, setSortDir] = useState('asc')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    budgetApi.listBudgets()
      .then(r => {
        setBudgets(r.data || [])
        if (r.data && r.data.length > 0) setSelected(r.data[0])
      })
      .catch(() => setBudgets([]))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setError('')
    budgetApi.getSummary(selected, period || undefined)
      .then(r => setSummary(r.data))
      .catch(() => setError('Failed to load summary'))
      .finally(() => setLoading(false))
  }, [selected, period])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortedEntries = () => {
    if (!summary || !summary.entries) return []
    let rows = [...summary.entries]
    if (filterType !== 'all') rows = rows.filter(r => r.line_type === filterType)
    rows.sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
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
      const headers = lines[0].split(',').map(h => h.trim())
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim())
        const obj = {}
        headers.forEach((h, i) => { obj[h] = vals[i] || '' })
        return obj
      })
      const res = await budgetApi.upload({ budget_name: uploadForm.budget_name, period: uploadForm.period, rows })
      setUploadMsg('Uploaded ' + res.data.created + ' rows successfully.')
      const r = await budgetApi.listBudgets()
      setBudgets(r.data || [])
      setSelected(uploadForm.budget_name)
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
  const entries = sortedEntries()

  const thStyle = (col) => ({
    padding: '10px 12px', textAlign: col === 'category' || col === 'department' || col === 'period' ? 'left' : 'right',
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    borderBottom: '2px solid #e5e7eb', background: '#f9fafb',
  })
  const tdStyle = (align) => ({
    padding: '10px 12px', fontSize: '0.85rem', color: '#111827',
    textAlign: align || 'right', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
  })

  return (
    <div style={{ padding: '32px 28px', background: '#f4f5fb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', margin: 0 }}>Budget vs Actuals</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Compare planned budgets against real spend by category and period</p>
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
                  placeholder="e.g. FY2026 Q1" required
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
                CSV Rows (header: category,department,budgeted,actual,line_type)
              </label>
              <textarea rows={6} value={uploadForm.rows}
                onChange={e => setUploadForm(f => ({ ...f, rows: e.target.value }))}
                placeholder={"category,department,budgeted,actual,line_type\nSalaries,Engineering,50000,48000,expense\nMarketing,Marketing,20000,22500,expense"}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.83rem', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="submit" disabled={uploading}
                style={{ padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', opacity: uploading ? 0.6 : 1 }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              {uploadMsg && <span style={{ fontSize: '0.85rem', color: uploadMsg.includes('failed') ? '#ef4444' : '#10b981' }}>{uploadMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
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
          <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="All periods"
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.87rem', background: '#fff', width: 140 }} />
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
      </div>

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KPICard label="Total Budgeted" value={fmt(totals.budgeted || 0)} />
          <KPICard label="Total Actual" value={fmt(totals.actual || 0)} />
          <KPICard label="Variance" value={fmt(totals.variance || 0)}
            sub={fmtPct(totals.variance_pct || 0) + ' vs budget'}
            color={(totals.variance || 0) > 0 ? '#ef4444' : '#10b981'} />
          <KPICard label="Line Items" value={summary.entries?.length || 0} sub="categories tracked" />
        </div>
      )}

      {/* Table */}
      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
      ) : !selected || !summary ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No budget data yet</div>
          <div style={{ fontSize: '0.87rem' }}>Upload a budget CSV to get started</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
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
                  <tr key={row.id} style={{ transition: 'background 0.15s' }}
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
                    <td style={tdStyle()}>{fmt(row.budgeted)}</td>
                    <td style={tdStyle()}>{fmt(row.actual)}</td>
                    <td style={{ ...tdStyle(), color: overBudget ? '#ef4444' : '#10b981', fontWeight: 600 }}>{fmt(row.variance)}</td>
                    <td style={{ ...tdStyle(), color: overBudget ? '#ef4444' : '#10b981', fontWeight: 600 }}>{fmtPct(row.variance_pct)}</td>
                  </tr>
                )
              })}
            </tbody>
            {entries.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f9fafb' }}>
                  <td colSpan={4} style={{ ...tdStyle('left'), fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>TOTAL</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>{fmt(totals.budgeted || 0)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>{fmt(totals.actual || 0)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, color: (totals.variance||0) > 0 ? '#ef4444' : '#10b981', borderTop: '2px solid #e5e7eb' }}>{fmt(totals.variance || 0)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 700, color: (totals.variance||0) > 0 ? '#ef4444' : '#10b981', borderTop: '2px solid #e5e7eb' }}>{fmtPct(totals.variance_pct || 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
