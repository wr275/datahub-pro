import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function FunnelChart() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [labelCol, setLabelCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [sortMode, setSortMode] = useState('desc')
  const [chartData, setChartData] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setChartData(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function build() {
    if (!labelCol || !valCol || !rows.length) return
    const groups = {}
    rows.forEach(r => {
      const k = String(r[labelCol] ?? ''); const v = parseFloat(r[valCol]) || 0
      groups[k] = (groups[k] || 0) + v
    })
    let data = Object.entries(groups).map(([name, value]) => ({ name, value }))
    if (sortMode === 'desc') data.sort((a, b) => b.value - a.value)
    else if (sortMode === 'asc') data.sort((a, b) => a.value - b.value)
    data = data.slice(0, 10)
    const maxVal = data[0]?.value || 1
    data = data.map((d, i) => ({
      ...d,
      pct: parseFloat((d.value / maxVal * 100).toFixed(1)),
      convRate: i === 0 ? 100 : parseFloat((d.value / data[0].value * 100).toFixed(1)),
      dropOff: i === 0 ? 0 : parseFloat(((data[i - 1].value - d.value) / data[i - 1].value * 100).toFixed(1))
    }))
    setChartData(data)
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  const stageColors = ['#0c1446', '#0d1e5a', '#0e2870', '#0f3280', '#103c96', '#1146ac', '#1250c2', '#135ad8', '#1464ee', '#156eff']

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Funnel Chart</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Visualize conversion rates and drop-offs across stages</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Stage Labels', <select value={labelCol} onChange={e => setLabelCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Values', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Order', <select value={sortMode} onChange={e => setSortMode(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="desc">Descending (funnel)</option><option value="asc">Ascending</option><option value="none">As in data</option></select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={build} disabled={!labelCol || !valCol} style={{ padding: '9px 24px', background: labelCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: labelCol && valCol ? 'pointer' : 'default' }}>Build Funnel</button>
      </div>

      {chartData && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 20 }}>Conversion Funnel — {valCol}</div>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {chartData.map((d, i) => (
              <div key={d.name} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: `${Math.max(30, d.pct)}%`, background: stageColors[i % stageColors.length], borderRadius: 4, padding: '12px 16px', textAlign: 'center', transition: 'width 0.5s ease', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{d.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}>{d.value.toLocaleString()}</span>
                  </div>
                </div>
                {i < chartData.length - 1 && d.dropOff > 0 && (
                  <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '0.75rem', color: '#ef4444' }}>↓ {d.dropOff}% drop-off</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {chartData.map((d, i) => (
              <div key={d.name} style={{ background: '#f9fafb', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{d.name}</div>
                <div style={{ fontWeight: 800, color: '#0c1446' }}>{d.convRate}%</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>of total</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!chartData && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🔻</div><div>Select stage and value columns to build the funnel</div></div>}
    </div>
  )
}
