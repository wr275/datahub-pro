import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'

export default function VarianceAnalysis() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [groupCol, setGroupCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [result, setResult] = useState(null)
  const [dateRange, setDateRange] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null); setDateRange(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!groupCol || !valCol || !rows.length) return
    const scoped = applyDateFilter(rows, dateRange)
    if (!scoped.length) { setResult(null); return }
    const groups = {}
    scoped.forEach(r => {
      const k = r[groupCol] || '(blank)'; const v = parseFloat(r[valCol]) || 0
      if (!groups[k]) groups[k] = []
      groups[k].push(v)
    })
    const allVals = scoped.map(r => parseFloat(r[valCol]) || 0)
    const grandMean = allVals.reduce((a, b) => a + b, 0) / allVals.length
    const analysis = Object.entries(groups).map(([group, vals]) => {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length
      const variance_from_mean = mean - grandMean
      return { group, count: vals.length, mean: parseFloat(mean.toFixed(2)), variance: parseFloat(variance.toFixed(2)), stdDev: parseFloat(Math.sqrt(variance).toFixed(2)), variance_from_mean: parseFloat(variance_from_mean.toFixed(2)) }
    }).sort((a, b) => Math.abs(b.variance_from_mean) - Math.abs(a.variance_from_mean))
    setResult({ analysis, grandMean: grandMean.toFixed(2), totalGroups: analysis.length })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Variance Analysis</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Compare group means against the grand mean to identify significant variance</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Group By', <select value={groupCol} onChange={e => setGroupCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Value', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>

        {headers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="variance-analysis.dateRange"
            />
          </div>
        )}

        <button onClick={run} disabled={!groupCol || !valCol} style={{ padding: '9px 24px', background: groupCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: groupCol && valCol ? 'pointer' : 'default' }}>Analyse Variance</button>
      </div>

      {result && (
        <div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20, display: 'flex', gap: 32 }}>
            <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Grand Mean: </span><span style={{ fontWeight: 800, color: '#0c1446' }}>{result.grandMean}</span></div>
            <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Groups: </span><span style={{ fontWeight: 800, color: '#0c1446' }}>{result.totalGroups}</span></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Variance from Grand Mean</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={result.analysis.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="group" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="variance_from_mean" radius={[4, 4, 0, 0]} name="Variance">
                    {result.analysis.slice(0, 12).map((entry, i) => <Cell key={i} fill={entry.variance_from_mean >= 0 ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Group Statistics</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>{['Group', 'Count', 'Mean', 'Std Dev', 'vs Grand'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {result.analysis.map((row, i) => (
                    <tr key={row.group} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0c1446' }}>{row.group}</td>
                      <td style={{ padding: '7px 10px', color: '#374151' }}>{row.count}</td>
                      <td style={{ padding: '7px 10px', color: '#374151' }}>{row.mean}</td>
                      <td style={{ padding: '7px 10px', color: '#374151' }}>{row.stdDev}</td>
                      <td style={{ padding: '7px 10px', color: row.variance_from_mean >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{row.variance_from_mean >= 0 ? '+' : ''}{row.variance_from_mean}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div><div>Select group and value columns to run variance analysis</div></div>}
    </div>
  )
}
