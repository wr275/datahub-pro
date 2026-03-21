import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function HeatmapPage() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [rowCol, setRowCol] = useState('')
  const [colCol, setColCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [agg, setAgg] = useState('sum')
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function build() {
    if (!rowCol || !colCol || !valCol || !rows.length) return
    const data = {}
    rows.forEach(r => {
      const rk = String(r[rowCol] ?? ''); const ck = String(r[colCol] ?? ''); const v = parseFloat(r[valCol]) || 0
      if (!data[rk]) data[rk] = {}
      if (!data[rk][ck]) data[rk][ck] = []
      data[rk][ck].push(v)
    })
    const rowKeys = Object.keys(data).sort().slice(0, 20)
    const colKeys = [...new Set(rows.map(r => String(r[colCol] ?? '')))].sort().slice(0, 15)
    const matrix = {}
    rowKeys.forEach(rk => {
      matrix[rk] = {}
      colKeys.forEach(ck => {
        const vals = data[rk]?.[ck] || []
        if (!vals.length) { matrix[rk][ck] = null; return }
        const sum = vals.reduce((a, b) => a + b, 0)
        matrix[rk][ck] = agg === 'sum' ? sum : agg === 'count' ? vals.length : agg === 'mean' ? sum / vals.length : agg === 'min' ? Math.min(...vals) : Math.max(...vals)
        matrix[rk][ck] = parseFloat(matrix[rk][ck].toFixed(2))
      })
    })
    const allVals = rowKeys.flatMap(rk => colKeys.map(ck => matrix[rk][ck] || 0))
    const minV = Math.min(...allVals); const maxV = Math.max(...allVals)
    setResult({ matrix, rowKeys, colKeys, minV, maxV })
  }

  function cellBg(val, minV, maxV) {
    if (val == null) return '#f9fafb'
    const t = maxV > minV ? (val - minV) / (maxV - minV) : 0
    const r = Math.round(255 - t * (255 - 0))
    const g = Math.round(255 - t * (255 - 151))
    const b = Math.round(255 - t * (255 - 178))
    return `rgb(${r},${g},${b})`
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Heatmap</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Visualize the intensity of values across two categorical dimensions</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Row Axis', <select value={rowCol} onChange={e => setRowCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Column Axis', <select value={colCol} onChange={e => setColCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Value', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Aggregation', <select value={agg} onChange={e => setAgg(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>{['sum', 'mean', 'count', 'min', 'max'].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={build} disabled={!rowCol || !colCol || !valCol} style={{ padding: '9px 24px', background: rowCol && colCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: rowCol && colCol && valCol ? 'pointer' : 'default' }}>Build Heatmap</button>
      </div>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>{agg.charAt(0).toUpperCase() + agg.slice(1)} of {valCol} — {rowCol} × {colCol}</div>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}></th>
                {result.colKeys.map(c => <th key={c} style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 70 }}>{c.length > 10 ? c.slice(0, 10) + '…' : c}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.rowKeys.map(rk => (
                <tr key={rk}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{rk.length > 15 ? rk.slice(0, 15) + '…' : rk}</td>
                  {result.colKeys.map(ck => {
                    const v = result.matrix[rk][ck]
                    return (
                      <td key={ck} style={{ padding: 3, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ width: 66, height: 38, background: cellBg(v, result.minV, result.maxV), borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: v != null && (result.maxV > result.minV ? (v - result.minV) / (result.maxV - result.minV) : 0) > 0.5 ? '#fff' : '#374151' }}>
                          {v != null ? v.toLocaleString() : '—'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: '#6b7280' }}>
            <span>Low: {result.minV.toLocaleString()}</span>
            <div style={{ flex: 1, maxWidth: 200, height: 8, borderRadius: 4, background: 'linear-gradient(to right, rgb(255,255,255), rgb(0,151,178))' }} />
            <span>High: {result.maxV.toLocaleString()}</span>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🌡️</div><div>Select row, column, and value axes to build the heatmap</div></div>}
    </div>
  )
}
