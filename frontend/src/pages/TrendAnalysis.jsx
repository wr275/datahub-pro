import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

export default function TrendAnalysis() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [trendType, setTrendType] = useState('linear')
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!yCol || !rows.length) return
    const pts = rows.map((r, i) => ({ x: xCol ? (r[xCol] || i) : i + 1, y: parseFloat(r[yCol]) || 0, label: xCol ? String(r[xCol] || i + 1) : String(i + 1) }))
    const yVals = pts.map(p => p.y)
    const n = pts.length
    const mean = yVals.reduce((a, b) => a + b, 0) / n

    let trendLine
    if (trendType === 'linear') {
      const sumX = pts.reduce((a, _, i) => a + i, 0); const sumY = yVals.reduce((a, b) => a + b, 0)
      const sumXY = pts.reduce((a, _, i) => a + i * yVals[i], 0); const sumX2 = pts.reduce((a, _, i) => a + i * i, 0)
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n
      trendLine = pts.map((p, i) => parseFloat((slope * i + intercept).toFixed(2)))
    } else if (trendType === 'moving_avg') {
      const w = Math.max(3, Math.floor(n / 8))
      trendLine = yVals.map((_, i) => {
        if (i < w - 1) return null
        return parseFloat((yVals.slice(i - w + 1, i + 1).reduce((a, b) => a + b, 0) / w).toFixed(2))
      })
    } else { // exponential smoothing
      const alpha = 0.3; let ema = yVals[0]
      trendLine = yVals.map(v => { ema = alpha * v + (1 - alpha) * ema; return parseFloat(ema.toFixed(2)) })
    }

    const chartData = pts.map((p, i) => ({ label: p.label, actual: p.y, trend: trendLine[i] }))
    const change = trendLine[n - 1] != null && trendLine[0] != null ? ((trendLine[n - 1] - trendLine[0]) / Math.abs(trendLine[0]) * 100).toFixed(1) : null
    const direction = change == null ? 'stable' : change > 5 ? 'upward' : change < -5 ? 'downward' : 'stable'
    setResult({ chartData, mean: parseFloat(mean.toFixed(2)), change, direction, n })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Trend Analysis</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Identify trends in your data using linear regression, moving averages, or smoothing</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['X Axis (optional)', <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">(row index)</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Value Column', <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Trend Method', <select value={trendType} onChange={e => setTrendType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="linear">Linear Regression</option><option value="moving_avg">Moving Average</option><option value="ema">Exponential Smoothing</option></select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={run} disabled={!yCol} style={{ padding: '9px 24px', background: yCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: yCol ? 'pointer' : 'default' }}>Analyse Trend</button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              ['Data Points', result.n, '#0c1446'],
              ['Mean Value', result.mean.toLocaleString(), '#0097b2'],
              ['Overall Change', result.change != null ? `${result.change >= 0 ? '+' : ''}${result.change}%` : '—', result.change > 0 ? '#10b981' : result.change < 0 ? '#ef4444' : '#9ca3af'],
              ['Trend Direction', result.direction.charAt(0).toUpperCase() + result.direction.slice(1), result.direction === 'upward' ? '#10b981' : result.direction === 'downward' ? '#ef4444' : '#f59e0b']
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Actual vs Trend Line</div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={result.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={result.mean} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: 'Mean', position: 'right', fontSize: 10, fill: '#9ca3af' }} />
                <Bar dataKey="actual" fill="#e5e7eb" name="Actual" opacity={0.7} />
                <Line type="monotone" dataKey="trend" stroke="#e91e8c" strokeWidth={2.5} dot={false} name="Trend" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📉</div><div>Select a value column and trend method to analyse</div></div>}
    </div>
  )
}
