import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

export default function BarChartPage() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [agg, setAgg] = useState('sum')
  const [orientation, setOrientation] = useState('vertical')
  const [topN, setTopN] = useState(20)
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
    const groups = {}
    rows.forEach(r => {
      const k = String(r[xCol] ?? '(blank)'); const v = parseFloat(r[yCol]) || 0
      if (!groups[k]) groups[k] = []
      groups[k].push(v)
    })
    let data = Object.entries(groups).map(([name, vals]) => {
      const sum = vals.reduce((a, b) => a + b, 0)
      const value = agg === 'sum' ? sum : agg === 'count' ? vals.length : agg === 'mean' ? sum / vals.length : agg === 'min' ? Math.min(...vals) : Math.max(...vals)
      return { name, value: parseFloat(value.toFixed(2)) }
    }).sort((a, b) => b.value - a.value).slice(0, topN)
    setChartData(data)
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Bar Chart</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Visualize grouped data with customizable bar charts</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['X Axis (Group)', <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Y Axis (Value)', <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Aggregation', <select value={agg} onChange={e => setAgg(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>{['sum', 'mean', 'count', 'min', 'max'].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}</select>],
            ['Orientation', <select value={orientation} onChange={e => setOrientation(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select>],
            ['Top N', <select value={topN} onChange={e => setTopN(parseInt(e.target.value))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value={10}>Top 10</option><option value={20}>Top 20</option><option value={50}>Top 50</option></select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={build} disabled={!xCol || !yCol} style={{ padding: '9px 24px', background: xCol && yCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: xCol && yCol ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {chartData && (
        <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#0c1446' }}>{agg.charAt(0).toUpperCase() + agg.slice(1)} of {yCol} by {xCol}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <OpenInAskYourData
                fileId={fileId}
                prompt={`In a bar chart of ${agg} ${yCol} by ${xCol}, the top performer is ${chartData[0]?.name} (${chartData[0]?.value?.toLocaleString()}). What's driving the gap between top and bottom of the list?`}
              />
              <PinToDashboard
                widget={{
                  type: 'bar',
                  col: yCol,
                  label: `${yCol} by ${xCol}`,
                  file_id: fileId,
                  extra: { xCol, agg, topN, orientation },
                }}
              />
              <ExportMenu data={chartData} filename={`bar-${xCol}-${yCol}`} containerRef={chartRef} title={`Bar Chart: ${yCol} by ${xCol}`} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(320, orientation === 'horizontal' ? chartData.length * 36 + 60 : 320)}>
            {orientation === 'horizontal' ? (
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name={`${agg} of ${yCol}`}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name={`${agg} of ${yCol}`}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {!chartData && (
        <EmptyState
          icon="📊"
          title="Configure axes and click Build Chart"
          body="Pick a category column for X, a numeric column for Y, choose aggregation, and decide top N + orientation. Bars are sorted descending by value."
        />
      )}
    </div>
  )
}
