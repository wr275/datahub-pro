import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function BoxPlot() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [cols, setCols] = useState([])
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function toggleCol(h) {
    setCols(cols.includes(h) ? cols.filter(c => c !== h) : [...cols, h].slice(0, 6))
  }

  function build() {
    if (!cols.length || !rows.length) return
    const stats = cols.map(col => {
      const vals = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v)).sort((a, b) => a - b)
      if (!vals.length) return null
      const n = vals.length
      const q1 = vals[Math.floor(n * 0.25)]
      const median = n % 2 === 0 ? (vals[n / 2 - 1] + vals[n / 2]) / 2 : vals[Math.floor(n / 2)]
      const q3 = vals[Math.floor(n * 0.75)]
      const iqr = q3 - q1
      const whiskerLow = Math.max(vals[0], q1 - 1.5 * iqr)
      const whiskerHigh = Math.min(vals[n - 1], q3 + 1.5 * iqr)
      const outliers = vals.filter(v => v < whiskerLow || v > whiskerHigh)
      const mean = vals.reduce((a, b) => a + b, 0) / n
      return { col, min: vals[0], q1, median, mean: parseFloat(mean.toFixed(2)), q3, max: vals[n - 1], iqr, whiskerLow, whiskerHigh, outliers, count: n }
    }).filter(Boolean)
    const allVals = stats.flatMap(s => [s.min, s.max])
    const globalMin = Math.min(...allVals); const globalMax = Math.max(...allVals)
    setResult({ stats, globalMin, globalMax })
  }

  function scale(v, min, max, height) {
    return height - ((v - min) / (max - min)) * height
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))
  const H = 300; const W = 80; const PAD = 20

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Box Plot / Distribution</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Visualize the distribution, quartiles, and outliers of numeric columns</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
          <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ maxWidth: 300, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Select Columns (up to 6)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {numericCols.map(h => (
              <label key={h} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 10px', borderRadius: 6, background: cols.includes(h) ? '#e91e8c20' : '#f3f4f6', border: `1px solid ${cols.includes(h) ? '#e91e8c' : '#e5e7eb'}` }}>
                <input type="checkbox" checked={cols.includes(h)} onChange={() => toggleCol(h)} style={{ display: 'none' }} />
                <span style={{ fontSize: '0.85rem', color: cols.includes(h) ? '#e91e8c' : '#374151', fontWeight: cols.includes(h) ? 700 : 400 }}>{h}</span>
              </label>
            ))}
          </div>
        </div>
        <button onClick={build} disabled={!cols.length} style={{ padding: '9px 24px', background: cols.length ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: cols.length ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Distribution Analysis</div>
          <div style={{ overflowX: 'auto' }}>
            <svg width={result.stats.length * (W + PAD * 2) + 60} height={H + 60} style={{ display: 'block' }}>
              {/* Y axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => {
                const val = result.globalMin + t * (result.globalMax - result.globalMin)
                const y = PAD + scale(val, result.globalMin, result.globalMax, H - PAD * 2)
                return <g key={t}>
                  <line x1={50} x2={result.stats.length * (W + PAD * 2) + 55} y1={y} y2={y} stroke="#f3f4f6" strokeDasharray="3 3" />
                  <text x={44} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{val.toFixed(0)}</text>
                </g>
              })}
              {result.stats.map((s, i) => {
                const cx = 55 + i * (W + PAD * 2) + W / 2
                const scl = v => PAD + scale(v, result.globalMin, result.globalMax, H - PAD * 2)
                const yQ1 = scl(s.q1); const yQ3 = scl(s.q3); const yMed = scl(s.median); const yLow = scl(s.whiskerLow); const yHigh = scl(s.whiskerHigh)
                const colors = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']
                const color = colors[i % colors.length]
                return (
                  <g key={s.col}>
                    {/* whiskers */}
                    <line x1={cx} x2={cx} y1={yHigh} y2={yQ3} stroke={color} strokeWidth={1.5} />
                    <line x1={cx} x2={cx} y1={yQ1} y2={yLow} stroke={color} strokeWidth={1.5} />
                    <line x1={cx - 10} x2={cx + 10} y1={yHigh} y2={yHigh} stroke={color} strokeWidth={1.5} />
                    <line x1={cx - 10} x2={cx + 10} y1={yLow} y2={yLow} stroke={color} strokeWidth={1.5} />
                    {/* IQR box */}
                    <rect x={cx - W / 3} y={yQ3} width={W * 2 / 3} height={yQ1 - yQ3} fill={color + '30'} stroke={color} strokeWidth={2} rx={2} />
                    {/* median */}
                    <line x1={cx - W / 3} x2={cx + W / 3} y1={yMed} y2={yMed} stroke={color} strokeWidth={3} />
                    {/* mean dot */}
                    <circle cx={cx} cy={scl(s.mean)} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
                    {/* outliers */}
                    {s.outliers.slice(0, 20).map((o, oi) => <circle key={oi} cx={cx + (oi % 2 === 0 ? -12 : 12)} cy={scl(o)} r={3} fill="none" stroke={color} strokeWidth={1.5} />)}
                    {/* label */}
                    <text x={cx} y={H + PAD + 14} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={600}>{s.col.length > 10 ? s.col.slice(0, 10) + '…' : s.col}</text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap' }}>
            <span>Box = IQR (Q1–Q3)</span>
            <span>— = Median</span>
            <span>• = Mean</span>
            <span>○ = Outliers</span>
          </div>

          <div style={{ marginTop: 20, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}>{['Column', 'N', 'Min', 'Q1', 'Median', 'Mean', 'Q3', 'Max', 'IQR', 'Outliers'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
              <tbody>
                {result.stats.map((s, i) => (
                  <tr key={s.col} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0c1446' }}>{s.col}</td>
                    <td style={{ padding: '7px 10px' }}>{s.count}</td>
                    {[s.min, s.q1, s.median, s.mean, s.q3, s.max, s.iqr].map((v, vi) => <td key={vi} style={{ padding: '7px 10px', color: '#374151' }}>{parseFloat(v.toFixed(2)).toLocaleString()}</td>)}
                    <td style={{ padding: '7px 10px', color: s.outliers.length > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{s.outliers.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📦</div><div>Select columns to visualize their distributions</div></div>}
    </div>
  )
}
