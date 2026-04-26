import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

export default function RegressionAnalysis() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [results, setResults] = useState(null)
  const [dateRange, setDateRange] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResults(null); setDateRange(null)
    if (!id) return
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
    }).catch(() => {})
  }

  function run() {
    if (!xCol || !yCol || !rows.length) return
    const scoped = applyDateFilter(rows, dateRange)
    const pts = scoped.map(r => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) })).filter(p => !isNaN(p.x) && !isNaN(p.y))
    const n = pts.length
    if (n < 2) return
    const sumX = pts.reduce((a, p) => a + p.x, 0)
    const sumY = pts.reduce((a, p) => a + p.y, 0)
    const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0)
    const sumX2 = pts.reduce((a, p) => a + p.x * p.x, 0)
    const meanX = sumX / n; const meanY = sumY / n
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = meanY - slope * meanX
    const yPred = pts.map(p => slope * p.x + intercept)
    const ssTot = pts.reduce((a, p) => a + (p.y - meanY) ** 2, 0)
    const ssRes = pts.reduce((a, p, i) => a + (p.y - yPred[i]) ** 2, 0)
    const r2 = 1 - ssRes / ssTot
    const xMin = Math.min(...pts.map(p => p.x)); const xMax = Math.max(...pts.map(p => p.x))
    const trendLine = [{ x: xMin, y: slope * xMin + intercept }, { x: xMax, y: slope * xMax + intercept }]
    const chartData = pts.map((p, i) => ({ ...p, predicted: yPred[i] }))
    setResults({ slope, intercept, r2, n, meanX, meanY, trendLine, chartData })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Regression Analysis</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Find linear relationships between variables with R² fit quality</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['X (Independent)', <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Y (Dependent)', <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => (
            <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>
          ))}
        </div>

        {headers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="regression-analysis.dateRange"
            />
          </div>
        )}

        <button onClick={run} disabled={!xCol || !yCol} style={{ padding: '9px 24px', background: xCol && yCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: xCol && yCol ? 'pointer' : 'default' }}>Run Regression</button>
      </div>

      {results && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
            <OpenInAskYourData
              fileId={fileId}
              prompt={`The regression of ${yCol} on ${xCol} gave R² of ${results.r2.toFixed(3)} (slope ${results.slope.toFixed(3)}, intercept ${results.intercept.toFixed(3)}). What other variables might explain the residuals?`}
            />
            <PinToDashboard
              widget={{
                type: 'scatter',
                col: yCol,
                label: `${yCol} vs ${xCol} (R²=${results.r2.toFixed(3)})`,
                file_id: fileId,
                extra: { x: xCol, y: yCol, slope: results.slope, intercept: results.intercept, r2: results.r2 },
              }}
            />
            <ExportMenu data={results.chartData} filename={`regression-${xCol}-${yCol}`} containerRef={chartRef} title={`Regression: ${yCol} on ${xCol}`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['R² (Fit)', results.r2.toFixed(4), results.r2 > 0.7 ? '#10b981' : results.r2 > 0.4 ? '#f59e0b' : '#ef4444'],
              ['Slope', results.slope.toFixed(4), '#0097b2'],
              ['Intercept', results.intercept.toFixed(4), '#0c1446'],
              ['Data Points', results.n, '#e91e8c']
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 8 }}>Equation: <span style={{ color: '#e91e8c' }}>y = {results.slope.toFixed(3)}x + {results.intercept.toFixed(3)}</span></div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {results.r2 > 0.7 ? '✅ Strong fit — this linear model explains the data well.' : results.r2 > 0.4 ? '⚠️ Moderate fit — some correlation but other factors may be at play.' : '❌ Weak fit — consider non-linear or multivariate models.'}
            </div>
          </div>

          <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Scatter Plot with Regression Line</div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={results.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} label={{ value: xCol, position: 'insideBottom', offset: -5, fontSize: 12 }} />
                <YAxis name={yCol} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Scatter dataKey="y" fill="#0097b2" opacity={0.6} r={4} />
                <Line dataKey="predicted" dot={false} stroke="#e91e8c" strokeWidth={2} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!results && (
        <EmptyState
          icon="📈"
          title="Pick X and Y to run linear regression"
          body="The page reports R², slope, intercept, and an interpretation flag (strong / moderate / weak fit). Use the date filter to scope to a window."
        />
      )}
    </div>
  )
}
