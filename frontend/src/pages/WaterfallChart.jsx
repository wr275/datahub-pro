import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

export default function WaterfallChart() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [labelCol, setLabelCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [chartData, setChartData] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setChartData(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function build() {
    if (!labelCol || !valCol || !rows.length) return
    const pts = rows.slice(0, 20).map(r => ({ name: String(r[labelCol] ?? ''), value: parseFloat(r[valCol]) || 0 }))
    let running = 0
    const data = pts.map((p, i) => {
      const base = i === 0 ? 0 : running
      const newRunning = base + p.value
      const result = { name: p.name, value: p.value, base, end: newRunning, positive: p.value >= 0 }
      running = newRunning
      return result
    })
    data.push({ name: 'Total', value: running, base: 0, end: running, isTotal: true, positive: running >= 0 })
    setChartData(data)
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
        <div>Value: <strong style={{ color: d.positive ? '#10b981' : '#ef4444' }}>{d.positive ? '+' : ''}{d.value?.toLocaleString()}</strong></div>
        {!d.isTotal && <div style={{ color: '#6b7280' }}>Running total: {d.end?.toLocaleString()}</div>}
      </div>
    )
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Waterfall Chart</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Show cumulative effect of sequential positive and negative values</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Labels (X)', <select value={labelCol} onChange={e => setLabelCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Values (Y)', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: 12 }}>Note: Uses first 20 rows as sequential steps</div>
        <button onClick={build} disabled={!labelCol || !valCol} style={{ padding: '9px 24px', background: labelCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: labelCol && valCol ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {chartData && (
        <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#0c1446' }}>Waterfall: {valCol} by {labelCol}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <OpenInAskYourData
                fileId={fileId}
                prompt={`In a waterfall of ${valCol} by ${labelCol}, the running total ends at ${chartData[chartData.length - 1]?.end?.toLocaleString()}. Which step contributed most positively and most negatively, and why?`}
              />
              <PinToDashboard
                widget={{
                  type: 'waterfall',
                  col: valCol,
                  label: `Waterfall: ${valCol} by ${labelCol}`,
                  file_id: fileId,
                  extra: { labelCol },
                }}
              />
              <ExportMenu data={chartData} filename={`waterfall-${labelCol}-${valCol}`} containerRef={chartRef} title={`Waterfall: ${valCol} by ${labelCol}`} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[['Positive', '#10b981'], ['Negative', '#ef4444'], ['Total', '#0c1446']].map(([l, c]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#6b7280' }}>
                <span style={{ width: 12, height: 12, background: c, borderRadius: 2, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]} name="Value">
                {chartData.map((d, i) => <Cell key={i} fill={d.isTotal ? '#0c1446' : d.positive ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!chartData && (
        <EmptyState
          icon="🏗️"
          title="Pick label and value columns"
          body="The waterfall shows the cumulative effect of sequential positive and negative contributions, with green/red bars and a final total."
        />
      )}
    </div>
  )
}
