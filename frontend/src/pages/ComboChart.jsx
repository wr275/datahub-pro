import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function ComboChart() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [barCol, setBarCol] = useState('')
  const [lineCol, setLineCol] = useState('')
  const [agg, setAgg] = useState('sum')
  const [chartData, setChartData] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setChartData(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function build() {
    if (!xCol || !barCol || !lineCol || !rows.length) return
    const groups = {}
    rows.forEach(r => {
      const k = String(r[xCol] ?? ''); const bv = parseFloat(r[barCol]) || 0; const lv = parseFloat(r[lineCol]) || 0
      if (!groups[k]) groups[k] = { bar: [], line: [] }
      groups[k].bar.push(bv); groups[k].line.push(lv)
    })
    const agg_fn = (vals) => agg === 'sum' ? vals.reduce((a, b) => a + b, 0) : agg === 'count' ? vals.length : vals.reduce((a, b) => a + b, 0) / vals.length
    const data = Object.entries(groups).map(([k, v]) => ({
      name: k,
      [barCol]: parseFloat(agg_fn(v.bar).toFixed(2)),
      [lineCol]: parseFloat(agg_fn(v.line).toFixed(2))
    })).sort((a, b) => String(a.name).localeCompare(String(b.name)))
    setChartData({ data, barCol, lineCol })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Combo Chart</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Combine bars and a line to compare two metrics simultaneously</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['X Axis', <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Bar Series', <select value={barCol} onChange={e => setBarCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Line Series', <select value={lineCol} onChange={e => setLineCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Aggregation', <select value={agg} onChange={e => setAgg(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>{['sum', 'mean', 'count'].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={build} disabled={!xCol || !barCol || !lineCol} style={{ padding: '9px 24px', background: xCol && barCol && lineCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: xCol && barCol && lineCol ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {chartData && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>{chartData.barCol} (bar) + {chartData.lineCol} (line) by {xCol}</div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey={chartData.barCol} fill="#0097b2" radius={[4, 4, 0, 0]} name={chartData.barCol} />
              <Line yAxisId="right" type="monotone" dataKey={chartData.lineCol} stroke="#e91e8c" strokeWidth={2.5} dot={{ r: 3 }} name={chartData.lineCol} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!chartData && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div><div>Configure series and click Build Chart</div></div>}
    </div>
  )
}
