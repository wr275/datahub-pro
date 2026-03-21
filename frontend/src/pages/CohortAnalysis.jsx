import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function CohortAnalysis() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [cohortCol, setCohortCol] = useState('')
  const [periodCol, setPeriodCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!cohortCol || !periodCol || !valCol || !rows.length) return
    const cohorts = {}
    rows.forEach(r => {
      const cohort = r[cohortCol] || '(blank)'
      const period = r[periodCol] || '(blank)'
      const val = parseFloat(r[valCol]) || 0
      if (!cohorts[cohort]) cohorts[cohort] = {}
      if (!cohorts[cohort][period]) cohorts[cohort][period] = { sum: 0, count: 0 }
      cohorts[cohort][period].sum += val
      cohorts[cohort][period].count++
    })
    const cohortKeys = Object.keys(cohorts).sort().slice(0, 15)
    const periodKeys = [...new Set(rows.map(r => r[periodCol] || '(blank)'))].sort().slice(0, 12)
    const matrix = cohortKeys.map(c => {
      const row = { cohort: c }
      periodKeys.forEach(p => {
        row[p] = cohorts[c][p] ? parseFloat((cohorts[c][p].sum / cohorts[c][p].count).toFixed(2)) : null
      })
      return row
    })
    const maxVal = Math.max(...matrix.flatMap(r => periodKeys.map(p => r[p] || 0)))
    setResult({ matrix, cohortKeys, periodKeys, maxVal })
  }

  function cellColor(val, maxVal) {
    if (val == null) return '#f9fafb'
    const intensity = maxVal > 0 ? val / maxVal : 0
    const r = Math.round(255 - intensity * (255 - 14))
    const g = Math.round(255 - intensity * (255 - 165))
    const b = Math.round(255 - intensity * (255 - 233))
    return `rgb(${r},${g},${b})`
  }

  function textColor(val, maxVal) {
    if (val == null) return '#9ca3af'
    return (maxVal > 0 ? val / maxVal : 0) > 0.6 ? '#fff' : '#0c1446'
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Cohort Analysis</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Analyze behavior patterns across cohort groups and time periods</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Cohort Column', <select value={cohortCol} onChange={e => setCohortCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Period Column', <select value={periodCol} onChange={e => setPeriodCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Value Column', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={run} disabled={!cohortCol || !periodCol || !valCol} style={{ padding: '9px 24px', background: cohortCol && periodCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: cohortCol && periodCol && valCol ? 'pointer' : 'default' }}>Build Cohort Matrix</button>
      </div>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Cohort Heatmap — Average {valCol} per {cohortCol} × {periodCol}</div>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 120 }}>{cohortCol}</th>
                {result.periodKeys.map(p => <th key={p} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 80 }}>{p.length > 10 ? p.slice(0, 10) + '…' : p}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.matrix.map(row => (
                <tr key={row.cohort}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0c1446', borderBottom: '1px solid #f3f4f6' }}>{row.cohort}</td>
                  {result.periodKeys.map(p => (
                    <td key={p} style={{ padding: 3, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ width: 76, height: 36, background: cellColor(row[p], result.maxVal), borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor(row[p], result.maxVal), fontWeight: 600, fontSize: '0.78rem' }}>
                        {row[p] != null ? row[p].toLocaleString() : '—'}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#6b7280' }}>Showing up to 15 cohorts × 12 periods. Values are averages. Darker = higher value.</div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>👥</div><div>Select cohort, period, and value columns to build the matrix</div></div>}
    </div>
  )
}
