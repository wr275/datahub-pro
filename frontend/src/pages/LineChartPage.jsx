import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

const LINE_COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']

export default function LineChartPage() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCols, setYCols] = useState([''])
  const [smooth, setSmooth] = useState(true)
  const [showDots, setShowDots] = useState(false)
  const [chartData, setChartData] = useState(null)
  const [dateRange, setDateRange] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setChartData(null); setDateRange(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function build() {
    if (!xCol || !yCols.filter(Boolean).length || !rows.length) return
    const active = yCols.filter(Boolean)
    const scoped = applyDateFilter(rows, dateRange)
    if (!scoped.length) { setChartData(null); return }
    const data = scoped.slice(0, 500).map(r => {
      const point = { x: r[xCol] }
      active.forEach(col => { point[col] = parseFloat(r[col]) || null })
      return point
    })
    setChartData({ data, active })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Line Chart</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Visualize trends over time with multi-series line charts</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>X Axis (Label/Date)</div>
            <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Column --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Y Axis Series (up to 5)</div>
          {yCols.map((col, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: LINE_COLORS[i % LINE_COLORS.length] }} />
              <select value={col} onChange={e => { const u = [...yCols]; u[i] = e.target.value; setYCols(u) }} style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }}>
                <option value="">-- Series {i + 1} --</option>
                {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              {yCols.length > 1 && <button onClick={() => setYCols(yCols.filter((_, idx) => idx !== i))} style={{ padding: '8px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>}
            </div>
          ))}
          {yCols.length < 5 && <button onClick={() => setYCols([...yCols, ''])} style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>+ Add Series</button>}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={smooth} onChange={e => setSmooth(e.target.checked)} />
            <span style={{ fontSize: '0.875rem' }}>Smooth curves</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showDots} onChange={e => setShowDots(e.target.checked)} />
            <span style={{ fontSize: '0.875rem' }}>Show data points</span>
          </label>
        </div>

        {headers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="line-chart.dateRange"
            />
          </div>
        )}

        <button onClick={build} disabled={!xCol || !yCols.some(Boolean)} style={{ padding: '9px 24px', background: xCol && yCols.some(Boolean) ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: xCol && yCols.some(Boolean) ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {chartData && (
        <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#0c1446' }}>{chartData.active.join(', ')} over {xCol}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <OpenInAskYourData
                fileId={fileId}
                prompt={`In a line chart of ${chartData.active.join(', ')} over ${xCol}, where do the series diverge or converge most? Are there obvious turning points?`}
              />
              <PinToDashboard
                widget={{
                  type: 'line',
                  col: chartData.active[0],
                  label: `${chartData.active.join(', ')} over ${xCol}`,
                  file_id: fileId,
                  extra: { xCol, series: chartData.active, smooth, showDots },
                }}
              />
              <ExportMenu data={chartData.data} filename={`line-${xCol}`} containerRef={chartRef} title={`Line Chart: ${chartData.active.join(', ')} over ${xCol}`} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {chartData.active.map((col, i) => (
                <Line key={col} type={smooth ? 'monotone' : 'linear'} dataKey={col} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={showDots ? { r: 3 } : false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!chartData && (
        <EmptyState
          icon="📈"
          title="Configure axes and add series"
          body="Pick an X-axis (often a date), then up to 5 numeric series to overlay. Use the date range filter to scope to a window."
        />
      )}
    </div>
  )
}
