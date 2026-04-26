import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

export default function ScatterPlot() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [sizeCol, setSizeCol] = useState('')
  const [colorCol, setColorCol] = useState('')
  const [chartData, setChartData] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setChartData(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function build() {
    if (!xCol || !yCol || !rows.length) return
    const pts = rows.slice(0, 500).map((r, i) => ({
      x: parseFloat(r[xCol]) || 0,
      y: parseFloat(r[yCol]) || 0,
      z: sizeCol ? Math.max(1, parseFloat(r[sizeCol]) || 1) : 1,
      group: colorCol ? String(r[colorCol] ?? '') : 'All',
      label: headers.slice(0, 3).map(h => `${h}: ${r[h]}`).join(', ')
    })).filter(p => !isNaN(p.x) && !isNaN(p.y))
    const groups = colorCol ? [...new Set(pts.map(p => p.group))].slice(0, 6) : ['All']
    const grouped = groups.map((g, i) => ({ name: g, data: pts.filter(p => p.group === g), color: COLORS[i % COLORS.length] }))
    setChartData({ grouped, groups })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Scatter Plot</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Explore relationships between two variables with optional size and color encoding</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['X Axis', <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Y Axis', <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Size (optional)', <select value={sizeCol} onChange={e => setSizeCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">(uniform)</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Color Group', <select value={colorCol} onChange={e => setColorCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">(none)</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={build} disabled={!xCol || !yCol} style={{ padding: '9px 24px', background: xCol && yCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: xCol && yCol ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {chartData && (
        <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#0c1446' }}>{yCol} vs {xCol}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <OpenInAskYourData
                fileId={fileId}
                prompt={`The scatter of ${yCol} vs ${xCol}${colorCol ? ` grouped by ${colorCol}` : ''} shows ${chartData.grouped.reduce((s, g) => s + g.data.length, 0)} points. What's the relationship — linear, non-linear, or no signal?`}
              />
              <PinToDashboard
                widget={{
                  type: 'scatter',
                  col: yCol,
                  label: `${yCol} vs ${xCol}`,
                  file_id: fileId,
                  extra: { x: xCol, y: yCol, sizeCol, colorCol },
                }}
              />
              <ExportMenu
                data={chartData.grouped.flatMap(g => g.data.map(p => ({ group: g.name, x: p.x, y: p.y, size: p.z })))}
                filename={`scatter-${xCol}-${yCol}`}
                containerRef={chartRef}
                title={`Scatter: ${yCol} vs ${xCol}`}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {chartData.grouped.map(g => (
              <span key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, display: 'inline-block' }} />
                <span style={{ color: '#6b7280' }}>{g.name} ({g.data.length})</span>
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} label={{ value: xCol, position: 'insideBottom', offset: -5, fontSize: 12 }} />
              <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} label={{ value: yCol, angle: -90, position: 'insideLeft', fontSize: 12 }} />
              {sizeCol && <ZAxis dataKey="z" range={[20, 200]} />}
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => payload?.length ? <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem' }}><div>{xCol}: {payload[0]?.payload?.x}</div><div>{yCol}: {payload[0]?.payload?.y}</div>{payload[0]?.payload?.group !== 'All' && <div>Group: {payload[0]?.payload?.group}</div>}</div> : null} />
              {chartData.grouped.map(g => (
                <Scatter key={g.name} name={g.name} data={g.data} fill={g.color} opacity={0.7} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {!chartData && (
        <EmptyState
          icon="⚡"
          title="Pick X and Y axes"
          body="Optionally add a size column (bubbles) or color group (categorical legend). Up to 500 points are plotted; oversize datasets are sampled."
        />
      )}
    </div>
  )
}
