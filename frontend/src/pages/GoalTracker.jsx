import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

export default function GoalTracker() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [goals, setGoals] = useState([{ col: '', target: '', label: '' }])
  const [result, setResult] = useState(null)
  const [dateRange, setDateRange] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null); setDateRange(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function addGoal() { setGoals([...goals, { col: '', target: '', label: '' }]) }
  function removeGoal(i) { setGoals(goals.filter((_, idx) => idx !== i)) }
  function updateGoal(i, field, val) {
    const updated = [...goals]
    updated[i] = { ...updated[i], [field]: val }
    setGoals(updated)
  }

  function run() {
    const scoped = applyDateFilter(rows, dateRange)
    const results = goals.filter(g => g.col && g.target).map(g => {
      const vals = scoped.map(r => parseFloat(r[g.col]) || 0)
      const actual = vals.reduce((a, b) => a + b, 0)
      const target = parseFloat(g.target) || 0
      const pct = target > 0 ? Math.min((actual / target) * 100, 200) : 0
      const status = pct >= 100 ? 'achieved' : pct >= 80 ? 'on-track' : pct >= 50 ? 'at-risk' : 'off-track'
      const colors = { achieved: '#10b981', 'on-track': '#0097b2', 'at-risk': '#f59e0b', 'off-track': '#ef4444' }
      return { label: g.label || g.col, col: g.col, actual: parseFloat(actual.toFixed(2)), target: parseFloat(target.toFixed(2)), pct: parseFloat(pct.toFixed(1)), status, color: colors[status] }
    })
    setResult(results)
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Goal Tracker</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Track actual performance against targets across multiple KPIs</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
          <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', maxWidth: 300, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>

        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 10 }}>Goals</div>
        {goals.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              {i === 0 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Label</div>}
              <input value={g.label} onChange={e => updateGoal(i, 'label', e.target.value)} placeholder="Goal name" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
            </div>
            <div style={{ flex: 1 }}>
              {i === 0 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Column</div>}
              <select value={g.col} onChange={e => updateGoal(i, 'col', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }}>
                <option value="">-- Column --</option>
                {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              {i === 0 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Target Value</div>}
              <input type="number" value={g.target} onChange={e => updateGoal(i, 'target', e.target.value)} placeholder="e.g. 100000" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
            </div>
            {goals.length > 1 && <button onClick={() => removeGoal(i)} style={{ padding: '8px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>}
          </div>
        ))}
        {headers.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="goal-tracker.dateRange"
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={addGoal} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Add Goal</button>
          <button onClick={run} disabled={!fileId} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>Track Goals</button>
        </div>
      </div>

      {result && result.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <ExportMenu data={result} filename="goal-tracker" containerRef={chartRef} title="Goal Tracker" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {result.map(g => (
              <div key={g.label} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${g.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 8 }}>{g.label}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <OpenInAskYourData
                      variant="icon"
                      fileId={fileId}
                      prompt={`Why is ${g.label} at ${g.pct}% of target? Break down ${g.col} by the most useful dimension.`}
                    />
                    <PinToDashboard
                      variant="icon"
                      widget={{
                        type: 'kpi',
                        col: g.col,
                        label: g.label,
                        file_id: fileId,
                        extra: { agg: 'sum', target: g.target },
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: g.color, marginBottom: 4 }}>{g.pct}%</div>
                <div style={{ width: '100%', height: 8, background: '#f3f4f6', borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ width: `${Math.min(g.pct, 100)}%`, height: '100%', background: g.color, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Actual: <strong>{g.actual.toLocaleString()}</strong></div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Target: <strong>{g.target.toLocaleString()}</strong></div>
                <div style={{ marginTop: 8, display: 'inline-block', background: g.color + '20', color: g.color, borderRadius: 12, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>{g.status.replace('-', ' ')}</div>
              </div>
            ))}
          </div>

          <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Actual vs Target</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={result}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="actual" name="Actual" fill="#0097b2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Target" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && (
        <EmptyState
          icon="🎯"
          title="Set goals and click Track"
          body="Add a label, pick a numeric column, and set a target. The tracker shows percent of target with red/amber/green status and a trend chart."
        />
      )}
    </div>
  )
}
