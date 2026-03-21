import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function ParetoAnalysis() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [catCol, setCatCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!catCol || !valCol || !rows.length) return
    const groups = {}
    rows.forEach(r => {
      const k = r[catCol] || '(blank)'; const v = parseFloat(r[valCol]) || 0
      groups[k] = (groups[k] || 0) + v
    })
    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1])
    const total = sorted.reduce((a, [, v]) => a + v, 0)
    let cumPct = 0
    const data = sorted.map(([name, value]) => {
      cumPct += (value / total) * 100
      return { name: name.length > 14 ? name.slice(0, 14) + '…' : name, value: parseFloat(value.toFixed(2)), cumPct: parseFloat(cumPct.toFixed(1)) }
    })
    const vital = data.filter(d => d.cumPct <= 80)
    setResult({ data: data.slice(0, 20), total, vital: vital.length, trivial: data.length - vital.length })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Pareto Analysis (80/20)</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Find the 20% of categories that drive 80% of your results</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Category Column', <select value={catCol} onChange={e => setCatCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Value Column', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={run} disabled={!catCol || !valCol} style={{ padding: '9px 24px', background: catCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: catCol && valCol ? 'pointer' : 'default' }}>Run Pareto</button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['Total Value', Number(result.total).toLocaleString(undefined, { maximumFractionDigits: 0 }), '#0c1446'],
              ['Vital Few (≤80%)', `${result.vital} categories`, '#e91e8c'],
              ['Trivial Many (>80%)', `${result.trivial} categories`, '#6b7280']
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Pareto Chart — Top {result.data.length} categories</div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={result.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="value" fill="#0097b2" radius={[4, 4, 0, 0]} name={valCol} />
                <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="#e91e8c" strokeWidth={2} dot={{ r: 3 }} name="Cumulative %" />
                <ReferenceLine yAxisId="right" y={80} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '80%', position: 'right', fontSize: 11, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div><div>Select category and value columns to run Pareto analysis</div></div>}
    </div>
  )
}
