import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function RollingAverage() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [valCol, setValCol] = useState('')
  const [labelCol, setLabelCol] = useState('')
  const [window3, setWindow3] = useState(true)
  const [window7, setWindow7] = useState(true)
  const [window30, setWindow30] = useState(false)
  const [customWindow, setCustomWindow] = useState(14)
  const [useCustom, setUseCustom] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function rollingAvg(vals, w) {
    return vals.map((_, i) => {
      if (i < w - 1) return null
      const slice = vals.slice(i - w + 1, i + 1)
      return parseFloat((slice.reduce((a, b) => a + b, 0) / w).toFixed(2))
    })
  }

  function run() {
    if (!valCol || !rows.length) return
    const vals = rows.map(r => parseFloat(r[valCol]) || 0)
    const labels = rows.map((r, i) => r[labelCol] || String(i + 1))
    const windows = []
    if (window3) windows.push(3)
    if (window7) windows.push(7)
    if (window30) windows.push(30)
    if (useCustom && customWindow > 1) windows.push(customWindow)
    const chartData = vals.map((v, i) => {
      const point = { label: labels[i], value: v }
      windows.forEach(w => { point[`MA${w}`] = rollingAvg(vals, w)[i] })
      return point
    })
    setResult({ chartData, windows, count: vals.length, mean: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))
  const colors = { 3: '#e91e8c', 7: '#0097b2', 30: '#10b981', [customWindow]: '#f59e0b' }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Rolling Average</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Smooth time-series data with moving averages to identify trends</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Value Column', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Label Column', <select value={labelCol} onChange={e => setLabelCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">(row index)</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Moving Average Windows</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[[window3, setWindow3, '3-period', '#e91e8c'], [window7, setWindow7, '7-period', '#0097b2'], [window30, setWindow30, '30-period', '#10b981']].map(([active, setter, label, color]) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={active} onChange={e => setter(e.target.checked)} />
                <span style={{ color: active ? color : '#9ca3af', fontWeight: active ? 700 : 400, fontSize: '0.875rem' }}>{label}</span>
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} />
              <input type="number" value={customWindow} onChange={e => setCustomWindow(parseInt(e.target.value) || 14)} min="2" max="100" style={{ width: 60, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>custom</span>
            </label>
          </div>
        </div>

        <button onClick={run} disabled={!valCol} style={{ padding: '9px 24px', background: valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: valCol ? 'pointer' : 'default' }}>Calculate</button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[['Data Points', result.count, '#0c1446'], ['Mean Value', result.mean.toLocaleString(), '#0097b2']].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{k}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Values with Moving Averages</div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={result.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#e5e7eb" name="Actual" opacity={0.6} />
                {result.windows.map(w => (
                  <Line key={w} type="monotone" dataKey={`MA${w}`} stroke={colors[w] || '#8b5cf6'} strokeWidth={2} dot={false} name={`${w}-period MA`} connectNulls />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📈</div><div>Select a value column and moving average windows to smooth the data</div></div>}
    </div>
  )
}
