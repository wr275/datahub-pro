import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

export default function WhatIf() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [baseCol, setBaseCol] = useState('')
  const [scenarios, setScenarios] = useState([
    { name: 'Pessimistic', change: -20, color: '#ef4444' },
    { name: 'Base Case', change: 0, color: '#0097b2' },
    { name: 'Optimistic', change: 20, color: '#10b981' }
  ])
  const [result, setResult] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
    }).catch(() => {})
  }

  function run() {
    if (!baseCol || !rows.length) return
    const vals = rows.map(r => parseFloat(r[baseCol]) || 0)
    const base = vals.reduce((a, b) => a + b, 0)
    const mean = base / vals.length
    const chartData = vals.map((v, i) => {
      const point = { index: i + 1, base: parseFloat(v.toFixed(2)) }
      scenarios.forEach(s => {
        point[s.name] = parseFloat((v * (1 + s.change / 100)).toFixed(2))
      })
      return point
    })
    const totals = scenarios.map(s => ({
      name: s.name,
      color: s.color,
      change: s.change,
      total: parseFloat((base * (1 + s.change / 100)).toFixed(2)),
      mean: parseFloat((mean * (1 + s.change / 100)).toFixed(2))
    }))
    setResult({ chartData: chartData.slice(0, 50), totals, base: parseFloat(base.toFixed(2)), mean: parseFloat(mean.toFixed(2)) })
  }

  function updateScenario(i, field, val) {
    const updated = [...scenarios]
    updated[i] = { ...updated[i], [field]: field === 'change' ? parseFloat(val) || 0 : val }
    setScenarios(updated)
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>What-If Scenarios</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Model different scenarios by applying percentage changes to your data</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Configuration</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Base Column</div>
            <select value={baseCol} onChange={e => setBaseCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Numeric --</option>
              {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <button onClick={run} disabled={!baseCol} style={{ padding: '9px 24px', background: baseCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: baseCol ? 'pointer' : 'default' }}>Run Scenarios</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Scenario Settings</div>
          {scenarios.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <input value={s.name} onChange={e => updateScenario(i, 'name', e.target.value)} style={{ flex: 2, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                <input type="number" value={s.change} onChange={e => updateScenario(i, 'change', e.target.value)} style={{ width: '70px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
                <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>%</span>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: s.color }} />
            </div>
          ))}
        </div>
      </div>

      {result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <OpenInAskYourData
              fileId={fileId}
              prompt={`I modelled scenarios on ${baseCol}: base total ${result.base.toLocaleString()}. Explain the risk profile and which assumptions drive the biggest swings.`}
            />
            <PinToDashboard
              widget={{
                type: 'line',
                col: baseCol,
                label: `What-if scenarios on ${baseCol}`,
                file_id: fileId,
                extra: { scenarios: result.totals, base: result.base, mean: result.mean },
              }}
            />
            <ExportMenu data={result.chartData} filename={`whatif-${baseCol}`} containerRef={chartRef} title={`What-If Scenarios on ${baseCol}`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #0c1446' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Base Total</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0c1446' }}>{result.base.toLocaleString()}</div>
            </div>
            {result.totals.map(t => (
              <div key={t.name} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${t.color}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{t.name} ({t.change >= 0 ? '+' : ''}{t.change}%)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: t.color }}>{t.total.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Scenario Comparison (first 50 rows)</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={result.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="index" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {scenarios.map(s => (
                  <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && (
        <EmptyState
          icon="🎯"
          title="Configure scenarios and pick a column"
          body="Apply percentage changes (e.g., -20% / 0% / +20%) to a numeric column to see what total each assumption produces."
        />
      )}
    </div>
  )
}
