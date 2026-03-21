import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

export default function Forecasting() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [valCol, setValCol] = useState('')
  const [periods, setPeriods] = useState(6)
  const [method, setMethod] = useState('ema')
  const [alpha, setAlpha] = useState(0.3)
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!valCol || !rows.length) return
    const vals = rows.map(r => parseFloat(r[valCol])).filter(v => !isNaN(v))
    if (vals.length < 3) return
    const n = vals.length
    let forecasted = []

    if (method === 'sma') {
      const window = Math.min(5, Math.floor(n / 2))
      let last = vals.slice(-window).reduce((a, b) => a + b, 0) / window
      for (let i = 0; i < periods; i++) forecasted.push(last)
    } else if (method === 'ema') {
      let ema = vals[0]
      vals.forEach(v => { ema = alpha * v + (1 - alpha) * ema })
      let trend = vals[n - 1] - vals[n - 2]
      for (let i = 0; i < periods; i++) { ema = ema + trend * 0.1; forecasted.push(parseFloat(ema.toFixed(2))) }
    } else {
      // Linear trend
      const indices = vals.map((_, i) => i)
      const mx = (n - 1) / 2
      const my = vals.reduce((a, b) => a + b, 0) / n
      const slope = vals.reduce((a, v, i) => a + (i - mx) * (v - my), 0) / vals.reduce((a, _, i) => a + (i - mx) ** 2, 0)
      const intercept = my - slope * mx
      for (let i = 0; i < periods; i++) forecasted.push(parseFloat((slope * (n + i) + intercept).toFixed(2)))
    }

    const historical = vals.map((v, i) => ({ x: i + 1, actual: v }))
    const forecast = forecasted.map((v, i) => ({ x: n + i + 1, forecast: v }))
    const mape = vals.slice(-Math.min(5, n)).reduce((a, v, i) => {
      const idx = vals.length - Math.min(5, n) + i
      return a + (Math.abs(v - (vals[idx - 1] || v)) / (v || 1)) * 100
    }, 0) / Math.min(5, n)

    setResult({ historical, forecast, lastActual: vals[n - 1], nextForecast: forecasted[0], mape: mape.toFixed(1) })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))
  const combined = result ? [...result.historical, ...result.forecast] : []

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Forecasting</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Project future values using EMA, SMA or linear trend models</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select></div>
          <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Value Column</div>
            <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Column --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select></div>
          <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Method</div>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="ema">EMA (Exponential)</option>
              <option value="sma">SMA (Moving Avg)</option>
              <option value="linear">Linear Trend</option>
            </select></div>
          <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Forecast Periods: {periods}</div>
            <input type="range" min={1} max={12} value={periods} onChange={e => setPeriods(parseInt(e.target.value))} style={{ width: '100%', marginTop: 8 }} /></div>
          {method === 'ema' && <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Alpha: {alpha}</div>
            <input type="range" min={0.1} max={0.9} step={0.05} value={alpha} onChange={e => setAlpha(parseFloat(e.target.value))} style={{ width: '100%', marginTop: 8 }} /></div>}
        </div>
        <button onClick={run} disabled={!valCol} style={{ padding: '9px 24px', background: valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: valCol ? 'pointer' : 'default' }}>Generate Forecast</button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['Last Actual', Number(result.lastActual).toLocaleString(undefined, { maximumFractionDigits: 2 }), '#0c1446'],
              ['Next Forecast', Number(result.nextForecast).toLocaleString(undefined, { maximumFractionDigits: 2 }), '#e91e8c'],
              ['Est. MAPE', result.mape + '%', '#f59e0b']
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Historical + {periods}-Period Forecast</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={combined}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: 'Period', position: 'insideBottom', offset: -5, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine x={result.historical.length} stroke="#d1d5db" strokeDasharray="4 4" label={{ value: 'Now', position: 'top', fontSize: 11 }} />
                <Line type="monotone" dataKey="actual" stroke="#0097b2" strokeWidth={2} dot={{ r: 3 }} name="Actual" connectNulls={false} />
                <Line type="monotone" dataKey="forecast" stroke="#e91e8c" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="6 3" name="Forecast" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📈</div><div>Select a file and value column to generate a forecast</div></div>}
    </div>
  )
}
