import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#ec4899', '#14b8a6']

export default function PieChartPage() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [labelCol, setLabelCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [agg, setAgg] = useState('sum')
  const [chartType, setChartType] = useState('pie')
  const [topN, setTopN] = useState(10)
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
    const groups = {}
    rows.forEach(r => {
      const k = String(r[labelCol] ?? '(blank)'); const v = parseFloat(r[valCol]) || 0
      if (!groups[k]) groups[k] = []
      groups[k].push(v)
    })
    let data = Object.entries(groups).map(([name, vals]) => {
      const sum = vals.reduce((a, b) => a + b, 0)
      const value = agg === 'sum' ? sum : agg === 'count' ? vals.length : sum / vals.length
      return { name, value: parseFloat(Math.max(0, value).toFixed(2)) }
    }).sort((a, b) => b.value - a.value)
    if (data.length > topN) {
      const rest = data.slice(topN).reduce((a, d) => a + d.value, 0)
      data = [...data.slice(0, topN), { name: 'Other', value: parseFloat(rest.toFixed(2)) }]
    }
    const total = data.reduce((a, d) => a + d.value, 0)
    data = data.map(d => ({ ...d, pct: parseFloat((d.value / total * 100).toFixed(1)) }))
    setChartData(data)
  }

  const RADIAN = Math.PI / 180
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
    if (pct < 5) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>{pct}%</text>
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Pie / Donut Chart</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Visualize proportional breakdowns of your data</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Labels', <select value={labelCol} onChange={e => setLabelCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Values', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Aggregation', <select value={agg} onChange={e => setAgg(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>{['sum', 'count', 'mean'].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}</select>],
            ['Style', <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="pie">Pie</option><option value="donut">Donut</option></select>],
            ['Max Slices', <select value={topN} onChange={e => setTopN(parseInt(e.target.value))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value={5}>5</option><option value={8}>8</option><option value={10}>10</option><option value={12}>12</option></select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={build} disabled={!labelCol || !valCol} style={{ padding: '9px 24px', background: labelCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: labelCol && valCol ? 'pointer' : 'default' }}>Build Chart</button>
      </div>

      {chartData && (
        <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          <OpenInAskYourData
            fileId={fileId}
            prompt={`In a pie chart of ${valCol} by ${labelCol}, the top slice is ${chartData[0]?.name} (${chartData[0]?.pct}%). Is the distribution healthy or too concentrated? What's the right benchmark?`}
          />
          <PinToDashboard
            widget={{
              type: 'pie',
              col: valCol,
              label: `${valCol} by ${labelCol}`,
              file_id: fileId,
              extra: { labelCol, agg, topN, chartType },
            }}
          />
          <ExportMenu data={chartData} filename={`pie-${labelCol}-${valCol}`} containerRef={chartRef} title={`Pie: ${valCol} by ${labelCol}`} />
        </div>
        <div ref={chartRef} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>{agg.charAt(0).toUpperCase() + agg.slice(1)} of {valCol} by {labelCol}</div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={130} innerRadius={chartType === 'donut' ? 60 : 0} dataKey="value" labelLine={false} label={renderLabel}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n, p) => [v.toLocaleString() + ' (' + p.payload.pct + '%)', n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Breakdown</div>
            {chartData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.85rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</span>
                <span style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.85rem' }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      {!chartData && (
        <EmptyState
          icon="🥧"
          title="Configure labels and values"
          body="Pick a category column for slices, a numeric column for values, and choose pie or donut. Slices beyond Max are bundled into 'Other'."
        />
      )}
    </div>
  )
}
